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
exports.detectInactiveUsers = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const firestore_1 = require("firebase-admin/firestore");
function getLastActiveDate(lastActive) {
    if (typeof lastActive.toDate === 'function') {
        return lastActive.toDate();
    }
    return new Date(lastActive);
}
exports.detectInactiveUsers = functions.pubsub
    .schedule('every 24 hours')
    .timeZone('UTC')
    .onRun(async () => {
    const db = admin.firestore();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const usersSnapshot = await db.collection('users').get();
    let batch = db.batch();
    let operationCount = 0;
    for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        // Skip users without lastActive
        if (!userData.lastActive) {
            continue;
        }
        const lastActiveDate = getLastActiveDate(userData.lastActive);
        const isInactive = lastActiveDate < thirtyDaysAgo;
        if (userData.isInactive === isInactive) {
            continue;
        }
        const updateData = {
            isInactive,
        };
        if (isInactive) {
            if (!userData.inactiveSince) {
                updateData.inactiveSince = firestore_1.FieldValue.serverTimestamp();
            }
        }
        else {
            updateData.inactiveSince = null;
        }
        batch.update(userDoc.ref, updateData);
        operationCount++;
        if (operationCount === 500) {
            await batch.commit();
            batch = db.batch();
            operationCount = 0;
        }
    }
    try {
        if (operationCount > 0) {
            await batch.commit();
        }
        console.log('Inactive users scan completed.');
    }
    catch (error) {
        console.error('Error committing inactivity batch:', error);
        throw error;
    }
    return null;
});
