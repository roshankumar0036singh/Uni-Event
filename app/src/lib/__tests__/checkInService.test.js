import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkInParticipant, syncOfflineCheckIns } from '../checkInService';
import { doc, getDoc, increment, runTransaction, setDoc, updateDoc } from 'firebase/firestore';

let mockTransaction;

jest.mock('firebase/firestore', () => ({
    doc: jest.fn((_db, ...segments) => ({ path: segments.join('/') })),
    getDoc: jest.fn(),
    serverTimestamp: jest.fn(() => 'mock-timestamp'),
    increment: jest.fn(value => ({ type: 'increment', value })),
    runTransaction: jest.fn(async (_db, transactionHandler) => transactionHandler(mockTransaction)),
    setDoc: jest.fn(),
    updateDoc: jest.fn(),
    Timestamp: {
        fromDate: jest.fn(date => ({ date })),
    },
}));

jest.mock('../firebaseConfig', () => ({
    db: {},
}));

jest.mock('../logger', () => ({
    error: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

const snapshot = (exists, data = {}) => ({
    exists: () => exists,
    data: () => data,
});

const setTransactionSnapshots = ({ participantExists = true, checkInExists = false } = {}) => {
    mockTransaction.get.mockImplementation(ref => {
        if (ref.path === 'events/event-1/participants/user-1') {
            return Promise.resolve(
                snapshot(participantExists, {
                    name: 'Registered Name',
                    email: 'registered@example.com',
                    year: '3',
                    branch: 'CSE',
                }),
            );
        }

        if (ref.path === 'events/event-1/checkIns/user-1') {
            return Promise.resolve(snapshot(checkInExists));
        }

        return Promise.resolve(snapshot(false));
    });
};

describe('checkInParticipant', () => {
    beforeEach(() => {
        mockTransaction = {
            get: jest.fn(),
            set: jest.fn(),
            update: jest.fn(),
        };

        jest.clearAllMocks();
        setDoc.mockResolvedValue(undefined);
        updateDoc.mockResolvedValue(undefined);
        AsyncStorage.setItem.mockResolvedValue(undefined);
        AsyncStorage.removeItem.mockResolvedValue(undefined);
        setTransactionSnapshots();
    });

    it('checks in a registered free RSVP participant without a ticket document', async () => {
        const result = await checkInParticipant(
            {
                userId: 'user-1',
                userName: 'QR Name',
                userEmail: 'qr@example.com',
            },
            'event-1',
            'organizer-1',
            'Organizer',
        );

        expect(result).toEqual({
            success: true,
            message: 'Registered Name checked in successfully!',
        });

        expect(runTransaction).toHaveBeenCalledTimes(1);
        expect(mockTransaction.get).toHaveBeenCalledWith(
            doc({}, 'events', 'event-1', 'participants', 'user-1'),
        );
        expect(mockTransaction.get).toHaveBeenCalledWith(
            doc({}, 'events', 'event-1', 'checkIns', 'user-1'),
        );
        expect(mockTransaction.set).toHaveBeenCalledWith(
            doc({}, 'events', 'event-1', 'checkIns', 'user-1'),
            expect.objectContaining({
                userId: 'user-1',
                userName: 'Registered Name',
                userEmail: 'registered@example.com',
                userYear: '3',
                userBranch: 'CSE',
                ticketId: null,
                checkedInAt: 'mock-timestamp',
                checkedInBy: 'organizer-1',
                checkedInByName: 'Organizer',
                status: 'checked-in',
            }),
        );
        expect(mockTransaction.set).toHaveBeenCalledWith(
            doc({}, 'events', 'event-1', 'participants', 'user-1'),
            expect.objectContaining({
                checkInStatus: 'checked-in',
                checkedInAt: 'mock-timestamp',
                checkedInBy: 'organizer-1',
            }),
            { merge: true },
        );
        expect(mockTransaction.set).toHaveBeenCalledWith(
            doc({}, 'events', 'event-1'),
            expect.objectContaining({
                stats: {
                    totalCheckedIn: increment(1),
                    lastCheckInAt: 'mock-timestamp',
                },
            }),
            { merge: true },
        );
    });

    it('does not increment attendance for a duplicate participant check-in', async () => {
        setTransactionSnapshots({ checkInExists: true });

        const result = await checkInParticipant(
            {
                userId: 'user-1',
                userName: 'QR Name',
            },
            'event-1',
            'organizer-1',
            'Organizer',
        );

        expect(result).toEqual({
            success: false,
            error: 'Already checked in',
            message: 'This participant is already checked in.',
        });
        expect(mockTransaction.set).not.toHaveBeenCalled();
        expect(mockTransaction.update).not.toHaveBeenCalled();
    });

    it('marks free RSVP participants checked in when syncing offline scans', async () => {
        AsyncStorage.getItem.mockResolvedValueOnce(
            JSON.stringify([
                {
                    userId: 'user-1',
                    userName: 'Offline Attendee',
                    userEmail: 'offline@example.com',
                    queuedAt: '2026-05-28T10:00:00.000Z',
                    ticketId: null,
                },
            ]),
        );
        getDoc.mockResolvedValueOnce(snapshot(false));

        const result = await syncOfflineCheckIns('event-1', 'organizer-1');

        expect(result).toEqual({
            success: true,
            syncedCount: 1,
        });
        expect(setDoc).toHaveBeenCalledWith(
            doc({}, 'events', 'event-1', 'checkIns', 'user-1'),
            expect.objectContaining({
                userId: 'user-1',
                userName: 'Offline Attendee',
                ticketId: null,
                status: 'checked-in',
                checkedInBy: 'organizer-1',
            }),
        );
        expect(updateDoc).toHaveBeenCalledWith(
            doc({}, 'events', 'event-1', 'participants', 'user-1'),
            expect.objectContaining({
                checkInStatus: 'checked-in',
                checkedInBy: 'organizer-1',
            }),
        );
        expect(updateDoc.mock.calls.some(([ref]) => ref.path.startsWith('tickets/'))).toBe(false);
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@offline_checkins_event-1');
    });
});
