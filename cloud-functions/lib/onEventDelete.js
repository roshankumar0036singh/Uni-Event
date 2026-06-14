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
exports.onEventDelete = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
exports.onEventDelete = functions.firestore
    .document('events/{eventId}')
    .onDelete(async (snapshot, context) => {
    const eventId = context.params.eventId;
    console.log(`Event deleted: ${eventId}. Cleaning up scheduled reminders.`);
    const db = admin.firestore();
    const remindersRef = db.collection('reminders');
    try {
        const q = remindersRef.where('eventId', '==', eventId);
        const querySnapshot = await q.get();
        if (querySnapshot.empty) {
            console.log(`No reminders found for event ${eventId}.`);
            return null;
        }
        const batch = db.batch();
        querySnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Deleted ${querySnapshot.size} reminders for event ${eventId}.`);
        return null;
    }
    catch (error) {
        console.error(`Failed to clean up reminders for event ${eventId}:`, error);
        throw error;
    }
});
