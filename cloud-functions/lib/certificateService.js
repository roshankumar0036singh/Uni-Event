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
exports.sendCertificatesForEvent = sendCertificatesForEvent;
const admin = __importStar(require("firebase-admin"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const pdf_lib_1 = require("pdf-lib");
const resend_1 = require("resend");
const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
async function sendCertificatesForEvent(eventId, ownerId) {
    // 1. Fetch Event Details
    const eventDoc = await admin.firestore().collection('events').doc(eventId).get();
    if (!eventDoc.exists)
        throw new Error("Event not found");
    const event = eventDoc.data();
    if ((event === null || event === void 0 ? void 0 : event.ownerId) !== ownerId) {
        throw new Error("Unauthorized: Only the event owner can send certificates.");
    }
    // 2. Fetch Participants
    const participantsSnap = await admin.firestore().collection(`events/${eventId}/participants`).get();
    if (participantsSnap.empty)
        throw new Error("No participants registered for this event.");
    const participants = participantsSnap.docs.map(doc => doc.data());
    // 3. Load Template
    // Using a reliable path for assets
    const templatePath = path.join(__dirname, '../assets/certificate_template.pdf');
    let templateBytes;
    try {
        templateBytes = fs.readFileSync(templatePath);
    }
    catch (e) {
        throw new Error("Certificate Template not found. Please ensure 'assets/certificate_template.pdf' exists in cloud-functions.");
    }
    const results = [];
    // 4. Process Each Participant
    for (const p of participants) {
        try {
            if (!p.email || !p.name)
                continue;
            // Generate PDF
            const pdfDoc = await pdf_lib_1.PDFDocument.load(templateBytes);
            const pages = pdfDoc.getPages();
            const firstPage = pages[0];
            const { width, height } = firstPage.getSize();
            const font = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.HelveticaBold);
            const regularFont = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.Helvetica);
            // Draw Name (Centered)
            const nameSize = 40;
            const nameWidth = font.widthOfTextAtSize(p.name, nameSize);
            firstPage.drawText(p.name, {
                x: (width - nameWidth) / 2,
                y: height / 2 - 20, // Lowered position
                size: nameSize,
                font: font,
                color: (0, pdf_lib_1.rgb)(1, 1, 1), // White
            });
            // Draw Event Name
            const eventNameSize = 20;
            const eventName = event.title || "Event";
            const eventWidth = regularFont.widthOfTextAtSize(eventName, eventNameSize);
            firstPage.drawText(eventName, {
                x: (width - eventWidth) / 2,
                y: height / 2 - 80, // Lowered position
                size: eventNameSize,
                font: regularFont,
                color: (0, pdf_lib_1.rgb)(1, 1, 1), // White
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
            }
            else {
                console.log(`Sent to ${p.email}`);
                results.push({ email: p.email, status: 'success', id: data === null || data === void 0 ? void 0 : data.id });
            }
        }
        catch (err) {
            console.error(`Error processing ${p.email}:`, err);
            results.push({ email: p.email, status: 'error', error: err.message });
        }
    }
    // 5. Update Event Status
    await admin.firestore().collection('events').doc(eventId).update({
        certificatesSent: true,
        certificatesSentAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { total: participants.length, results };
}
//# sourceMappingURL=certificateService.js.map