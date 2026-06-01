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
const testEnv = (0, firebase_functions_test_1.default)({ projectId: 'uni-event-test' });
admin.initializeApp({ projectId: 'uni-event-test' });
const reputation_1 = require("../reputation");
const db = admin.firestore();
function assertClose(actual, expected, margin = 0.01) {
    if (Math.abs(actual - expected) > margin) {
        throw new Error(`Assertion failed: expected ${expected} but got ${actual}`);
    }
}
async function runTests() {
    var _a, _b;
    console.log('Starting tests...');
    // Clear db
    await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/uni-event-test/databases/(default)/documents`, { method: 'DELETE' });
    // Test 1: Math Decay
    console.log('Running Math Decay Test 1...');
    const sixMonthsAgo = new Date(Date.now() - (6 * 30.44 * 24 * 60 * 60 * 1000));
    await (0, reputation_1.updateBucket)('user123', sixMonthsAgo, { registrations: 1 });
    await db.collection('users').doc('user123').set({ name: 'Test User' });
    await (0, reputation_1.runReputationRefresh)();
    let userSnap = await db.collection('users').doc('user123').get();
    let rep = (_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.reputation;
    const bucketDate1 = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth(), 1);
    const expected1 = 2 * Math.pow(0.5, (Date.now() - bucketDate1.getTime()) / (1000 * 60 * 60 * 24 * 30.44) / 6);
    assertClose(rep.points, expected1);
    if (rep.registrationCount !== 1)
        throw new Error('reg count wrong');
    // Test 2: Math Decay 2
    console.log('Running Math Decay Test 2...');
    const twelveMonthsAgo = new Date(Date.now() - (12 * 30.44 * 24 * 60 * 60 * 1000));
    await (0, reputation_1.updateBucket)('user124', twelveMonthsAgo, { attendances: 1 });
    await db.collection('users').doc('user124').set({ name: 'Test User' });
    await (0, reputation_1.runReputationRefresh)();
    userSnap = await db.collection('users').doc('user124').get();
    rep = (_b = userSnap.data()) === null || _b === void 0 ? void 0 : _b.reputation;
    const bucketDate2 = new Date(twelveMonthsAgo.getFullYear(), twelveMonthsAgo.getMonth(), 1);
    const expected2 = 10 * Math.pow(0.5, (Date.now() - bucketDate2.getTime()) / (1000 * 60 * 60 * 24 * 30.44) / 6);
    assertClose(rep.points, expected2);
    // Test 3: Fallback
    console.log('Running Fallback Test...');
    const eventStart = new Date('2024-01-01T12:00:00Z');
    await db.collection('events').doc('evt_fallback').set({ startAt: eventStart.toISOString() });
    const cache = new Map();
    const resolved = await (0, reputation_1.resolveEventStartAt)('evt_fallback', undefined, cache);
    if ((resolved === null || resolved === void 0 ? void 0 : resolved.getTime()) !== eventStart.getTime())
        throw new Error('Fallback failed');
    // Test 4: Trigger Create Registration
    console.log('Running Trigger Test (Create Registration)...');
    const snap = testEnv.firestore.makeDocumentSnapshot({ eventStartAt: new Date().toISOString() }, 'users/u1/participating/e1');
    const wrappedCreate = testEnv.wrap(reputation_1.onParticipatingCreate);
    await wrappedCreate(snap, { params: { userId: 'u1', eventId: 'e1' } });
    let buckets = await db.collection('users').doc('u1').collection('reputationBuckets').get();
    if (buckets.size !== 1)
        throw new Error('Trigger bucket not created');
    if (buckets.docs[0].data().registrations !== 1)
        throw new Error('Trigger reg wrong');
    // Test 5: Trigger Delete Registration
    console.log('Running Trigger Test (Delete Registration)...');
    const wrappedDelete = testEnv.wrap(reputation_1.onParticipatingDelete);
    await wrappedDelete(snap, { params: { userId: 'u1', eventId: 'e1' } });
    buckets = await db.collection('users').doc('u1').collection('reputationBuckets').get();
    if (buckets.docs[0].data().registrations !== 0)
        throw new Error('Trigger delete reg wrong');
    // Test 6: Trigger Create CheckIn
    console.log('Running Trigger Test (Create CheckIn)...');
    const checkInSnap = testEnv.firestore.makeDocumentSnapshot({ eventStartAt: new Date().toISOString() }, 'events/e1/checkIns/u2');
    const wrappedCheckIn = testEnv.wrap(reputation_1.onCheckInCreate);
    await wrappedCheckIn(checkInSnap, { params: { eventId: 'e1', userId: 'u2' } });
    const u2Buckets = await db.collection('users').doc('u2').collection('reputationBuckets').get();
    if (u2Buckets.docs[0].data().attendances !== 1)
        throw new Error('Trigger check-in attendance wrong');
    // Test 7: Trigger Delete CheckIn
    console.log('Running Trigger Test (Delete CheckIn)...');
    const wrappedCheckInDelete = testEnv.wrap(reputation_1.onCheckInDelete);
    await wrappedCheckInDelete(checkInSnap, { params: { eventId: 'e1', userId: 'u2' } });
    const u2BucketsAfterDelete = await db.collection('users').doc('u2').collection('reputationBuckets').get();
    if (u2BucketsAfterDelete.docs[0].data().attendances !== 0)
        throw new Error('Trigger check-in delete attendance wrong');
    // Test 8: Trigger Create/Delete Reminder
    console.log('Running Trigger Test (Reminders)...');
    const reminderSnap = testEnv.firestore.makeDocumentSnapshot({ eventStartAt: new Date().toISOString(), userId: 'u3', eventId: 'e2' }, 'reminders/r1');
    const wrappedReminderCreate = testEnv.wrap(reputation_1.onReminderCreate);
    await wrappedReminderCreate(reminderSnap, {});
    let u3Buckets = await db.collection('users').doc('u3').collection('reputationBuckets').get();
    if (u3Buckets.docs[0].data().reminders !== 1)
        throw new Error('Trigger reminder create wrong');
    const wrappedReminderDelete = testEnv.wrap(reputation_1.onReminderDelete);
    await wrappedReminderDelete(reminderSnap, {});
    u3Buckets = await db.collection('users').doc('u3').collection('reputationBuckets').get();
    if (u3Buckets.docs[0].data().reminders !== 0)
        throw new Error('Trigger reminder delete wrong');
    // Test 9: Backfill Function
    console.log('Running Backfill Test...');
    // Create some raw data to backfill
    await db.collection('users').doc('u4').collection('participating').doc('e3').set({ eventStartAt: new Date().toISOString(), eventId: 'e3' });
    const wrappedBackfill = testEnv.wrap(reputation_1.backfillReputationBuckets);
    const backfillResult = await wrappedBackfill({}, { auth: { token: { admin: true } } });
    if (!backfillResult.success || backfillResult.updatedBuckets < 1)
        throw new Error('Backfill failed');
    const u4Buckets = await db.collection('users').doc('u4').collection('reputationBuckets').get();
    if (u4Buckets.size === 0 || u4Buckets.docs[0].data().registrations !== 1)
        throw new Error('Backfill data incorrect');
    console.log('All tests passed successfully!');
    testEnv.cleanup();
}
runTests().catch(e => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=runTests.js.map