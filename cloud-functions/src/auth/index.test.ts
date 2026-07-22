import * as admin from 'firebase-admin';
const functionsTest = require('firebase-functions-test');

jest.mock('firebase-admin', () => {
    const setCustomUserClaims = jest.fn().mockResolvedValue(undefined);
    const getUserByEmail = jest.fn();
    const getUser = jest.fn();
    const docSet = jest.fn().mockResolvedValue(undefined);
    const docGet = jest.fn().mockResolvedValue({ exists: true, data: () => ({ role: 'club' }) });

    const doc = jest.fn().mockReturnValue({
        set: docSet,
        get: docGet,
    });

    const collection = jest.fn().mockReturnValue({ doc });

    return {
        apps: [],
        initializeApp: jest.fn(),
        auth: () => ({
            setCustomUserClaims,
            getUserByEmail,
            getUser,
        }),
        firestore: () => ({
            collection,
        }),
    };
});

const testEnv = functionsTest();

import { handoverClubAdmin } from './index';

const wrappedHandoverClubAdmin = testEnv.wrap(handoverClubAdmin as any);

describe('handoverClubAdmin Cloud Function', () => {
    let adminAuthMock: any;

    beforeEach(() => {
        jest.clearAllMocks();
        adminAuthMock = admin.auth();
    });

    afterAll(() => {
        testEnv.cleanup();
    });

    it('throws unauthenticated error when user is not logged in', async () => {
        await expect(wrappedHandoverClubAdmin({}, {})).rejects.toThrow(
            'The function must be called while authenticated.',
        );
    });

    it('throws permission-denied error when caller is not a club admin', async () => {
        const context = {
            auth: {
                uid: 'student123',
                token: { club: false, admin: false },
            },
        };

        const db = admin.firestore();
        (db.collection('users').doc as jest.Mock).mockReturnValueOnce({
            get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ role: 'student' }) }),
        });

        await expect(
            wrappedHandoverClubAdmin({ newAdminEmail: 'newadmin@test.com' }, context),
        ).rejects.toThrow('Only club admins can transfer club admin rights.');
    });

    it('successfully transfers admin rights when given valid newAdminEmail', async () => {
        adminAuthMock.getUserByEmail.mockResolvedValueOnce({ uid: 'target_uid_456' });
        adminAuthMock.getUser.mockResolvedValueOnce({ uid: 'target_uid_456' });

        const context = {
            auth: {
                uid: 'caller_uid_123',
                token: { club: true },
            },
        };

        const result = await wrappedHandoverClubAdmin(
            { newAdminEmail: 'successor@test.com' },
            context,
        );

        expect(adminAuthMock.getUserByEmail).toHaveBeenCalledWith('successor@test.com');
        expect(adminAuthMock.setCustomUserClaims).toHaveBeenCalledWith('target_uid_456', {
            club: true,
        });
        expect(adminAuthMock.setCustomUserClaims).toHaveBeenCalledWith('caller_uid_123', {});
        expect(result).toEqual({
            success: true,
            message: 'Club admin rights transferred successfully.',
            newAdminUid: 'target_uid_456',
            previousAdminUid: 'caller_uid_123',
        });
    });

    it('throws invalid-argument error when target is the caller', async () => {
        adminAuthMock.getUserByEmail.mockResolvedValueOnce({ uid: 'caller_uid_123' });

        const context = {
            auth: {
                uid: 'caller_uid_123',
                token: { club: true },
            },
        };

        await expect(
            wrappedHandoverClubAdmin({ newAdminEmail: 'caller@test.com' }, context),
        ).rejects.toThrow('Cannot handover club admin rights to yourself.');
    });
});
