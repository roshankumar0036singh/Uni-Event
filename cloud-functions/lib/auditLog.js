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
exports.auditLog = void 0;
exports.auditLogSubcollection = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const firestore_1 = require("firebase-admin/firestore");
/**
 * Determines the action type from before/after existence.
 */
function getAction(beforeExists, afterExists) {
    if (!beforeExists && afterExists)
        return 'create';
    if (beforeExists && !afterExists)
        return 'delete';
    return 'update';
}
/**
 * Extracts the userId based on action type and document data.
 */
function getUserId(action, beforeData, afterData) {
    if (action === 'create' && afterData) {
        return afterData.createdBy || afterData.updatedBy || null;
    }
    if (action === 'update' && afterData) {
        return afterData.updatedBy || afterData.createdBy || null;
    }
    if (action === 'delete' && beforeData) {
        return beforeData.updatedBy || beforeData.createdBy || null;
    }
    return null;
}
/**
 * Shared handler for audit log triggers.
 * Logs all create, update, and delete operations into the `auditLog` collection.
 * Prevents self-triggering by skipping writes to the 'auditLog' collection.
 */
async function auditLogHandler(change, context) {
    const collection = context.params.collectionId;
    // Prevent self-triggering recursion
    if (collection === 'auditLog') {
        return;
    }
    const beforeExists = change.before?.exists ?? false;
    const afterExists = change.after?.exists ?? false;
    const beforeData = beforeExists ? change.before.data() : undefined;
    const afterData = afterExists ? change.after.data() : undefined;
    const action = getAction(beforeExists, afterExists);
    const userId = getUserId(action, beforeData, afterData);
    const logEntry = {
        timestamp: firestore_1.FieldValue.serverTimestamp(),
        userId,
        action,
        collection,
        documentId: context.params.docId,
        before: beforeData || null,
        after: afterData || null,
    };
    try {
        await admin.firestore().collection('auditLog').add(logEntry);
    }
    catch (error) {
        console.error('Failed to write audit log entry:', error);
    }
}
exports.auditLog = functions.firestore
    .document('{collectionId}/{docId}')
    .onWrite(auditLogHandler);
exports.auditLogSubcollection = functions.firestore
    .document('{collectionId}/{docId}/{subcollectionId}/{subdocId}')
    .onWrite(auditLogHandler);
