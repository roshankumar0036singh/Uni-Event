import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;
const TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_FEEDBACK;

// Step 1: Send one email
async function sendEmail(name: string, email: string, eventTitle: string, eventId: string) {
    const payload = {
        service_id: SERVICE_ID,
        template_id: TEMPLATE_ID,
        user_id: PUBLIC_KEY,
        template_params: {
            to_name: name || "Participant",
            to_email: email,
            subject: `Feedback Request: ${eventTitle}`,
            message: `Thank you for attending ${eventTitle}. Please share your feedback!`,
            event_title: eventTitle,
            feedback_link: `https://unievent-ez2w.onrender.com/event/${eventId}/feedback`,
        },
    };

    try {
        const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        return res.ok;
    } catch {
        return false;
    }
}

// Step 2: Get event end time (returns null if invalid)
function getEndTime(event: admin.firestore.DocumentData): Date | null {
    const date = event.endAt?.toDate ? event.endAt.toDate() : new Date(event.endAt);
    return date && !Number.isNaN(date.getTime()) ? date : null;
}

// Step 3: Claim event so no other function run processes it twice
async function claimEvent(ref: admin.firestore.DocumentReference): Promise<boolean> {
    try {
        await ref.firestore.runTransaction(async (t) => {
            const snap = await t.get(ref);
            if (snap.data()?.feedbackRequestSent === true) throw new Error("claimed");
            t.update(ref, { feedbackRequestSent: true });
        });
        return true;
    } catch (e: any) {
        if (e?.message === "claimed") return false;
        throw e;
    }
}

// Step 4: Send emails to all participants of an event
async function notifyParticipants(db: admin.firestore.Firestore, eventId: string, eventTitle: string) {
    const snap = await db.collection(`events/${eventId}/participants`).get();
    for (const p of snap.docs) {
        const { name, email } = p.data();
        if (email && email !== "-") {
            await sendEmail(name, email, eventTitle, eventId);
        }
    }
}

// Main Cloud Function — runs every 60 minutes
export const sendPostEventFeedback = functions.pubsub
    .schedule("every 60 minutes")
    .onRun(async () => {
        const db = admin.firestore();
        const now = new Date();

        const events = await db
            .collection("events")
            .where("feedbackRequestSent", "in", [false, null])
            .get();

        if (events.empty) return;

        for (const eventDoc of events.docs) {
            const event = eventDoc.data();

            const endTime = getEndTime(event);
            if (!endTime || now <= endTime) continue;

            const claimed = await claimEvent(eventDoc.ref);
            if (!claimed) continue;

            await notifyParticipants(db, eventDoc.id, event.title);
            await eventDoc.ref.update({ feedbackRequestSentAt: new Date().toISOString() });

            console.log(`Done: ${event.title}`);
        }
    });