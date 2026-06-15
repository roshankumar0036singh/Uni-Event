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
Object.defineProperty(exports, "__esModule", { value: true });
exports.awardDedicatedStudentCertificate = awardDedicatedStudentCertificate;
const admin = __importStar(require("firebase-admin"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const pdf_lib_1 = require("pdf-lib");
const resend_1 = require("resend");
const firestore_1 = require("@google-cloud/firestore");
function getResendClient() {
    return new resend_1.Resend(process.env.RESEND_API_KEY || 're_test_placeholder');
}
function escapeHtml(unsafe) {
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
function sanitizeFilename(name) {
    return name.replace(/[^a-zA-Z0-9_.\- ]+/g, '_').slice(0, 200);
}
async function generatePdfBuffer(templateBytes, participantName, eventName) {
    const pdfDoc = await pdf_lib_1.PDFDocument.load(templateBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();
    const font = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.Helvetica);
    const nameSize = 40;
    const nameWidth = font.widthOfTextAtSize(participantName, nameSize);
    firstPage.drawText(participantName, {
        x: (width - nameWidth) / 2,
        y: height / 2 - 20,
        size: nameSize,
        font,
        color: (0, pdf_lib_1.rgb)(1, 1, 1),
    });
    const eventNameSize = 20;
    const eventWidth = regularFont.widthOfTextAtSize(eventName, eventNameSize);
    firstPage.drawText(eventName, {
        x: (width - eventWidth) / 2,
        y: height / 2 - 80,
        size: eventNameSize,
        font: regularFont,
        color: (0, pdf_lib_1.rgb)(1, 1, 1),
    });
    return Buffer.from(await pdfDoc.save());
}
//main export
async function awardDedicatedStudentCertificate(userId) {
    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);
    const now = firestore_1.Timestamp.fromDate(new Date());
    let userName = 'Student';
    let userEmail;
    //don't re-issue if already awarded
    const claimed = await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists)
            throw new Error(`User ${userId} not found`);
        const data = snap.data() || {};
        userName = data.name || data.displayName || 'Student';
        userEmail = data.email;
        const already = (data.certificates || []).some((c) => c.type === 'dedicated_student');
        if (already)
            return false;
        tx.update(userRef, {
            certificates: firestore_1.FieldValue.arrayUnion({
                type: 'dedicated_student',
                status: 'pending_delivery',
                claimedAt: now.toDate().toISOString(),
            }),
        });
        return true;
    });
    if (!claimed) {
        console.log(`User ${userId.slice(0, 4) + '***'} already has dedicated_student certificate`);
        return;
    }
    if (!userEmail) {
        console.warn(`User ${userId.slice(0, 4) + '***'} has no email — skipping certificate email`);
    }
    // load template
    const templatePath = path.join(__dirname, '../assets/certificate_template.pdf');
    let templateBytes;
    try {
        templateBytes = fs.readFileSync(templatePath);
    }
    catch {
        throw new Error('Certificate template not found at assets/certificate_template.pdf');
    }
    const certTitle = 'Dedicated Student Award';
    const pdfBuffer = await generatePdfBuffer(templateBytes, userName, certTitle);
    const bucket = admin.storage().bucket();
    const storagePath = `certificates/dedicated_student/${userId}.pdf`;
    const file = bucket.file(storagePath);
    await file.save(pdfBuffer, { metadata: { contentType: 'application/pdf' } });
    let signedUrl;
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
        signedUrl = `http://localhost:9199/v0/b/default-bucket/o/certificates%2Fdedicated_student%2F${userId}.pdf?alt=media`;
        console.log('📧 [EMULATOR] Using mock signed URL:', signedUrl);
    }
    else {
        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: '2499-12-31',
        });
        signedUrl = url;
    }
    //add certificate on user doc
    await userRef.update({
        certificates: firestore_1.FieldValue.arrayRemove({
            type: 'dedicated_student',
            status: 'pending_delivery',
            claimedAt: now.toDate().toISOString(),
        }),
    });
    await userRef.update({
        certificates: firestore_1.FieldValue.arrayUnion({
            type: 'dedicated_student',
            status: 'delivered',
            awardedAt: now.toDate().toISOString(),
            certificateUrl: signedUrl,
        }),
    });
    console.log(`Certificate record saved for user ${userId.slice(0, 4) + '***'}`);
    //send email
    if (userEmail) {
        const safeName = escapeHtml(userName);
        const safeCertTitle = escapeHtml(certTitle);
        const safeFilename = `${sanitizeFilename(userName)}_DedicatedStudent_Certificate.pdf`;
        if (process.env.FUNCTIONS_EMULATOR === 'true') {
            console.log(`📧 [EMULATOR] Would send certificate email to: ${userEmail}`);
            console.log(`📧 [EMULATOR] Certificate URL: ${signedUrl}`);
            return;
        }
        const { error } = await getResendClient().emails.send({
            from: process.env.EMAIL_SENDER || 'onboarding@resend.dev',
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
        }
        else {
            console.log(`Dedicated Student certificate emailed to ${userEmail}`);
        }
    }
}
