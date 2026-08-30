import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import { Timestamp } from 'firebase-admin/firestore';

const db = admin.firestore();

interface ReminderConfig {
  eventId: string;
  enabled: boolean;
  reminderTimes: number[]; // minutes before event
  customMessage?: string;
  organizerId: string;
}

interface ReminderSchedule {
  eventId: string;
  userId: string;
  reminderTime: number; // minutes before
  scheduledFor: Date;
  sent: boolean;
}

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Schedule reminders for an event
 */
export const scheduleEventReminders = functions.firestore
  .document('events/{eventId}')
  .onCreate(async (snap, context) => {
    const { eventId } = context.params;
    const eventData = snap.data();

    try {
      // Check if reminders are enabled for this event
      const configDoc = await db
        .collection('eventReminderConfigs')
        .doc(eventId)
        .get();

      if (!configDoc.exists()) {
        console.log(`No reminder config for event ${eventId}`);
        return;
      }

      const config = configDoc.data() as ReminderConfig;

      if (!config.enabled) {
        console.log(`Reminders disabled for event ${eventId}`);
        return;
      }

      // Get registered attendees
      const registrationSnapshot = await db
        .collection('eventRegistrations')
        .where('eventId', '==', eventId)
        .where('status', '==', 'confirmed')
        .get();

      const eventStartTime = eventData.startTime.toDate();
      const currentTime = new Date();

      // Schedule reminders for each attendee
      for (const reminderMinutes of config.reminderTimes) {
        const reminderTime = new Date(eventStartTime.getTime() - reminderMinutes * 60000);

        if (reminderTime > currentTime) {
          for (const regDoc of registrationSnapshot.docs) {
            const registration = regDoc.data();
            const scheduleRef = db.collection('reminderSchedules').doc();

            await scheduleRef.set({
              eventId,
              userId: registration.userId,
              reminderTime: reminderMinutes,
              scheduledFor: reminderTime,
              sent: false,
              createdAt: Timestamp.now(),
            });
          }
        }
      }

      console.log(`Scheduled reminders for event ${eventId}`);
    } catch (error) {
      console.error(`Error scheduling reminders for event ${eventId}:`, error);
    }
  });

/**
 * Cloud Scheduler job to send pending reminders
 */
export const sendPendingReminders = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    try {
      const now = new Date();

      // Find all reminders that should be sent
      const reminderSnapshot = await db
        .collection('reminderSchedules')
        .where('sent', '==', false)
        .where('scheduledFor', '<=', Timestamp.fromDate(now))
        .get();

      console.log(`Found ${reminderSnapshot.size} reminders to send`);

      for (const reminderDoc of reminderSnapshot.docs) {
        const reminder = reminderDoc.data();
        const sentSuccess = await sendReminderEmail(reminder);

        if (sentSuccess) {
          await reminderDoc.ref.update({
            sent: true,
            sentAt: Timestamp.now(),
          });
        }
      }
    } catch (error) {
      console.error('Error sending reminders:', error);
    }
  });

/**
 * Send reminder email to user
 */
async function sendReminderEmail(reminder: any): Promise<boolean> {
  try {
    // Get event details
    const eventDoc = await db.collection('events').doc(reminder.eventId).get();
    const eventData = eventDoc.data();

    // Get user email
    const userDoc = await db.collection('users').doc(reminder.userId).get();
    const userData = userDoc.data();

    if (!userData || !userData.email) {
      console.warn(`No email found for user ${reminder.userId}`);
      return false;
    }

    // Get reminder config
    const configDoc = await db
      .collection('eventReminderConfigs')
      .doc(reminder.eventId)
      .get();
    const config = configDoc.data() as ReminderConfig;

    // Generate unsubscribe token
    const unsubscribeToken = generateUnsubscribeToken(reminder.userId, reminder.eventId);

    // Compose email
    const minutesUntil = reminder.reminderTime;
    const timeText =
      minutesUntil >= 60
        ? `${Math.floor(minutesUntil / 60)} hour(s)`
        : `${minutesUntil} minute(s)`;

    const emailContent = config.customMessage
      ? config.customMessage
      : `Don't forget! "${eventData.title}" is happening in ${timeText}.`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userData.email,
      subject: `Reminder: ${eventData.title} is coming up`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>${eventData.title}</h2>
          <p>${emailContent}</p>
          <p>
            <strong>When:</strong> ${eventData.startTime.toDate().toLocaleString()}<br>
            <strong>Where:</strong> ${eventData.location}
          </p>
          <p>
            <a href="https://uni-event.app/events/${reminder.eventId}" style="background-color: #007AFF; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View Event Details
            </a>
          </p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #ccc;">
          <p style="font-size: 12px; color: #999;">
            <a href="https://uni-event.app/unsubscribe?token=${unsubscribeToken}" style="color: #007AFF;">
              Unsubscribe from reminders
            </a>
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Reminder email sent to ${userData.email} for event ${reminder.eventId}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

/**
 * Handle unsubscribe requests
 */
export const handleUnsubscribe = functions.https.onRequest(
  async (req, res) => {
    const { token } = req.query as { token: string };

    if (!token) {
      res.status(400).json({ success: false, message: 'Missing token' });
      return;
    }

    try {
      const { userId, eventId } = decodeUnsubscribeToken(token);

      // Add to unsubscribe list
      await db
        .collection('reminderUnsubscribes')
        .doc(`${userId}_${eventId}`)
        .set({
          userId,
          eventId,
          unsubscribedAt: Timestamp.now(),
        });

      res.json({
        success: true,
        message: 'You have been unsubscribed from reminders for this event',
      });
    } catch (error) {
      console.error('Error handling unsubscribe:', error);
      res.status(400).json({ success: false, message: 'Invalid token' });
    }
  }
);

/**
 * Helper to generate unsubscribe token
 */
function generateUnsubscribeToken(userId: string, eventId: string): string {
  const crypto = require('crypto');
  const data = `${userId}:${eventId}:${Date.now()}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
}

/**
 * Helper to decode unsubscribe token
 */
function decodeUnsubscribeToken(token: string): { userId: string; eventId: string } {
  // In production, use JWT or similar secure approach
  // This is simplified for demonstration
  throw new Error('Token validation not implemented - use JWT in production');
}
