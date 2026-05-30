"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendDailyDigest = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const firestore_1 = require("firebase-admin/firestore");
const expo_server_sdk_1 = __importDefault(require("expo-server-sdk"));
const push_1 = require("./utils/push");
const PAGE_SIZE = 500;
function processUserPage(userDoc, count, batch, pageMessages) {
    const userData = userDoc.data();
    if (userData.digestOptIn === false) {
        return;
    }
    const notifRef = userDoc.ref.collection('notifications').doc();
    batch.set(notifRef, {
        title: 'Daily Digest 📅',
        body: `There are ${count} events happening today!`,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        read: false
    });
    const pushToken = userData.pushToken;
    if (pushToken && expo_server_sdk_1.default.isExpoPushToken(pushToken)) {
        pageMessages.push({
            to: pushToken,
            sound: 'default',
            title: 'Daily Digest 📅',
            body: `There are ${count} events happening today!`,
            data: { url: '/home' },
        });
    }
}
exports.sendDailyDigest = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    if (!context.auth.token.admin) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can trigger daily digest.');
    }
    const db = admin.firestore();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const snapshot = await db.collection('events')
        .where('startAt', '>=', today.toISOString())
        .where('startAt', '<', tomorrow.toISOString())
        .get();
    const count = snapshot.size;
    if (count === 0) {
        return { success: true, message: "No events today.", count: 0, processed: 0 };
    }
    let lastDoc = null;
    let processedCount = 0;
    while (true) {
        let query = db
            .collection('users')
            .orderBy(firestore_1.FieldPath.documentId())
            .limit(PAGE_SIZE);
        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }
        const usersSnapshot = await query.get();
        if (usersSnapshot.empty) {
            break;
        }
        const batch = db.batch();
        const pageMessages = [];
        usersSnapshot.forEach(userDoc => processUserPage(userDoc, count, batch, pageMessages));
        await batch.commit();
        if (pageMessages.length > 0) {
            try {
                await (0, push_1.sendPushNotifications)(pageMessages);
            }
            catch (error) {
                functions.logger.error('Daily digest push delivery failed for page', {
                    error,
                    pageSize: usersSnapshot.size,
                    pushMessages: pageMessages.length,
                });
            }
        }
        processedCount += usersSnapshot.size;
        lastDoc = usersSnapshot.docs[usersSnapshot.docs.length - 1];
        if (usersSnapshot.size < PAGE_SIZE) {
            break;
        }
    }
    return { success: true, count, processed: processedCount };
});
