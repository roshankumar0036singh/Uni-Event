import { httpsCallable } from 'firebase/functions';
import { functions } from './firebaseConfig';
import logger from './logger';
import { BASE_URL } from './config';

// EmailJS Configuration (Used for client-side single emails)
const EMAILJS_SERVICE_ID = process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID;
const EMAILJS_PUBLIC_KEY = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY;
const EMAILJS_TEMPLATE_UNIVERSAL = process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_UNIVERSAL; // Unified template
const EMAILJS_TEMPLATE_FEEDBACK = process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_FEEDBACK;

/**
 * Sends an email using EmailJS
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
            logger.debug('Email sent successfully');
            return true;
        } else {
            const errorText = await response.text();
            logger.error('EmailJS Error:', errorText);
            return false;
        }
    } catch (error) {
        logger.error('Network Error:', error);
        return false;
    }
};

/**
 * Sends a bulk announcement (Message only)
 */
export const sendBulkAnnouncement = async (participants, subject, message) => {
    try {
        const sendBulkEmails = httpsCallable(functions, 'sendBulkEmails');
        const response = await sendBulkEmails({
            participants,
            subject,
            message,
            templateId: EMAILJS_TEMPLATE_UNIVERSAL,
            templateData: {
                cert_display: 'none',
                event_link: BASE_URL,
                download_btn_display: 'none',
                browse_btn_display: 'block',
            },
        });
        return response.data;
    } catch (error) {
        logger.error('Failed to send bulk announcement:', error);
        throw error;
    }
};

/**
 * Sends a bulk feedback request
 */
export const sendBulkFeedbackRequest = async (participants, eventTitle, eventId) => {
    const feedbackLink = `${BASE_URL}/event/${eventId}/feedback`;
    const subject = `Feedback Request: ${eventTitle}`;
    const message = `Thank you for attending ${eventTitle}. Please take a moment to share your feedback.`;

    try {
        const sendBulkEmails = httpsCallable(functions, 'sendBulkEmails');
        const response = await sendBulkEmails({
            participants,
            subject,
            message,
            templateId: EMAILJS_TEMPLATE_FEEDBACK,
            templateData: {
                event_title: eventTitle,
                feedback_link: feedbackLink,
            },
        });
        return response.data;
    } catch (error) {
        logger.error('Failed to send bulk feedback request:', error);
        throw error;
    }
};

/**
 * Sends bulk certificates (Message + Certificate)
 */
export const sendBulkCertificates = async (participants, eventTitle, date, eventLink) => {
    const subject = `Certificate of Participation: ${eventTitle}`;
    const message = `We are pleased to present you with this certificate for your participation in ${eventTitle}.`;

    const buildLinkedInUrl = (participant, eventStartDate) => {
        const certUrl = participant.certificateUrl || eventLink || BASE_URL;
        const org = participant.organization || 'UniEvent';
        let issueDate = new Date();
        if (eventStartDate) {
            const d = new Date(eventStartDate);
            if (!Number.isNaN(d.getTime())) issueDate = d;
        }
        const issueYear = issueDate.getUTCFullYear();
        const issueMonth = issueDate.getUTCMonth() + 1;

        return `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(
            eventTitle,
        )}&organizationName=${encodeURIComponent(org)}&issueYear=${issueYear}&issueMonth=${issueMonth}&certUrl=${encodeURIComponent(
            certUrl,
        )}`;
    };

    const formattedParticipants = participants.map(p => {
        const certificateUrl = buildLinkedInUrl(p, date);
        return {
            ...p,
            templateData: {
                event_link: certificateUrl,
                linkedin_url: certificateUrl,
            },
        };
    });

    try {
        const sendBulkEmails = httpsCallable(functions, 'sendBulkEmails');
        const response = await sendBulkEmails({
            participants: formattedParticipants,
            subject,
            message,
            templateId: EMAILJS_TEMPLATE_UNIVERSAL,
            templateData: {
                event_title: eventTitle,
                date: date || new Date().toLocaleDateString(),
                cert_display: 'block',
                download_btn_display: 'block',
                browse_btn_display: 'none',
            },
        });
        return response.data;
    } catch (error) {
        logger.error('Failed to send bulk certificates:', error);
        throw error;
    }
};
