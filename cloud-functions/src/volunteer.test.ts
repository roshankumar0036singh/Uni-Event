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
            try {
                await wrappedDraftVolunteer({ eventId: 'event1', userId: 'user1' }, mockContext);
                fail('Expected to throw unauthenticated');
            } catch (e: any) {
                expect(e.code).toBe('unauthenticated');
            }
        });

        it('drafts a volunteer if caller is admin', async () => {
            const mockContext = { auth: { uid: 'admin_uid', token: { admin: true } } };

            const docMock = db.collection().doc;
            const getMock = docMock().get;
            const setMock = docMock().set;

            // Mock eventDoc exists, userDoc exists, and eventVolunteerDoc does not exist
            getMock
                .mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'some_owner' }) }) // eventDoc
                .mockResolvedValueOnce({ exists: true, data: () => ({}) }) // userDoc
                .mockResolvedValueOnce({ exists: false, data: () => ({}) }); // eventVolunteerDoc

            await wrappedDraftVolunteer({ eventId: 'event1', userId: 'user1' }, mockContext);

            expect(setMock).toHaveBeenCalledWith(
                expect.anything(),
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
            try {
                await wrappedAwardVolunteerPoints(
                    { eventId: 'e1', userId: 'u1', remark: 'super_hard' },
                    mockContext,
                );
                fail('Expected to throw invalid-argument');
            } catch (e: any) {
                expect(e.code).toBe('invalid-argument');
            }
        });

        it('awards points successfully for a valid remark', async () => {
            const mockContext = { auth: { uid: 'admin_uid', token: { admin: true } } };

            const docMock = db.collection().doc;
            const getMock = docMock().get;
            const updateMock = docMock().update;

            getMock
                .mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'some_owner' }) }) // eventDoc
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({ status: 'active' }),
                })
                .mockResolvedValueOnce({
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
            try {
                await wrappedDropVolunteer({ eventId: 'e1' }, mockContext);
                fail('Expected to throw invalid-argument');
            } catch (e: any) {
                expect(e.code).toBe('invalid-argument');
            }
        });

        it('drops volunteer and revokes points successfully', async () => {
            const mockContext = { auth: { uid: 'admin_uid', token: { admin: true } } };

            const docMock = db.collection().doc;
            const getMock = docMock().get;
            const setMock = docMock().set;
            const updateMock = docMock().update;

            getMock
                .mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'some_owner' }) }) // eventDoc
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({ status: 'active' }),
                })
                .mockResolvedValueOnce({
                    docs: [
                        { data: () => ({ action: 'awarded', points: 10 }) },
                        { data: () => ({ action: 'awarded', points: 5 }) },
                    ],
                })
                .mockResolvedValueOnce({
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
            expect(setMock).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    status: 'dropped',
                }),
                { merge: true },
            );

            expect(updateMock).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    'reputation.points': 10,
                    'reputation.volunteerPoints': 0,
                }),
            );
        });
    });
});
