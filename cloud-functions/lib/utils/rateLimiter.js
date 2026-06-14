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
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAndUpdateRateLimit = checkAndUpdateRateLimit;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
// Helper to evaluate and update minute rate limit
function evaluateMinuteLimit(userData, nowMillis) {
    let writeCountMinute = userData.writeCountMinute || 0;
    const lastWriteAt = userData.lastWriteAt;
    if (!lastWriteAt) {
        return { allowed: true, writeCountMinute: 1 };
    }
    const lastWriteMillis = lastWriteAt.toDate
        ? lastWriteAt.toDate().getTime()
        : new Date(lastWriteAt).getTime();
    if (nowMillis - lastWriteMillis <= 60000) {
        if (writeCountMinute >= 10) {
            return { allowed: false, writeCountMinute };
        }
        return { allowed: true, writeCountMinute: writeCountMinute + 1 };
    }
    return { allowed: true, writeCountMinute: 1 };
}
// Helper to evaluate and update daily event limit
function evaluateDailyEventLimit(userData, currentDayInt) {
    let eventCountDay = userData.eventCountDay || 0;
    const lastEventDay = userData.lastEventDay || 0;
    if (lastEventDay === currentDayInt) {
        if (eventCountDay >= 5) {
            return { allowed: false, eventCountDay };
        }
        return { allowed: true, eventCountDay: eventCountDay + 1 };
    }
    return { allowed: true, eventCountDay: 1 };
}
/**
 * Checks and updates the database write rate-limiting state stored in the user's document.
 * This runs inside an atomic transaction to prevent write count race conditions.
 *
 * Rules enforced:
 * 1. General Writes: Max 10 writes per user per minute (resets after 60s).
 * 2. Event Creations: Max 5 event creations per day per user (resets daily).
 *
 * Admins are automatically exempt from these rate limits.
 *
 * @param userId Unique identifier of the authenticated user
 * @param isEventCreation Whether the current write is creating a new event record
 * @returns RateLimitResult outlining whether the request is allowed
 */
async function checkAndUpdateRateLimit(userId, isEventCreation = false) {
    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);
    const txResult = await db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        let userData = {};
        if (userDoc.exists) {
            userData = userDoc.data() || {};
        }
        else {
            const now = new Date();
            const currentDayInt = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
            userData = {
                role: 'student',
                writeCountMinute: 1,
                lastWriteAt: firestore_1.Timestamp.now(),
                eventCountDay: isEventCreation ? 1 : 0,
                lastEventDay: currentDayInt,
            };
            transaction.set(userRef, userData, { merge: true });
            return {
                allowed: true,
                statusCode: 200,
                message: 'Initial rate limit profile created',
            };
        }
        const role = userData.role || 'student';
        // Admins are exempt from write rate limits
        if (role === 'admin') {
            return {
                allowed: true,
                statusCode: 200,
                message: 'Admin exempt from write restrictions',
            };
        }
        const now = new Date();
        const nowMillis = now.getTime();
        const currentDayInt = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
        // 1. Evaluate Minute Limit
        const minResult = evaluateMinuteLimit(userData, nowMillis);
        if (!minResult.allowed) {
            return {
                allowed: false,
                statusCode: 429,
                message: 'Too Many Requests: Database write rate limit exceeded (Max 10 per minute).',
            };
        }
        const updates = {
            writeCountMinute: minResult.writeCountMinute,
            lastWriteAt: firestore_1.FieldValue.serverTimestamp(),
        };
        // 2. Evaluate Daily Event Limit
        if (isEventCreation) {
            const dailyResult = evaluateDailyEventLimit(userData, currentDayInt);
            if (!dailyResult.allowed) {
                return {
                    allowed: false,
                    statusCode: 429,
                    message: 'Too Many Requests: Daily event creation limit exceeded (Max 5 per day).',
                    shouldAlert: true,
                    alertData: { userId, eventCountDay: dailyResult.eventCountDay },
                };
            }
            updates.eventCountDay = dailyResult.eventCountDay;
            updates.lastEventDay = currentDayInt;
        }
        // Persist structural updates back to user document atomically
        transaction.update(userRef, updates);
        return { allowed: true, statusCode: 200, message: 'Authorized request within rate limits' };
    });
    // Perform side effects outside the transaction
    if (txResult.shouldAlert) {
        const { logEntry } = require('../logger');
        logEntry('rate-limiter', 'Suspicious activity: Daily event creation limit exceeded', {
            userId: txResult.alertData.userId,
            input: { eventCountDay: txResult.alertData.eventCountDay },
        });
        const { sendEmail } = require('./emailSender');
        sendEmail({
            to: process.env.ADMIN_EMAIL || 'admin@uni-event.com',
            subject: 'Alert: Event Creation Rate Limit Triggered',
            templateName: 'universal_email_template',
            templateData: {
                subject: 'Alert: Event Creation Rate Limit Triggered',
                to_name: 'Admin',
                message: `User ${txResult.alertData.userId} has triggered the daily event creation rate limit (Max 5 per day). Please review this account for suspicious activity.`,
                cert_display: 'none',
                event_title: 'Abuse Detection',
                date: new Date().toLocaleDateString(),
                download_btn_display: 'none',
                browse_btn_display: 'none',
                event_link: '#',
            },
        }).catch((err) => console.error('Failed to send admin alert email:', err));
    }
    return txResult;
}
