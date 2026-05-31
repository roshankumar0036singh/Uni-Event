import * as admin from "firebase-admin";
import * as fs from "node:fs";
import * as path from "node:path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { Resend } from "resend";
import { Timestamp, FieldValue } from "@google-cloud/firestore";

function getResendClient() {
    return new Resend(process.env.RESEND_API_KEY || "re_test_placeholder");
}

function escapeHtml(unsafe: string) {
    return unsafe
        .split("&").join("&amp;")
        .split("<").join("&lt;")
        .split(">").join("&gt;")
        .split('"').join("&quot;")
        .split("'").join("&#039;");
}

function sanitizeFilename(name: string) {
    return name.replace(/[^a-zA-Z0-9_.\- ]+/g, "_").slice(0, 200);
}

async function generatePdfBuffer(
    templateBytes: Uint8Array | ArrayBuffer | Buffer,
    participantName: string,
    eventName: string
) {
    const pdfDoc = await PDFDocument.load(templateBytes as any);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const nameSize = 40;
    const nameWidth = font.widthOfTextAtSize(participantName, nameSize);
    firstPage.drawText(participantName, {
        x: (width - nameWidth) / 2,
        y: height / 2 - 20,
        size: nameSize,
        font,
        color: rgb(1, 1, 1),
    });

    const eventNameSize = 20;
    const eventWidth = regularFont.widthOfTextAtSize(eventName, eventNameSize);
    firstPage.drawText(eventName, {
        x: (width - eventWidth) / 2,
        y: height / 2 - 80,
        size: eventNameSize,
        font: regularFont,
        color: rgb(1, 1, 1),
    });

    return Buffer.from(await pdfDoc.save());
}

//main export

export async function awardDedicatedStudentCertificate(userId: string) {
    const db = admin.firestore();
    const userRef = db.collection("users").doc(userId);
    const now = Timestamp.fromDate(new Date());

    let userName = "Student";
    let userEmail: string | undefined;

    //don't re-issue if already awarded
    const claimed = await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists) throw new Error(`User ${userId} not found`);

        const data = snap.data() || {};
        userName = data.name || data.displayName || "Student";
        userEmail = data.email;

        const already = (data.certificates || []).some(
            (c: { type: string }) => c.type === "dedicated_student"
        );
        if (already) return false;

        tx.update(userRef, {
            certificates: FieldValue.arrayUnion({
                type: "dedicated_student",
                status: "pending_delivery",
                claimedAt: now.toDate().toISOString(),
            }),
        });
        return true;
    });

    if (!claimed) {
        console.log(`User ${userId} already has dedicated_student certificate`);
        return;
    }

    if (!userEmail) {
        console.warn(`User ${userId} has no email — skipping certificate email`);
    }

    // load template
    const templatePath = path.join(
        __dirname,
        "../assets/certificate_template.pdf"
    );
    let templateBytes: Buffer;
    try {
        templateBytes = fs.readFileSync(templatePath);
    } catch {
        throw new Error(
            "Certificate template not found at assets/certificate_template.pdf"
        );
    }

    const certTitle = "Dedicated Student Award";
    const pdfBuffer = await generatePdfBuffer(templateBytes, userName, certTitle);

    const bucket = admin.storage().bucket();
    const storagePath = `certificates/dedicated_student/${userId}.pdf`;
    const file = bucket.file(storagePath);
    await file.save(pdfBuffer, { metadata: { contentType: "application/pdf" } });

    let signedUrl: string;
    if (process.env.FUNCTIONS_EMULATOR === "true") {
        signedUrl = `http://localhost:9199/v0/b/default-bucket/o/certificates%2Fdedicated_student%2F${userId}.pdf?alt=media`;
        console.log("📧 [EMULATOR] Using mock signed URL:", signedUrl);
    } else {
        const [url] = await file.getSignedUrl({
            action: "read",
            expires: "2499-12-31",
        });
        signedUrl = url;
    }

    //add certificate on user doc 
    await userRef.update({
        certificates: FieldValue.arrayRemove({
            type: "dedicated_student",
            status: "pending_delivery",
            claimedAt: now.toDate().toISOString(),
        }),
    });
    await userRef.update({
        certificates: FieldValue.arrayUnion({
            type: "dedicated_student",
            status: "delivered",
            awardedAt: now.toDate().toISOString(),
            certificateUrl: signedUrl,
        }),
    });

    console.log(`Certificate record saved for user ${userId}`);

    //send email
    if (userEmail) {
        const safeName = escapeHtml(userName);
        const safeCertTitle = escapeHtml(certTitle);
        const safeFilename = `${sanitizeFilename(userName)}_DedicatedStudent_Certificate.pdf`;

        if (process.env.FUNCTIONS_EMULATOR === "true") {
            console.log(`📧 [EMULATOR] Would send certificate email to: ${userEmail}`);
            console.log(`📧 [EMULATOR] Certificate URL: ${signedUrl}`);
            return;
        }

        const { error } = await getResendClient().emails.send({
            from: process.env.EMAIL_SENDER || "onboarding@resend.dev",
            to: [userEmail],
            subject: `You've earned the Dedicated Student Certificate! 🎓`,
            html: `
        <p>Hello ${safeName},</p>
        <p>Congratulations! You've attended events for <strong>4 consecutive weeks</strong>
           and earned the <strong>${safeCertTitle}</strong>.</p>
        <p><a href="${signedUrl}" target="_blank" rel="noopener">
          Download your certificate
        </a></p>
        <p>Keep up the great work!<br/>UniEvent Team</p>
      `,
            attachments: [{ filename: safeFilename, content: pdfBuffer }],
        });

        if (error) {
            console.error(`Failed to email certificate to ${userEmail}:`, error);
        } else {
            console.log(`Dedicated Student certificate emailed to ${userEmail}`);
        }
    }
}