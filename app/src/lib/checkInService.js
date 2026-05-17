import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    updateDoc,
    increment,
} from 'firebase/firestore';

import { db } from './firebaseConfig';

/**
 * Validate a ticket for check-in
 */
export const validateTicket = async (ticketId, eventId) => {
    try {
        const ticketRef = doc(db, 'tickets', ticketId);
        const ticketSnap = await getDoc(ticketRef);

        if (!ticketSnap.exists()) {
            return {
                valid: false,
                error: 'Ticket not found',
                message: 'This ticket does not exist in our system.',
            };
        }

        const ticketData = ticketSnap.data();

        if (ticketData.eventId !== eventId) {
            return {
                valid: false,
                error: 'Wrong event',
                message: 'This ticket is for a different event.',
            };
        }

        if (ticketData.status !== 'paid') {
            return {
                valid: false,
                error: 'Invalid ticket',
                message: `Ticket status: ${ticketData.status}. Only paid tickets are valid.`,
            };
        }

        if (ticketData.checkInStatus === 'checked-in') {
            return {
                valid: false,
                error: 'Already checked in',
                message: `This attendee was already checked in at ${new Date(
                    ticketData.checkedInAt?.toMillis()
                ).toLocaleTimeString()}.`,
                alreadyCheckedIn: true,
                ticketData,
            };
        }

        return {
            valid: true,
            ticketData: {
                id: ticketId,
                ...ticketData,
            },
        };
    } catch (error) {
        console.error('Ticket validation error:', error);

        return {
            valid: false,
            error: 'Validation failed',
            message:
                'Unable to validate ticket. Please check your connection.',
        };
    }
};

/**
 * Safe location helper
 */
const getLocation = async () => {
    try {
        return await new Promise(resolve => {
            navigator.geolocation.getCurrentPosition(
                position => {
                    resolve({
                        latitude:
                            position.coords.latitude,

                        longitude:
                            position.coords.longitude,
                    });
                },
                () => {
                    resolve({
                        latitude: null,
                        longitude: null,
                    });
                },
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0,
                }
            );
        });
    } catch (err) {
        return {
            latitude: null,
            longitude: null,
        };
    }
};

/**
 * Check in an attendee
 */
export const checkInAttendee = async (
    ticketData,
    eventId,
    organizerId,
    organizerName
) => {
    try {
        const ticketId = ticketData.id;
        const userId = ticketData.userId;

        // Get user location
        const location = await getLocation();

        // Simple universal device ID
        const deviceId =
            `${userId}_${Date.now()}`;

        // QR fingerprint
        const qrId =
            `${ticketId}_${eventId}`;

        // Check-in document
        const checkInRef = doc(
            db,
            'events',
            eventId,
            'checkIns',
            userId
        );

        await setDoc(checkInRef, {
            userId,
            eventId,

            userName:
                ticketData.userName || 'Guest',

            userEmail:
                ticketData.userEmail || '',

            userYear:
                ticketData.userYear || 'N/A',

            userBranch:
                ticketData.userBranch || 'N/A',

            ticketId,

            checkedInAt:
                new Date().toISOString(),

            checkedInBy: organizerId,

            checkedInByName: organizerName,

            status: 'checked-in',

            // Fraud detection metadata
            latitude: location.latitude,
            longitude: location.longitude,
            deviceId,
            qrId,
        });

        // Update ticket
        const ticketRef = doc(
            db,
            'tickets',
            ticketId
        );

        await updateDoc(ticketRef, {
            checkInStatus: 'checked-in',
            checkedInAt: serverTimestamp(),
            checkedInBy: organizerId,
        });

        // Update event stats
        const eventRef = doc(
            db,
            'events',
            eventId
        );

        await updateDoc(eventRef, {
            'stats.totalCheckedIn':
                increment(1),

            'stats.lastCheckInAt':
                serverTimestamp(),
        });

        return {
            success: true,
            message:
                `${ticketData.userName} checked in successfully!`,
        };
    } catch (error) {
        console.error('Check-in error:', error);

        return {
            success: false,
            error: 'Check-in failed',
            message:
                'Unable to complete check-in. Please try again.',
        };
    }
};

/**
 * Get attendance statistics
 */
export const getAttendanceStats = async eventId => {
    try {
        const eventRef = doc(db, 'events', eventId);

        const eventSnap = await getDoc(eventRef);

        if (!eventSnap.exists()) {
            return null;
        }

        const eventData = eventSnap.data();

        const stats = eventData.stats || {};

        const totalRegistrations =
            stats.totalRegistrations || 0;

        const totalCheckedIn =
            stats.totalCheckedIn || 0;

        const checkInRate =
            totalRegistrations > 0
                ? (
                      (totalCheckedIn /
                          totalRegistrations) *
                      100
                  ).toFixed(1)
                : 0;

        return {
            totalRegistrations,
            totalCheckedIn,

            checkInRate:
                parseFloat(checkInRate),

            lastCheckInAt:
                stats.lastCheckInAt,

            pending:
                totalRegistrations -
                totalCheckedIn,
        };
    } catch (error) {
        console.error(
            'Error fetching stats:',
            error
        );

        return null;
    }
};

/**
 * Parse QR code data
 */
export const parseQRCode = qrData => {
    try {
        const data = JSON.parse(qrData);

        if (
            !data.ticketId ||
            !data.eventId
        ) {
            return {
                valid: false,
                error:
                    'Invalid QR code format',
            };
        }

        return {
            valid: true,
            ticketId: data.ticketId,
            eventId: data.eventId,
            userId: data.userId,
            attendeeName:
                data.attendeeName,
            attendeeEmail:
                data.attendeeEmail,
            year: data.year,
            branch: data.branch,
        };
    } catch (error) {
        return {
            valid: false,
            error:
                'Unable to parse QR code',
        };
    }
};