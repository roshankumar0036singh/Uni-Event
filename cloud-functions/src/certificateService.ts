import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

type Participant = {
    id: string;
    email?: string;
    name?: string;
    [key: string]: any;
};

type CertificateOutcome = {
    email: string | null;
    status: 'success' | 'failed' | 'error' | 'skipped';
    id?: string;
    certificateUrl?: string;
    error?: string;
    reason?: string;
};

function getParticipantId(participant: Participant) {
    return participant.id || (participant.email || '').replace(/[^a-z0-9@.]/gi, '_');
}

function buildLinkedInUrl(
    eventTitle: string,
    organizationName: string,
    signedUrl: string,
    eventStartDate?: string | number | Date,
) {
    let issueDate = new Date();
    if (eventStartDate) {
        const parsed = new Date(eventStartDate as any);
        if (!Number.isNaN(parsed.getTime())) {
            issueDate = parsed;
        }
    }

    const issueYear = issueDate.getUTCFullYear();
    const issueMonth = issueDate.getUTCMonth() + 1;

    return `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(
        eventTitle,
    )}&organizationName=${encodeURIComponent(organizationName)}&issueYear=${issueYear}&issueMonth=${issueMonth}&certUrl=${encodeURIComponent(
        signedUrl,
    )}`;
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function escapeHtml(unsafe: string) {
    // Replace fixed tokens using split/join for compatibility with older lib targets
    return unsafe
        .split('&')
        .join('&amp;')
        .split('<')
        .join('&lt;')
        .split('>')
        .join('&gt;')
        .split('"')
        .join('&quot;')
        .split("'")
        .join('&#039;');
}

function sanitizeFilename(name: string) {
    // remove path separators and control chars, allow basic set
    return name.replace(/[^a-zA-Z0-9_.\- ]+/g, '_').slice(0, 200);
}

async function generatePdfBuffer(
    templateBytes: Uint8Array | ArrayBuffer | Buffer,
    participantName: string,
    eventName: string,
) {
    const pdfDoc = await PDFDocument.load(templateBytes as any);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Draw Name (Centered)
    const nameSize = 40;
    const nameWidth = font.widthOfTextAtSize(participantName, nameSize);
    firstPage.drawText(participantName, {
        x: (width - nameWidth) / 2,
        y: height / 2 - 20,
        size: nameSize,
        font: font,
        color: rgb(1, 1, 1),
    });

    // Draw Event Name
    const eventNameSize = 20;
    const eventWidth = regularFont.widthOfTextAtSize(eventName, eventNameSize);
    firstPage.drawText(eventName, {
        x: (width - eventWidth) / 2,
        y: height / 2 - 80,
        size: eventNameSize,
        font: regularFont,
        color: rgb(1, 1, 1),
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}

async function uploadPdfAndGetUrl(bucket: any, storagePath: string, pdfBuffer: Buffer) {
    const file = bucket.file(storagePath);
    await file.save(pdfBuffer, { metadata: { contentType: 'application/pdf' } });
    const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: '2499-12-31' });
    return signedUrl;
}

async function persistCertificateUrl(eventId: string, participantId: string, signedUrl: string) {
    const participantRef = admin
        .firestore()
        .collection(`events/${eventId}/participants`)
        .doc(participantId);
    await participantRef.update({
        certificateUrl: signedUrl,
        certificateIssuedAt: FieldValue.serverTimestamp(),
    });
}

async function sendCertificateEmail(
    p: Participant,
    eventName: string,
    linkedinUrl: string,
    pdfBuffer: Buffer,
) {
    const safeName = escapeHtml(p.name || 'Participant');
    const safeEvent = escapeHtml(eventName);
    const safeFilename = `${sanitizeFilename(p.name || 'participant')}_Certificate.pdf`;

    return resend.emails.send({
        from: process.env.EMAIL_SENDER || 'onboarding@resend.dev',
        to: [p.email!],
        subject: `Certificate for ${eventName || ''}`,
        html: `<p>Hello ${safeName},</p>
               <p>Please find your official certificate for <strong>${safeEvent}</strong> attached.</p>
               <p><a href="${linkedinUrl}" target="_blank" rel="noopener">Add this certificate to your LinkedIn profile</a></p>
               <p>Best regards,<br/>UniEvent Team</p>`,
        attachments: [
            {
                filename: safeFilename,
                content: pdfBuffer,
            },
        ],
    });
}

async function sendCertificateEmailUsingUrl(
    p: Participant,
    eventName: string,
    linkedinUrl: string,
    certificateUrl: string,
) {
    const safeName = escapeHtml(p.name || 'Participant');
    const safeEvent = escapeHtml(eventName);

    return resend.emails.send({
        from: process.env.EMAIL_SENDER || 'onboarding@resend.dev',
        to: [p.email!],
        subject: `Certificate for ${eventName || ''}`,
        html: `<p>Hello ${safeName},</p>
               <p>Your certificate for <strong>${safeEvent}</strong> is available at the link below.</p>
               <p><a href="${certificateUrl}" target="_blank" rel="noopener">Download your certificate</a></p>
               <p><a href="${linkedinUrl}" target="_blank" rel="noopener">Add this certificate to your LinkedIn profile</a></p>
               <p>Best regards,<br/>UniEvent Team</p>`,
    });
}

function getEventStartDate(event: any) {
    return event?.startAt || event?.startDate || event?.start || event?.startTime;
}

async function handleExistingCertificateParticipant(
    participant: Participant,
    eventTitle: string,
    organizationName: string,
    eventStartDate: string | number | Date | undefined,
): Promise<CertificateOutcome> {
    const existingUrl = (participant as any).certificateUrl as string;
    const linkedinUrl = buildLinkedInUrl(eventTitle, organizationName, existingUrl, eventStartDate);

    try {
        const { data, error } = await sendCertificateEmailUsingUrl(
            participant,
            eventTitle,
            linkedinUrl,
            existingUrl,
        );

        if (error) {
            return {
                email: participant.email || null,
                status: 'failed',
                error: getErrorMessage(error),
                certificateUrl: existingUrl,
                id: participant.id,
            };
        }

        return {
            email: participant.email || null,
            status: 'success',
            id: data?.id,
            certificateUrl: existingUrl,
        };
    } catch (err) {
        return {
            email: participant.email || null,
            status: 'error',
            error: getErrorMessage(err),
            certificateUrl: existingUrl,
            id: participant.id,
        };
    }
}

async function processParticipant(
    participant: Participant,
    eventId: string,
    eventTitle: string,
    organizationName: string,
    templateBytes: Uint8Array | ArrayBuffer | Buffer,
    eventStartDate?: string | number | Date,
): Promise<CertificateOutcome> {
    if (!participant.email || !participant.name) {
        return {
            email: participant.email || null,
            status: 'skipped',
            reason: 'missing email or name',
        };
    }

    try {
        const pdfBuffer = await generatePdfBuffer(templateBytes, participant.name, eventTitle);
        const bucket = admin.storage().bucket();
        const participantId = getParticipantId(participant);
        const storagePath = `certificates/${eventId}/${participantId}.pdf`;
        const signedUrl = await uploadPdfAndGetUrl(bucket, storagePath, pdfBuffer);

        // Persist before sending email. If persist fails, do not send the email.
        await persistCertificateUrl(eventId, participantId, signedUrl);

        const linkedinUrl = buildLinkedInUrl(
            eventTitle,
            organizationName,
            signedUrl,
            eventStartDate,
        );

        const { data, error } = await sendCertificateEmail(
            participant,
            eventTitle,
            linkedinUrl,
            pdfBuffer,
        );

        if (error) {
            console.error(`Failed to send to ${participant.email}:`, error);
            return {
                email: participant.email,
                status: 'failed',
                error: getErrorMessage(error),
            };
        }

        console.log(`Sent to ${participant.email}`);
        return {
            email: participant.email,
            status: 'success',
            id: data?.id,
            certificateUrl: signedUrl,
        };
    } catch (error) {
        console.error(`Storage/upload error for ${participant.email}:`, error);
        return {
            email: participant.email,
            status: 'error',
            error: getErrorMessage(error),
        };
    }
}

export async function sendCertificatesForEvent(eventId: string, ownerId: string) {
    // 1. Fetch Event Details
    const eventDoc = await admin.firestore().collection('events').doc(eventId).get();
    if (!eventDoc.exists) throw new Error('Event not found');
    const event = eventDoc.data();

    if (event?.ownerId !== ownerId) {
        throw new Error('Unauthorized: Only the event owner can send certificates.');
    }

    // 2. Fetch Participants
    const participantsSnap = await admin
        .firestore()
        .collection(`events/${eventId}/participants`)
        .get();
    if (participantsSnap.empty) throw new Error('No participants registered for this event.');

    const participants: Participant[] = participantsSnap.docs.map(doc => ({
        ...(doc.data() as object),
        id: doc.id,
    }));

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

    const eventTitle = event?.title || 'Event';
    const organizationName = event?.organization || event?.ownerName || 'UniEvent';
    const eventStartDate = getEventStartDate(event);
    const results: CertificateOutcome[] = [];

    for (const p of participants) {
        // Idempotency: if participant already has a certificateUrl, attempt to ensure delivery
        if ((p as any).certificateUrl) {
            results.push(
                await handleExistingCertificateParticipant(
                    p,
                    eventTitle,
                    organizationName,
                    eventStartDate,
                ),
            );
            continue;
        }

        const outcome = await processParticipant(
            p,
            eventId,
            eventTitle,
            organizationName,
            templateBytes,
            // pass event start if available (prefer startAt)
            eventStartDate,
        );
        results.push(outcome);
    }

    if (
        results.length === participants.length &&
        results.every(result => result.status === 'success')
    ) {
        await admin.firestore().collection('events').doc(eventId).update({
            certificatesSent: true,
            certificatesSentAt: FieldValue.serverTimestamp(),
        });
    } else {
        console.log(
            `Not all participants succeeded. total=${participants.length} results=${results.length}`,
        );
    }

    return { total: participants.length, results };
}
