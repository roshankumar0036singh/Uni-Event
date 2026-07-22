import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { validateSchema } from '../validation/validate';
import { handoverClubAdminSchema } from '../validation/schemas';

async function getCallerPermissions(callerUid: string) {
    const callerDoc = await admin.firestore().collection('users').doc(callerUid).get();
    const callerRole = callerDoc.data()?.role;
    const isClubAdmin = callerRole === 'club' || callerRole === 'admin';
    const callerIsSystemAdmin = callerRole === 'admin';
    return { isClubAdmin, callerIsSystemAdmin };
}

async function resolveTargetUid(newAdminUid?: string, newAdminEmail?: string): Promise<string> {
    if (newAdminUid) {
        if (!newAdminEmail) {
            try {
                await admin.auth().getUser(newAdminUid);
            } catch (error: any) {
                if (error.code === 'auth/user-not-found') {
                    throw new functions.https.HttpsError(
                        'not-found',
                        `Target user with ID ${newAdminUid} not found.`,
                    );
                }
                throw new functions.https.HttpsError(
                    'internal',
                    'Error looking up target user.',
                    error,
                );
            }
        }
        return newAdminUid;
    }

    if (newAdminEmail) {
        try {
            const userRecord = await admin.auth().getUserByEmail(newAdminEmail);
            return userRecord.uid;
        } catch (error: any) {
            if (error.code === 'auth/user-not-found' || error.code === 'auth/email-not-found') {
                throw new functions.https.HttpsError(
                    'not-found',
                    `User with email ${newAdminEmail} not found.`,
                );
            }
            throw new functions.https.HttpsError(
                'internal',
                'Error looking up user by email.',
                error,
            );
        }
    }

    throw new functions.https.HttpsError(
        'invalid-argument',
        'Target user UID or Email must be provided.',
    );
}

async function executeRoleTransfer(
    callerUid: string,
    targetUid: string,
    callerIsSystemAdmin: boolean,
) {
    const [targetUserRecord, callerUserRecord] = await Promise.all([
        admin.auth().getUser(targetUid),
        admin.auth().getUser(callerUid),
    ]);

    const targetCurrentClaims = targetUserRecord.customClaims || {};
    const callerCurrentClaims = callerUserRecord.customClaims || {};

    const newCallerClaims = callerIsSystemAdmin
        ? { ...callerCurrentClaims, club: false, admin: true }
        : { ...callerCurrentClaims, club: false };
    const newCallerRole = callerIsSystemAdmin ? 'admin' : 'student';

    await Promise.all([
        admin.auth().setCustomUserClaims(targetUid, { ...targetCurrentClaims, club: true }),
        admin.auth().setCustomUserClaims(callerUid, newCallerClaims),
    ]);

    await admin.firestore().runTransaction(async transaction => {
        transaction.set(
            admin.firestore().collection('users').doc(targetUid),
            { role: 'club' },
            { merge: true },
        );
        transaction.set(
            admin.firestore().collection('users').doc(callerUid),
            { role: newCallerRole },
            { merge: true },
        );
    });

    await Promise.all([
        admin.auth().revokeRefreshTokens(callerUid),
        admin.auth().revokeRefreshTokens(targetUid),
    ]);

    return newCallerRole;
}

export const handoverClubAdmin = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'The function must be called while authenticated.',
        );
    }

    const callerUid = context.auth.uid;
    const { isClubAdmin, callerIsSystemAdmin } = await getCallerPermissions(callerUid);

    if (!isClubAdmin) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'Only club admins can transfer club admin rights.',
        );
    }

    const { newAdminUid, newAdminEmail } = validateSchema(handoverClubAdminSchema, data);
    const targetUid = await resolveTargetUid(newAdminUid, newAdminEmail);

    if (targetUid === callerUid) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Cannot handover club admin rights to yourself.',
        );
    }

    try {
        await executeRoleTransfer(callerUid, targetUid, callerIsSystemAdmin);

        return {
            success: true,
            message: 'Club admin rights transferred successfully.',
            newAdminUid: targetUid,
            previousAdminUid: callerUid,
        };
    } catch (error) {
        console.error('handoverClubAdmin failed:', error);
        throw new functions.https.HttpsError(
            'internal',
            'Error transferring club admin rights.',
            error,
        );
    }
});

export const transferClubAdmin = handoverClubAdmin;
