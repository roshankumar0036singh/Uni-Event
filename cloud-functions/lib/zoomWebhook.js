"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyZoomWebhook = verifyZoomWebhook;
exports.handleZoomWebhook = handleZoomWebhook;
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const getDb = () => admin.firestore();
// Step 1: Get Zoom OAuth access token
async function getZoomAccessToken() {
    const accountId = process.env.ZOOM_ACCOUNT_ID;
    const clientId = process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET;
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const response = await axios_1.default.post(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`, {}, {
        headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
    });
    return response.data.access_token;
}
// Step 2: Fetch ALL participants with pagination
async function getZoomParticipants(meetingId, accessToken) {
    const allParticipants = [];
    let nextPageToken = "";
    do {
        const response = await axios_1.default.get(`https://api.zoom.us/v2/past_meetings/${meetingId}/participants`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: Object.assign({ page_size: 300 }, (nextPageToken ? { next_page_token: nextPageToken } : {})),
        });
        allParticipants.push(...response.data.participants);
        nextPageToken = response.data.next_page_token || "";
    } while (nextPageToken);
    // Return unique non-empty emails
    const emails = allParticipants
        .map((p) => { var _a; return (_a = p.user_email) === null || _a === void 0 ? void 0 : _a.toLowerCase(); })
        .filter((email) => email && email.length > 0);
    return [...new Set(emails)];
}
// Step 3: Verify webhook with raw body, timing-safe comparison, and replay protection
function verifyZoomWebhook(rawBody, timestampHeader, hashForValidate, secretToken) {
    // Replay protection — reject requests older than 5 minutes
    const requestTime = parseInt(timestampHeader, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - requestTime) > 300) {
        console.error("❌ Zoom webhook timestamp too old — possible replay attack");
        return false;
    }
    const message = `v0:${timestampHeader}:${rawBody}`;
    const hash = crypto
        .createHmac("sha256", secretToken)
        .update(message)
        .digest("hex");
    const expected = `v0=${hash}`;
    // Timing-safe comparison to prevent timing attacks
    try {
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hashForValidate));
    }
    catch (_a) {
        return false;
    }
}
// Step 4: Mark participants as checked-in idempotently
async function syncAttendanceToFirestore(meetingId, participantEmails) {
    const eventsSnapshot = await getDb()
        .collection("events")
        .where("zoomMeetingId", "==", meetingId)
        .limit(1)
        .get();
    if (eventsSnapshot.empty) {
        console.log(`No event found for Zoom meeting ID: ${meetingId}`);
        return;
    }
    const eventDoc = eventsSnapshot.docs[0];
    const eventId = eventDoc.id;
    let newlyCheckedIn = 0;
    for (const email of participantEmails) {
        const usersSnapshot = await getDb()
            .collection("users")
            .where("email", "==", email)
            .limit(1)
            .get();
        if (usersSnapshot.empty)
            continue;
        const userId = usersSnapshot.docs[0].id;
        const attendeeRef = getDb()
            .collection("events")
            .doc(eventId)
            .collection("attendees")
            .doc(userId);
        // Use transaction to prevent double-counting
        await getDb().runTransaction(async (tx) => {
            var _a;
            const attendeeSnap = await tx.get(attendeeRef);
            const alreadyCheckedIn = attendeeSnap.exists && ((_a = attendeeSnap.data()) === null || _a === void 0 ? void 0 : _a.checkedIn) === true;
            if (!alreadyCheckedIn) {
                tx.set(attendeeRef, {
                    checkedIn: true,
                    checkInMethod: "zoom",
                    checkInTime: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
                tx.update(getDb().collection("users").doc(userId), {
                    "reputation.points": admin.firestore.FieldValue.increment(10),
                });
                newlyCheckedIn += 1;
                console.log(`✅ Checked in user ${email} for event ${eventId}`);
            }
        });
    }
    if (newlyCheckedIn > 0) {
        await getDb()
            .collection("events")
            .doc(eventId)
            .update({
            "metrics.attendance": admin.firestore.FieldValue.increment(newlyCheckedIn),
        });
    }
}
// Main handler
async function handleZoomWebhook(rawBody, body, headers) {
    var _a, _b, _c;
    const secretToken = process.env.ZOOM_WEBHOOK_SECRET_TOKEN || "";
    // Handle Zoom's URL validation challenge
    if (body.event === "endpoint.url_validation") {
        const hashForValidate = crypto
            .createHmac("sha256", secretToken)
            .update(body.payload.plainToken)
            .digest("hex");
        return {
            status: 200,
            data: {
                plainToken: body.payload.plainToken,
                encryptedToken: hashForValidate,
            },
        };
    }
    // Verify signature using raw body
    const timestamp = headers["x-zm-request-timestamp"];
    const signature = headers["x-zm-signature"];
    if (!verifyZoomWebhook(rawBody, timestamp, signature, secretToken)) {
        console.error("❌ Invalid Zoom webhook signature");
        return { status: 401, data: { error: "Unauthorized" } };
    }
    // Handle meeting.ended
    if (body.event === "meeting.ended") {
        const meetingId = (_c = (_b = (_a = body.payload) === null || _a === void 0 ? void 0 : _a.object) === null || _b === void 0 ? void 0 : _b.id) === null || _c === void 0 ? void 0 : _c.toString();
        if (!meetingId) {
            return { status: 400, data: { error: "Missing meeting ID" } };
        }
        try {
            const accessToken = await getZoomAccessToken();
            const participants = await getZoomParticipants(meetingId, accessToken);
            await syncAttendanceToFirestore(meetingId, participants);
            return {
                status: 200,
                data: {
                    success: true,
                    message: `Synced ${participants.length} participants for meeting ${meetingId}`,
                },
            };
        }
        catch (error) {
            console.error("Zoom sync error:", error);
            return { status: 500, data: { error: error.message } };
        }
    }
    return { status: 200, data: { message: "Event received" } };
}
//# sourceMappingURL=zoomWebhook.js.map