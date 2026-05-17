// EmailJS Configuration
// EmailJS Configuration
const EMAILJS_SERVICE_ID = process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID;
const EMAILJS_PUBLIC_KEY = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY;
const EMAILJS_TEMPLATE_UNIVERSAL = process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_UNIVERSAL; // Unified template
const EMAILJS_TEMPLATE_FEEDBACK = process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_FEEDBACK;

/**
 * Sends an email using EmailJS
 * ... (same)
 */
export const sendEmail = async (
    toName,
    toEmail,
    subject,
    message,
    additionalData = {},
    templateId = EMAILJS_TEMPLATE_UNIVERSAL,
) => {
    const data = {
        service_id: EMAILJS_SERVICE_ID,
        template_id: templateId,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: {
            to_name: toName,
            to_email: toEmail,
            subject: subject,
            message: message,
            ...additionalData,
        },
    };

    try {
        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (response.ok) {
            console.log('Email sent successfully to:', toEmail);
            return true;
        } else {
            const errorText = await response.text();
            console.error('EmailJS Error:', errorText);
            return false;
        }
    } catch (error) {
        console.error('Network Error:', error);
        return false;
    }
};

/**
 * Sends a bulk announcement (Message only)
 */
export const sendBulkAnnouncement = async (participants, subject, message) => {
    let successCount = 0;
    for (const p of participants) {
        if (p.email) {
            // cert_display: 'none' hides the certificate section
            const sent = await sendEmail(
                p.name || 'Participant',
                p.email,
                subject,
                message,

                {
                    cert_display: 'none',
                    event_link: 'https://unievent-ez2w.onrender.com', // Default to home/browse
                    download_btn_display: 'none',
                    browse_btn_display: 'block',
                },
                EMAILJS_TEMPLATE_UNIVERSAL,
            );
            if (sent) successCount++;
        }
    }
    return successCount;
};

/**
 * Sends a bulk feedback request
 */
export const sendBulkFeedbackRequest = async (participants, eventTitle, eventId) => {
    let successCount = 0;
    const feedbackLink = `https://unievent-ez2w.onrender.com/event/${eventId}/feedback`;
    const subject = `Feedback Request: ${eventTitle}`;
    const message = `Thank you for attending ${eventTitle}. Please take a moment to share your feedback.`;

    for (const p of participants) {
        if (p.email) {
            const sent = await sendEmail(
                p.name || 'Participant',
                p.email,
                subject,
                message,
                { event_title: eventTitle, feedback_link: feedbackLink },
                EMAILJS_TEMPLATE_FEEDBACK,
            );
            if (sent) successCount++;
        }
    }
    return successCount;
};

/**
 * Sends bulk certificates (Message + Certificate)
 */
export const sendBulkCertificates = async (participants, eventTitle, date, eventLink) => {
    let successCount = 0;
    const subject = `Certificate of Participation: ${eventTitle}`;
    const message = `We are pleased to present you with this certificate for your participation in ${eventTitle}.`;

    for (const p of participants) {
        if (p.email) {
            // cert_display: 'block' shows the certificate section
            const sent = await sendEmail(
                p.name || 'Participant',
                p.email,
                subject,
                message,
                {
                    event_title: eventTitle,
                    date: date || new Date().toLocaleDateString(),
                    cert_display: 'block',
                    event_link: eventLink || 'https://unievent-ez2w.onrender.com',
                    download_btn_display: 'block',
                    browse_btn_display: 'none',
                },
                EMAILJS_TEMPLATE_UNIVERSAL,
            );
            if (sent) successCount++;
        }
    }
    return successCount;
};
