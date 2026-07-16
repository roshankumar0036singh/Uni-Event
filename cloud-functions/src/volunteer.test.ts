import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
const functionsTest = require('firebase-functions-test');

// Mock firebase-admin completely
jest.mock('firebase-admin', () => {
    const getMock = jest.fn();
    const setMock = jest.fn();
    const updateMock = jest.fn();

    const whereMock = jest.fn(() => ({
        where: whereMock,
        get: getMock,
    }));

    const collectionMock = jest.fn(() => ({
        doc: docMock,
        where: whereMock,
    }));

    const docMock = jest.fn(() => ({
        get: getMock,
        set: setMock,
        update: updateMock,
        collection: collectionMock,
    }));

    const runTransactionMock = jest.fn(callback => {
        const transaction = {
            get: getMock,
            set: setMock,
            update: updateMock,
        };
        return callback(transaction);
    });

    return {
        apps: [],
        initializeApp: jest.fn(),
        firestore: jest.fn(() => ({
            collection: collectionMock,
            runTransaction: runTransactionMock,
        })),
    };
});

jest.mock('firebase-admin/firestore', () => ({
    FieldValue: {
        serverTimestamp: jest.fn(() => 'mocked-timestamp'),
    },
}));

const testEnv = functionsTest();

import { draftVolunteer, awardVolunteerPoints, dropVolunteer } from './volunteer';

const wrappedDraftVolunteer = testEnv.wrap(draftVolunteer as any);
const wrappedAwardVolunteerPoints = testEnv.wrap(awardVolunteerPoints as any);
const wrappedDropVolunteer = testEnv.wrap(dropVolunteer as any);

describe('Volunteer Functions', () => {
    let db: any;

    beforeEach(() => {
        jest.clearAllMocks();
        db = admin.firestore();
    });

    describe('draftVolunteer', () => {
        it('throws unauthenticated if no auth context', async () => {
            const mockContext = { auth: undefined };
            await expect(
                wrappedDraftVolunteer({ eventId: 'event1', userId: 'user1' }, mockContext),
            ).rejects.toThrow(
                new functions.https.HttpsError('unauthenticated', 'Must be logged in.'),
            );
        });

        it('drafts a volunteer if caller is admin', async () => {
            const mockContext = { auth: { uid: 'admin_uid', token: { admin: true } } };

            const docMock = db.collection().doc;
            const setMock = docMock().set;

            // When admin, checkEventOwnership doesn't even fetch the event
            await wrappedDraftVolunteer({ eventId: 'event1', userId: 'user1' }, mockContext);

            expect(setMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'drafted',
                    addedBy: 'admin_uid',
                }),
            );
        });
    });

    describe('awardVolunteerPoints', () => {
        it('throws invalid argument if remark is invalid', async () => {
            const mockContext = { auth: { uid: 'owner1', token: {} } };
            await expect(
                wrappedAwardVolunteerPoints(
                    { eventId: 'e1', userId: 'u1', remark: 'super_hard' },
                    mockContext,
                ),
            ).rejects.toThrow(
                new functions.https.HttpsError(
                    'invalid-argument',
                    'Invalid remark. Must be easy, hard, or major.',
                ),
            );
        });

        it('awards points successfully for a valid remark', async () => {
            const mockContext = { auth: { uid: 'admin_uid', token: { admin: true } } };

            const docMock = db.collection().doc;
            const getMock = docMock().get;
            const setMock = docMock().set;
            const updateMock = docMock().update;

            // Mock the volunteer document exists and is not dropped
            getMock.mockResolvedValueOnce({
                exists: true,
                data: () => ({ status: 'active' }),
            });

            // Mock user document exists in transaction
            getMock.mockResolvedValueOnce({
                exists: true,
                data: () => ({
                    reputation: {
                        attendanceCount: 1,
                        registrationCount: 0,
                        remindersSet: 0,
                        volunteerPoints: 0,
                    },
                }),
            });

            const res = await wrappedAwardVolunteerPoints(
                { eventId: 'e1', userId: 'u1', remark: 'easy' },
                mockContext,
            );

            expect(res.success).toBe(true);
            // It should update the user's reputation.
            // previous points = 1*10 = 10. new volunteer points = 5 ('easy'). total = 15.
            expect(updateMock).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    'reputation.points': 15,
                    'reputation.volunteerPoints': 5,
                }),
            );
        });
    });

    describe('dropVolunteer', () => {
        it('throws invalid argument if missing params', async () => {
            const mockContext = { auth: { uid: 'owner1', token: {} } };
            await expect(wrappedDropVolunteer({ eventId: 'e1' }, mockContext)).rejects.toThrow(
                new functions.https.HttpsError(
                    'invalid-argument',
                    'eventId and userId are required.',
                ),
            );
        });

        it('drops volunteer and revokes points successfully', async () => {
            const mockContext = { auth: { uid: 'admin_uid', token: { admin: true } } };

            const docMock = db.collection().doc;
            const getMock = docMock().get;
            const setMock = docMock().set;
            const updateMock = docMock().update;

            // Mock the volunteerLogs query snapshot
            getMock.mockResolvedValueOnce({
                docs: [
                    { data: () => ({ action: 'awarded', points: 10 }) },
                    { data: () => ({ action: 'awarded', points: 5 }) },
                ],
            });

            // Mock user document exists in transaction
            getMock.mockResolvedValueOnce({
                exists: true,
                data: () => ({
                    reputation: {
                        attendanceCount: 1,
                        registrationCount: 0,
                        remindersSet: 0,
                        volunteerPoints: 15,
                    },
                }),
            });

            const res = await wrappedDropVolunteer(
                { eventId: 'e1', userId: 'u1', revokePoints: true },
                mockContext,
            );

            expect(res.success).toBe(true);
            // It should update the volunteer status to dropped
            expect(setMock).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    status: 'dropped',
                }),
                { merge: true },
            );

            // It should revoke 15 points
            expect(updateMock).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    'reputation.points': 10, // 1 attendance = 10, new volunteerPoints = 0
                    'reputation.volunteerPoints': 0,
                }),
            );
        });
    });
});
