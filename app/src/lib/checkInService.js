import logger from './logger';
import {
    doc,
    getDoc,
    serverTimestamp,
    increment,
    runTransaction,
    setDoc,
    updateDoc,
    Timestamp,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
        logger.error('Ticket validation error:', error);
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

        await runTransaction(db, async transaction => {
            const ticketRef = doc(db, 'tickets', ticketId);
            const ticketSnap = await transaction.get(ticketRef);

            if (!ticketSnap.exists()) {
                throw new Error('Ticket not found');
            }

            const freshTicket = ticketSnap.data();
            if (freshTicket.eventId !== eventId || freshTicket.status !== 'paid') {
                throw new Error('Ticket is no longer eligible for check-in');
            }
            if (freshTicket.checkInStatus === 'checked-in') {
                throw new Error('Ticket already checked in');
            }

            const checkInRef = doc(db, 'events', eventId, 'checkIns', userId);
            const eventRef = doc(db, 'events', eventId);
            const userRef = doc(db, 'users', userId);

            transaction.set(checkInRef, {
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

            transaction.update(ticketRef, {
                checkInStatus: 'checked-in',
                checkedInAt: serverTimestamp(),
                checkedInBy: organizerId,
            });

            transaction.update(eventRef, {
                'stats.totalCheckedIn': increment(1),
                'stats.lastCheckInAt': serverTimestamp(),
            });

            transaction.set(
                userRef,
                {
                    lastActive: serverTimestamp(),
                },
                { merge: true },
            );
        });

        return {
            success: true,
            message: `${ticketData.userName} checked in successfully!`,
        };
    } catch (error) {
        logger.error('Check-in error:', error);
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
        logger.error('Error fetching stats:', error);
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
        console.warn('QR parse failed:', _error);
        return {
            valid: false,
            error: 'Unable to parse QR code',
        };
    }
};

const getOfflineQueueKey = eventId => `@offline_checkins_${eventId}`;

export const queueOfflineCheckIn = async (eventId, checkInData) => {
    try {
        const key = getOfflineQueueKey(eventId);
        const existingQueueStr = await AsyncStorage.getItem(key);
        const queue = existingQueueStr ? JSON.parse(existingQueueStr) : [];

        if (!queue.some(item => item.userId === checkInData.userId)) {
            queue.push({
                ...checkInData,
                queuedAt: new Date().toISOString(),
            });
            await AsyncStorage.setItem(key, JSON.stringify(queue));
        }
        return true;
    } catch (e) {
        console.error('Failed to queue offline check-in', e);
        return false;
    }
};

export const getOfflineCheckInCount = async eventId => {
    try {
        const key = getOfflineQueueKey(eventId);
        const existingQueueStr = await AsyncStorage.getItem(key);
        if (!existingQueueStr) return 0;
        const queue = JSON.parse(existingQueueStr);
        return queue.length;
    } catch (err) {
        console.error('Failed to get offline count:', err);
        return 0;
    }
};

const syncOfflineCheckInItem = async (item, eventId, organizerId) => {
    const checkInRef = doc(db, 'events', eventId, 'checkIns', item.userId);
    const checkInSnap = await getDoc(checkInRef);
    if (!checkInSnap.exists()) {
        const offlineCheckedInAt = item.queuedAt
            ? Timestamp.fromDate(new Date(item.queuedAt))
            : serverTimestamp();

        await setDoc(checkInRef, {
            userId: item.userId,
            userName: item.userName || 'Guest',
            userEmail: item.userEmail || '',
            userBranch: item.userBranch || 'N/A',
            userYear: item.userYear || 'N/A',
            checkedInAt: offlineCheckedInAt,
            checkedInBy: organizerId,
            checkedInByName: item.organizerName || organizerId,
            ticketId: item.ticketId || null,
            status: 'checked-in',
            syncedOffline: true,
        });

        if (item.ticketId) {
            await updateDoc(doc(db, 'tickets', item.ticketId), {
                checkInStatus: 'checked-in',
                checkedInAt: offlineCheckedInAt,
                checkedInBy: organizerId,
            }).catch(() => {});
        }

        await updateDoc(doc(db, 'events', eventId), {
            'stats.totalCheckedIn': increment(1),
            'stats.lastCheckInAt': serverTimestamp(),
        }).catch(() => {});

        const registrationRef = doc(db, 'events', eventId, 'registrations', item.userId);
        await updateDoc(registrationRef, { status: 'attended' }).catch(() => {});
    }
};

export const syncOfflineCheckIns = async (eventId, organizerId) => {
    try {
        const key = getOfflineQueueKey(eventId);
        const existingQueueStr = await AsyncStorage.getItem(key);
        if (!existingQueueStr) return { success: true, syncedCount: 0 };

        const queue = JSON.parse(existingQueueStr);
        if (queue.length === 0) return { success: true, syncedCount: 0 };

        let syncedCount = 0;
        let failedQueue = [];

        for (const item of queue) {
            try {
                await syncOfflineCheckInItem(item, eventId, organizerId);
                syncedCount++;
            } catch (err) {
                console.error('Failed to sync item', err);
                failedQueue.push(item);
            }
        }

        if (failedQueue.length > 0) {
            await AsyncStorage.setItem(key, JSON.stringify(failedQueue));
            return { success: false, syncedCount, remainingCount: failedQueue.length };
        } else {
            await AsyncStorage.removeItem(key);
            return { success: true, syncedCount };
        }
    } catch (e) {
        console.error('Sync error', e);
        return { success: false, syncedCount: 0, error: e };
    }
};
