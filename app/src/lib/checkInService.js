import { doc, getDoc, setDoc, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { db } from './firebaseConfig';

/**
 * Validate a ticket for check-in
 */
export const validateTicket = async (ticketId, eventId) => {
    try {
        // Fetch ticket from Firestore
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

        // Verify ticket belongs to this event
        if (ticketData.eventId !== eventId) {
            return {
                valid: false,
                error: 'Wrong event',
                message: 'This ticket is for a different event.',
            };
        }

        // Check if ticket is paid
        if (ticketData.status !== 'paid') {
            return {
                valid: false,
                error: 'Invalid ticket',
                message: `Ticket status: ${ticketData.status}. Only paid tickets are valid.`,
            };
        }

        // Check if already checked in
        if (ticketData.checkInStatus === 'checked-in') {
            return {
                valid: false,
                error: 'Already checked in',
                message: `This attendee was already checked in at ${new Date(ticketData.checkedInAt?.toMillis()).toLocaleTimeString()}.`,
                alreadyCheckedIn: true,
                ticketData,
            };
        }

        // Ticket is valid
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
            message: 'Unable to validate ticket. Please check your connection.',
        };
    }
};

/**
 * Check in an attendee
 */
export const checkInAttendee = async (ticketData, eventId, organizerId, organizerName) => {
    try {
        const ticketId = ticketData.id;
        const userId = ticketData.userId;

        // Create check-in record
        const checkInRef = doc(db, 'events', eventId, 'checkIns', userId);
        await setDoc(checkInRef, {
            userId,
            userName: ticketData.userName || 'Guest',
            userEmail: ticketData.userEmail || '',
            userYear: ticketData.userYear || 'N/A',
            userBranch: ticketData.userBranch || 'N/A',
            ticketId,
            checkedInAt: serverTimestamp(),
            checkedInBy: organizerId,
            checkedInByName: organizerName,
            status: 'checked-in',
        });

        // Update ticket status
        const ticketRef = doc(db, 'tickets', ticketId);
        await updateDoc(ticketRef, {
            checkInStatus: 'checked-in',
            checkedInAt: serverTimestamp(),
            checkedInBy: organizerId,
        });

        // Update event stats
        const eventRef = doc(db, 'events', eventId);
        await updateDoc(eventRef, {
            'stats.totalCheckedIn': increment(1),
            'stats.lastCheckInAt': serverTimestamp(),
        });

        return {
            success: true,
            message: `${ticketData.userName} checked in successfully!`,
        };
    } catch (error) {
        console.error('Check-in error:', error);
        return {
            success: false,
            error: 'Check-in failed',
            message: 'Unable to complete check-in. Please try again.',
        };
    }
};

/**
 * Get attendance statistics for an event
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

        const totalRegistrations = stats.totalRegistrations || 0;
        const totalCheckedIn = stats.totalCheckedIn || 0;
        const checkInRate =
            totalRegistrations > 0 ? ((totalCheckedIn / totalRegistrations) * 100).toFixed(1) : 0;

        return {
            totalRegistrations,
            totalCheckedIn,
            checkInRate: parseFloat(checkInRate),
            lastCheckInAt: stats.lastCheckInAt,
            pending: totalRegistrations - totalCheckedIn,
        };
    } catch (error) {
        console.error('Error fetching stats:', error);
        return null;
    }
};

/**
 * Parse QR code data
 */
export const parseQRCode = qrData => {
    try {
        const data = JSON.parse(qrData);

        if (!data.ticketId || !data.eventId) {
            return {
                valid: false,
                error: 'Invalid QR code format',
            };
        }

        return {
            valid: true,
            ticketId: data.ticketId,
            eventId: data.eventId,
            userId: data.userId,
            attendeeName: data.attendeeName,
            attendeeEmail: data.attendeeEmail,
            year: data.year,
            branch: data.branch,
        };
    } catch (_error) {
        return {
            valid: false,
            error: 'Unable to parse QR code',
        };
    }
};
