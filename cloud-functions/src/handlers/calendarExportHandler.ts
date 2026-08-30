import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import * as ics from 'ics';

const db = admin.firestore();

interface ICSEvent {
  eventId: string;
  title: string;
  description: string;
  location: string;
  startTime: Date;
  endTime: Date;
  organizerName: string;
  organizerEmail: string;
}

/**
 * Generate ICS file for calendar export
 */
export const generateCalendarFile = functions.https.onRequest(
  async (req: Request, res: Response) => {
    const { eventId } = req.query as { eventId: string };

    if (!eventId) {
      res.status(400).json({
        success: false,
        message: 'Missing eventId parameter',
      });
      return;
    }

    try {
      const eventDoc = await db.collection('events').doc(eventId).get();

      if (!eventDoc.exists()) {
        res.status(404).json({
          success: false,
          message: 'Event not found',
        });
        return;
      }

      const eventData = eventDoc.data();
      const organizerDoc = await db
        .collection('users')
        .doc(eventData.organizerId)
        .get();
      const organizerData = organizerDoc.data();

      const icsEvent: ICSEvent = {
        eventId: eventId,
        title: eventData.title,
        description: eventData.description || '',
        location: eventData.location || '',
        startTime: eventData.startTime.toDate(),
        endTime: eventData.endTime.toDate(),
        organizerName: organizerData?.displayName || organizerData?.name || 'Event Organizer',
        organizerEmail: organizerData?.email || 'organizer@uni-event.app',
      };

      const icsContent = generateICS(icsEvent);

      res.setHeader('Content-Type', 'text/calendar');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${eventData.title.replace(/\s+/g, '_')}.ics"`
      );
      res.send(icsContent);
    } catch (error) {
      console.error('Error generating calendar file:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate calendar file',
      });
    }
  }
);

/**
 * Generate ICS content string
 */
function generateICS(event: ICSEvent): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Uni-Event//Event Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.eventId}@uni-event.app`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `DTSTART:${formatICSDate(event.startTime)}`,
    `DTEND:${formatICSDate(event.endTime)}`,
    `SUMMARY:${escapeICSText(event.title)}`,
    `DESCRIPTION:${escapeICSText(event.description)}`,
    `LOCATION:${escapeICSText(event.location)}`,
    `ORGANIZER;CN="${escapeICSText(event.organizerName)}":mailto:${event.organizerEmail}`,
    'SEQUENCE:0',
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Event Reminder',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}

/**
 * Format date for ICS format (YYYYMMDDTHHMMSSZ)
 */
function formatICSDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Escape special characters for ICS format
 */
function escapeICSText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}
