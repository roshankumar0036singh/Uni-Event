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
exports.RATE_LIMITS = void 0;
exports.checkRateLimit = checkRateLimit;
exports.cleanupOldRateLimits = cleanupOldRateLimits;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
exports.RATE_LIMITS = {
    ADMIN_WRITE: {
        windowMs: 60 * 1000,
        maxRequests: 10,
    },
    WRITE: {
        windowMs: 60 * 1000,
        maxRequests: 20,
    },
    READ: {
        windowMs: 60 * 1000,
        maxRequests: 100,
    },
};
async function checkRateLimit(userId, functionName, config) {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    // Sanitize functionName to prevent injection
    const sanitizedFunctionName = functionName.replace(/[^a-zA-Z0-9_-]/g, '');
    const rateLimitRef = admin
        .firestore()
        .collection('rate_limits')
        .doc(`${userId}_${sanitizedFunctionName}`);
    try {
        await admin.firestore().runTransaction(async (transaction) => {
            const doc = await transaction.get(rateLimitRef);
            if (doc.exists) {
                const data = doc.data();
                if (data?.requests) {
                    const recentRequests = data.requests.filter((timestamp) => timestamp > windowStart);
                    if (recentRequests.length >= config.maxRequests) {
                        const oldestRequest = recentRequests[0];
                        const retryAfterMs = oldestRequest + config.windowMs - now;
                        const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
                        console.warn('Rate limit exceeded', {
                            userId,
                            functionName: sanitizedFunctionName,
                            retryAfterSeconds,
                            maxRequests: config.maxRequests,
                            windowSeconds: config.windowMs / 1000,
                            docId: rateLimitRef.id,
                        });
                        throw new functions.https.HttpsError('resource-exhausted', `Rate limit exceeded. You can try again in ${retryAfterSeconds} seconds.`, {
                            retryAfter: retryAfterSeconds,
                            limit: config.maxRequests,
                            window: config.windowMs / 1000,
                        });
                    }
                    recentRequests.push(now);
                    transaction.set(rateLimitRef, {
                        requests: recentRequests,
                        lastUpdated: now,
                    });
                }
                else {
                    transaction.set(rateLimitRef, {
                        requests: [now],
                        lastUpdated: now,
                    });
                }
            }
            else {
                transaction.set(rateLimitRef, {
                    requests: [now],
                    lastUpdated: now,
                });
            }
        });
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        console.error('Rate limit check failed:', error);
        throw new functions.https.HttpsError('internal', 'Rate limit check failed');
    }
}
async function cleanupOldRateLimits(olderThanMs = 24 * 60 * 60 * 1000) {
    const cutoffTime = Date.now() - olderThanMs;
    let totalDeleted = 0;
    let lastDocId = null;
    while (true) {
        let query = admin
            .firestore()
            .collection('rate_limits')
            .where('lastUpdated', '<', cutoffTime)
            .limit(500);
        if (lastDocId) {
            const lastDoc = await admin.firestore().collection('rate_limits').doc(lastDocId).get();
            if (lastDoc.exists) {
                query = query.startAfter(lastDoc);
            }
        }
        const snapshot = await query.get();
        if (snapshot.empty) {
            break;
        }
        const batch = admin.firestore().batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        totalDeleted += snapshot.size;
        lastDocId = snapshot.docs[snapshot.docs.length - 1].id;
    }
    if (totalDeleted > 0) {
        console.log(`Cleaned up ${totalDeleted} old rate limit records`);
    }
}
