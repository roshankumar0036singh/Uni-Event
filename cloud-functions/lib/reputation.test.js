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
const admin = __importStar(require("firebase-admin"));
const firebase_functions_test_1 = __importDefault(require("firebase-functions-test"));
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
// Initialize firebase-functions-test
const testEnv = (0, firebase_functions_test_1.default)({
    projectId: 'uni-event-test',
});
// Import after env variables are set so admin initializes to emulator
const reputation_1 = require("./reputation");
const db = admin.firestore();
function getMonthStart(offsetMonths) {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() - offsetMonths);
    return d;
}
describe('Reputation Decay & Buckets', () => {
    beforeEach(async () => {
        // Clear the emulator database before each test
        const req = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/uni-event-test/databases/(default)/documents`, {
            method: 'DELETE'
        });
        if (!req.ok)
            throw new Error('Failed to clear emulator db');
    });
    afterAll(() => {
        testEnv.cleanup();
    });
    test('Math Decay - A 6 month old registration awards 1 point (half of 2)', async () => {
        var _a;
        const sixMonthsAgo = getMonthStart(6);
        await (0, reputation_1.updateBucket)('user123', sixMonthsAgo, { registrations: 1 });
        // Ensure user doc exists
        await db.collection('users').doc('user123').set({ name: 'Test User' });
        await (0, reputation_1.runReputationRefresh)();
        const userSnap = await db.collection('users').doc('user123').get();
        const rep = (_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.reputation;
        // Exact decay varies between ~0.8 and ~1.0 depending on the current day of the month
        // because ageMonths calculates the distance from now to the 1st of the month bucket.
        expect(rep.points).toBeGreaterThan(0.8);
        expect(rep.points).toBeLessThan(1.2);
        expect(rep.registrationCount).toBe(1);
    });
    test('Math Decay - A 12 month old attendance awards 2.5 points (quarter of 10)', async () => {
        var _a;
        const twelveMonthsAgo = getMonthStart(12);
        await (0, reputation_1.updateBucket)('user123', twelveMonthsAgo, { attendances: 1 });
        await db.collection('users').doc('user123').set({ name: 'Test User' });
        await (0, reputation_1.runReputationRefresh)();
        const userSnap = await db.collection('users').doc('user123').get();
        const rep = (_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.reputation;
        // Exact decay varies between ~2.2 and ~2.9 depending on current day of month
        expect(rep.points).toBeGreaterThan(2);
        expect(rep.points).toBeLessThan(3);
        expect(rep.attendanceCount).toBe(1);
    });
    test('Fallback - resolveEventStartAt fetches from events collection if missing', async () => {
        var _a;
        // Create an event doc
        const eventStart = new Date('2024-01-01T12:00:00Z');
        await db.collection('events').doc('evt_fallback').set({
            startAt: eventStart.toISOString()
        });
        const cache = new Map();
        const resolved = await (0, reputation_1.resolveEventStartAt)('evt_fallback', undefined, cache);
        expect(resolved === null || resolved === void 0 ? void 0 : resolved.getTime()).toBe(eventStart.getTime());
        expect((_a = cache.get('evt_fallback')) === null || _a === void 0 ? void 0 : _a.getTime()).toBe(eventStart.getTime());
    });
    test('Trigger - onParticipatingCreate increments bucket', async () => {
        const snap = testEnv.firestore.makeDocumentSnapshot({
            eventStartAt: new Date().toISOString()
        }, 'users/u1/participating/e1');
        const wrapped = testEnv.wrap(reputation_1.onParticipatingCreate);
        await wrapped(snap, { params: { userId: 'u1', eventId: 'e1' } });
        const buckets = await db.collection('users').doc('u1').collection('reputationBuckets').get();
        expect(buckets.size).toBe(1);
        expect(buckets.docs[0].data().registrations).toBe(1);
    });
});
