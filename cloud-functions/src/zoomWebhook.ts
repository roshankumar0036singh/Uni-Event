import * as admin from "firebase-admin";
import * as crypto from "crypto";
import axios from "axios";

const getDb = () => admin.firestore();
const ZOOM_HTTP_TIMEOUT_MS = 10000;

// Step 1: Get Zoom OAuth access token
async function getZoomAccessToken(): Promise<string> {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await axios.post(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    {},
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: ZOOM_HTTP_TIMEOUT_MS,
    }
  );

  return response.data.access_token;
}

// Step 2: Fetch ALL participants with pagination
async function getZoomParticipants(meetingId: string, accessToken: string): Promise<string[]> {
  const allParticipants: any[] = [];
  let nextPageToken = "";

  do {
    const response = await axios.get(
      `https://api.zoom.us/v2/past_meetings/${meetingId}/participants`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: ZOOM_HTTP_TIMEOUT_MS,
        params: {
          page_size: 300,
          ...(nextPageToken ? { next_page_token: nextPageToken } : {}),
        },
      }
    );

    allParticipants.push(...response.data.participants);
    nextPageToken = response.data.next_page_token || "";
  } while (nextPageToken);

  const emails = allParticipants
    .map((p: any) => p.user_email?.toLowerCase())
    .filter((email: string) => email && email.length > 0);

  return [...new Set(emails)];
}

// Step 3: Verify webhook with raw body, timing-safe comparison, and replay protection
export function verifyZoomWebhook(
  rawBody: string,
  timestampHeader: string,
  hashForValidate: string,
  secretToken: string
): boolean {
  if (!timestampHeader || !hashForValidate) {
    console.error("❌ Missing required Zoom webhook headers");
    return false;
  }

  const requestTime = parseInt(timestampHeader, 10);
  if (Number.isNaN(requestTime)) {
    console.error("❌ Invalid Zoom webhook timestamp");
    return false;
  }

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

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(hashForValidate)
    );
  } catch {
    return false;
  }
}

// Step 4: Mark participants as checked-in idempotently
async function syncAttendanceToFirestore(
  meetingId: string,
  participantEmails: string[]
): Promise<void> {
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

    if (usersSnapshot.empty) continue;

    const userId = usersSnapshot.docs[0].id;
    const attendeeRef = getDb()
      .collection("events")
      .doc(eventId)
      .collection("attendees")
      .doc(userId);

    // Return boolean from transaction to avoid mutating outside variable inside callback
    const didCheckIn = await getDb().runTransaction(async (tx) => {
      const attendeeSnap = await tx.get(attendeeRef);
      const alreadyCheckedIn =
        attendeeSnap.exists && attendeeSnap.data()?.checkedIn === true;

      if (!alreadyCheckedIn) {
        tx.set(
          attendeeRef,
          {
            checkedIn: true,
            checkInMethod: "zoom",
            checkInTime: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        tx.update(getDb().collection("users").doc(userId), {
          "reputation.points": admin.firestore.FieldValue.increment(10),
        });

        return true;
      }
      return false;
    });

    if (didCheckIn) {
      newlyCheckedIn += 1;
      // Log userId instead of email to avoid exposing PII
      console.log(`✅ Checked in userId ${userId} for event ${eventId}`);
    }
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
export async function handleZoomWebhook(
  rawBody: string,
  body: any,
  headers: any
): Promise<{ status: number; data: any }> {
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

  const timestamp = headers["x-zm-request-timestamp"] as string;
  const signature = headers["x-zm-signature"] as string;

  if (!verifyZoomWebhook(rawBody, timestamp, signature, secretToken)) {
    console.error("❌ Invalid Zoom webhook signature");
    return { status: 401, data: { error: "Unauthorized" } };
  }

  if (body.event === "meeting.ended") {
    const meetingId = body.payload?.object?.id?.toString();

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
    } catch (error: any) {
      console.error("Zoom sync error:", error);
      return { status: 500, data: { error: error.message } };
    }
  }

  return { status: 200, data: { message: "Event received" } };
}