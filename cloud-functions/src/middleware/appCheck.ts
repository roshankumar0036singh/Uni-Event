import * as functions from "firebase-functions"

export function enforceAppCheck(context: functions.https.CallableContext): void {
    if (process.env.ENABLE_APP_CHECK === 'false') {
        return;
    }

    if (!context.app) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Request is missing a valid App Check token.'
        );
    }

}