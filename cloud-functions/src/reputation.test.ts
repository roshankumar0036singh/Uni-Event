import * as admin from 'firebase-admin';
import fft from 'firebase-functions-test';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

// Initialize firebase-functions-test
const testEnv = fft({
    projectId: 'uni-event-test',
});

// Import after env variables are set so admin initializes to emulator
import {
    runReputationRefresh,
    resolveEventStartAt,
    updateBucket,
    onParticipatingCreate
} from './reputation';

const db = admin.firestore();

function getMonthStart(offsetMonths: number): Date {
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
        if (!req.ok) throw new Error('Failed to clear emulator db');
    });

    afterAll(() => {
        testEnv.cleanup();
    });


    test('Math Decay - A 6 month old registration awards 1 point (half of 2)', async () => {
        const sixMonthsAgo = getMonthStart(6);
        
        await updateBucket('user123', sixMonthsAgo, { registrations: 1 });
        
        // Ensure user doc exists
        await db.collection('users').doc('user123').set({ name: 'Test User' });

        await runReputationRefresh();

        const userSnap = await db.collection('users').doc('user123').get();
        const rep = userSnap.data()?.reputation;
        
        // Exact decay varies between ~0.8 and ~1.0 depending on the current day of the month
        // because ageMonths calculates the distance from now to the 1st of the month bucket.
        expect(rep.points).toBeGreaterThan(0.8);
        expect(rep.points).toBeLessThan(1.2);
        expect(rep.registrationCount).toBe(1);
    });

    test('Math Decay - A 12 month old attendance awards 2.5 points (quarter of 10)', async () => {
        const twelveMonthsAgo = getMonthStart(12);
        
        await updateBucket('user123', twelveMonthsAgo, { attendances: 1 });
        await db.collection('users').doc('user123').set({ name: 'Test User' });

        await runReputationRefresh();

        const userSnap = await db.collection('users').doc('user123').get();
        const rep = userSnap.data()?.reputation;
        
        // Exact decay varies between ~2.2 and ~2.9 depending on current day of month
        expect(rep.points).toBeGreaterThan(2);
        expect(rep.points).toBeLessThan(3);
        expect(rep.attendanceCount).toBe(1);
    });

    test('Fallback - resolveEventStartAt fetches from events collection if missing', async () => {
        // Create an event doc
        const eventStart = new Date('2024-01-01T12:00:00Z');
        await db.collection('events').doc('evt_fallback').set({
            startAt: eventStart.toISOString()
        });

        const cache = new Map<string, Date | null>();
        const resolved = await resolveEventStartAt('evt_fallback', undefined, cache);

        expect(resolved?.getTime()).toBe(eventStart.getTime());
        expect(cache.get('evt_fallback')?.getTime()).toBe(eventStart.getTime());
    });

    test('Trigger - onParticipatingCreate increments bucket', async () => {
        const snap = testEnv.firestore.makeDocumentSnapshot({
            eventStartAt: new Date().toISOString()
        }, 'users/u1/participating/e1');

        const wrapped = testEnv.wrap(onParticipatingCreate);
        await wrapped(snap, { params: { userId: 'u1', eventId: 'e1' } });

        const buckets = await db.collection('users').doc('u1').collection('reputationBuckets').get();
        expect(buckets.size).toBe(1);
        expect(buckets.docs[0].data().registrations).toBe(1);
    });
});