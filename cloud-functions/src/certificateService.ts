import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Resend } from 'resend';
import { getParticipantContacts, Participant } from './lib/participants';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendCertificatesForEvent(eventId: string, ownerId: string) {
    // 1. Fetch Event Details
    const eventDoc = await admin.firestore().collection('events').doc(eventId).get();
    if (!eventDoc.exists) throw new Error('Event not found');
    const event = eventDoc.data();

    if (event?.ownerId !== ownerId) {
        throw new Error('Unauthorized: Only the event owner can send certificates.');
    }

    // 2. Fetch Participants (use shared helper)
    const participants: Participant[] = await getParticipantContacts(admin.firestore(), eventId);
    if (!participants || participants.length === 0)
        throw new Error('No participants registered for this event.');

    // 3. Load Template
    // Using a reliable path for assets
    const templatePath = path.join(__dirname, '../assets/certificate_template.pdf');
    let templateBytes;

    try {
        templateBytes = fs.readFileSync(templatePath);
    } catch (e) {
        throw new Error(
            "Certificate Template not found. Please ensure 'assets/certificate_template.pdf' exists in cloud-functions.",
        );
    }

    const results = [];
    let sentCount = 0;

    // 4. Process Each Participant
    for (const p of participants) {
        try {
            if (!p.email || !p.name) continue;

            // Generate PDF
            const pdfDoc = await PDFDocument.load(templateBytes);
            const pages = pdfDoc.getPages();
            const firstPage = pages[0];
            const { width, height } = firstPage.getSize();

            const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

            // Draw Name (Centered)
            const nameSize = 40;
            const nameWidth = font.widthOfTextAtSize(p.name, nameSize);
            firstPage.drawText(p.name, {
                x: (width - nameWidth) / 2,
                y: height / 2 - 20, // Lowered position
                size: nameSize,
                font: font,
                color: rgb(1, 1, 1), // White
            });

            // Draw Event Name
            const eventNameSize = 20;
            const eventName = event.title || 'Event';
            const eventWidth = regularFont.widthOfTextAtSize(eventName, eventNameSize);
            firstPage.drawText(eventName, {
                x: (width - eventWidth) / 2,
                y: height / 2 - 80, // Lowered position
                size: eventNameSize,
                font: regularFont,
                color: rgb(1, 1, 1), // White
            });

            const pdfBytes = await pdfDoc.save();
            const pdfBuffer = Buffer.from(pdfBytes);

            // Send Email
            const { data, error } = await resend.emails.send({
                from: process.env.EMAIL_SENDER || 'onboarding@resend.dev',
                to: [p.email],
                subject: `Certificate for ${eventName}`,
                text: `Hello ${p.name},\n\nPlease find your official certificate for ${eventName} attached.\n\nBest regards,\nUniEvent Team`,
                attachments: [
                    {
                        filename: `${p.name}_Certificate.pdf`,
                        content: pdfBuffer,
                    },
                ],
            });

            if (error) {
                console.error(`Failed to send to ${p.email}:`, error);
                results.push({ email: p.email, status: 'failed', error });
            } else {
                console.log(`Sent to ${p.email}`);
                sentCount += 1;
                results.push({ email: p.email, status: 'success', id: data?.id });
            }
        } catch (err) {
            console.error(`Error processing ${p.email}:`, err);
            results.push({ email: p.email, status: 'error', error: (err as any).message });
        }
    }

    // 5. Update Event Status only if at least one certificate was delivered
    if (sentCount > 0) {
        await admin.firestore().collection('events').doc(eventId).update({
            certificatesSent: true,
            certificatesSentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    return { total: participants.length, sentCount, results };
}
