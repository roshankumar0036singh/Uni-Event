/// <reference types="jest" />

import fs from 'node:fs';
import {
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
    collection,
    doc,
    getDoc,
    increment,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    getDocs,
} from 'firebase/firestore';
import {
    analyzeFeedbackSentiment,
    buildCancellationNotification,
    buildCertificate,
    buildOrganizerFeedbackNotification,
    buildRefund,
    type Attendee,
} from './coreFlowHarness';

let testEnv: RulesTestEnvironment;

jest.setTimeout(60000);

beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: 'uni-event-core-flows',
        firestore: {
            host: '127.0.0.1',
            port: 8080,
            rules: fs.readFileSync('firestore.rules', 'utf8'),
        },
    });
});

afterAll(async () => {
    await testEnv?.cleanup();
});

beforeEach(async () => {
    await testEnv.clearFirestore();
});

const studentDb = () => testEnv.authenticatedContext('student-1').firestore();
const organizerDb = () => testEnv.authenticatedContext('club-1', { club: true }).firestore();

const seed = async (path: string, data: object) => {
    await testEnv.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), path), data);
    });
};

const getServerDoc = async (path: string) => {
  let snap = null;

  await testEnv.withSecurityRulesDisabled(async (context) => {
    snap = await getDoc(doc(context.firestore(), path));
  });

  if (!snap) {
    throw new Error(`Failed to fetch Firestore document: ${path}`);
  }

  return snap;
};

describe('Core Firebase emulator flows', () => {
    test('user registration -> event creation -> RSVP -> check-in -> certificate download', async () => {
        const user = {
            uid: 'student-1',
            email: 'student@example.edu',
            displayName: 'Student One',
            branch: 'CSE',
            year: '2',
        };
        const event = {
            id: 'event-onboarding',
            title: 'Cloud Expo',
            ownerId: 'club-1',
            capacity: 120,
            date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            stats: { totalRegistrations: 0, totalCheckedIn: 0 },
            status: 'active',
        };
        const ticketId = 'ticket-student-1-event-onboarding';
        const certificateId = `${event.id}_${user.uid}`;

        await assertSucceeds(
            setDoc(doc(studentDb(), 'users', user.uid), {
                name: user.displayName,
                email: user.email,
                branch: user.branch,
                year: user.year,
                points: 0,
            }),
        );

        await assertSucceeds(setDoc(doc(organizerDb(), 'events', event.id), event));

        await assertSucceeds(
            setDoc(doc(studentDb(), 'events', event.id, 'participants', user.uid), {
                userId: user.uid,
                name: user.displayName,
                email: user.email,
                branch: user.branch,
                year: user.year,
                status: 'rsvp',
                joinedAt: new Date().toISOString(),
            }),
        );

        await testEnv.withSecurityRulesDisabled(async context => {
            const db = context.firestore();
            await setDoc(doc(db, 'tickets', ticketId), {
                id: ticketId,
                eventId: event.id,
                userId: user.uid,
                userName: user.displayName,
                userEmail: user.email,
                status: 'paid',
                checkInStatus: 'pending',
            });
            await updateDoc(doc(db, 'events', event.id), {
                'stats.totalRegistrations': increment(1),
            });
        });

        await assertSucceeds(
            setDoc(doc(organizerDb(), 'events', event.id, 'checkIns', user.uid), {
                userId: user.uid,
                ticketId,
                checkedInBy: 'club-1',
                checkedInAt: serverTimestamp(),
                status: 'checked-in',
            }),
        );

        await testEnv.withSecurityRulesDisabled(async context => {
            const db = context.firestore();
            await updateDoc(doc(db, 'events', event.id), {
                'stats.totalCheckedIn': increment(1),
            });
            await updateDoc(doc(db, 'tickets', ticketId), {
                checkInStatus: 'checked-in',
                checkedInBy: 'club-1',
            });
            await setDoc(doc(db, 'certificates', certificateId), {
                ...buildCertificate(event.id, user.uid, 'cloud-expo'),
                issuedAt: serverTimestamp(),
            });
        });

        const participant = await getDoc(doc(studentDb(), 'events', event.id, 'participants', user.uid));
        const checkIn = await getDoc(doc(studentDb(), 'events', event.id, 'checkIns', user.uid));
        const certificate = await assertSucceeds(
            getDoc(doc(studentDb(), 'certificates', certificateId)),
        );
        const savedEvent = await getDoc(doc(studentDb(), 'events', event.id));

        expect(participant.data()?.status).toBe('rsvp');
        expect(checkIn.data()?.status).toBe('checked-in');
        expect(certificate.data()?.certificateUrl).toContain('cloud-expo.pdf');
        expect(savedEvent.data()?.stats).toMatchObject({
            totalRegistrations: 1,
            totalCheckedIn: 1,
        });
    });

    test('event cancellation -> notification sent -> refund processed', async () => {
        const eventId = 'event-cancelled';
        const ownerId = 'club-1';
        const participants: Attendee[] = [
            { uid: 'student-1', email: 'student@example.edu', ticketId: 'ticket-student-1' },
            { uid: 'student-2', email: 'second@example.edu', ticketId: 'ticket-student-2' },
        ];

        await seed('events/event-cancelled', {
            title: 'Design Summit',
            ownerId,
            capacity: 80,
            date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            status: 'active',
            cancellationReason: null,
        });

        await testEnv.withSecurityRulesDisabled(async context => {
            const db = context.firestore();
            for (const attendee of participants) {
                await setDoc(doc(db, 'users', attendee.uid), {
                    email: attendee.email,
                    pushToken: `ExponentPushToken[${attendee.uid}]`,
                });
                await setDoc(doc(db, 'events', eventId, 'participants', attendee.uid), {
                    userId: attendee.uid,
                    email: attendee.email,
                    status: 'rsvp',
                });
                await setDoc(doc(db, 'tickets', attendee.ticketId), {
                    eventId,
                    userId: attendee.uid,
                    amount: 499,
                    status: 'paid',
                });
            }
        });

        await assertSucceeds(
            updateDoc(doc(organizerDb(), 'events', eventId), {
                status: 'cancelled',
                cancellationReason: 'Venue unavailable',
                cancelledAt: serverTimestamp(),
            }),
        );

        await testEnv.withSecurityRulesDisabled(async context => {
            const db = context.firestore();
            for (const attendee of participants) {
                await setDoc(doc(collection(db, 'users', attendee.uid, 'notifications')), {
                    ...buildCancellationNotification(eventId, 'Design Summit', 'Venue unavailable'),
                    read: false,
                    createdAt: serverTimestamp(),
                });
                await setDoc(doc(collection(db, 'refunds')), {
                    ...buildRefund(eventId, attendee, 499),
                    processedAt: serverTimestamp(),
                });
                await updateDoc(doc(db, 'tickets', attendee.ticketId), {
                    status: 'refunded',
                });
            }
        });

        const cancelledEvent = await getDoc(doc(studentDb(), 'events', eventId));
        expect(cancelledEvent.data()?.status).toBe('cancelled');

        await testEnv.withSecurityRulesDisabled(async context => {
            const db = context.firestore();
            for (const attendee of participants) {
                const notifications = await getDocs(
                    query(
                        collection(db, 'users', attendee.uid, 'notifications'),
                        where('eventId', '==', eventId),
                    ),
                );
                const refunds = await getDocs(
                    query(collection(db, 'refunds'), where('ticketId', '==', attendee.ticketId)),
                );
                const ticket = await getDoc(doc(db, 'tickets', attendee.ticketId));

                expect(notifications.docs[0].data()).toMatchObject({
                    type: 'event_cancelled',
                    eventId,
                    read: false,
                });
                expect(refunds.docs[0].data()).toMatchObject({
                    userId: attendee.uid,
                    amount: 499,
                    status: 'processed',
                });
                expect(ticket.data()?.status).toBe('refunded');
            }
        });
    });

    test('feedback submission -> sentiment analysis -> organizer notification', async () => {
        const eventId = 'event-feedback';
        const feedbackText =
            'Amazing workshop with insightful speakers and a wonderful hands-on session.';

        await seed('users/student-1', {
            name: 'Student One',
            email: 'student@example.edu',
            points: 0,
        });
        await seed('users/club-1', {
            name: 'Cloud Club',
            email: 'club@example.edu',
            reputation: { totalPoints: 0, totalRatings: 0 },
        });
        await seed(`events/${eventId}`, {
            title: 'AI Workshop',
            ownerId: 'club-1',
            capacity: 50,
            date: new Date(Date.now() + 24 * 60 * 60 * 1000),
            stats: { feedbackCount: 0, totalEventRating: 0, eventRatingCount: 0 },
        });

        await assertSucceeds(
            setDoc(doc(studentDb(), 'events', eventId, 'feedback', 'student-1'), {
                userId: 'student-1',
                attended: true,
                eventRating: 5,
                clubRating: 5,
                feedback: feedbackText,
                sentiment: null,
                submittedAt: serverTimestamp(),
                eventId,
                clubId: 'club-1',
            }),
        );

        await testEnv.withSecurityRulesDisabled(async context => {
            const db = context.firestore();
            const sentiment = analyzeFeedbackSentiment(feedbackText);

            await runTransaction(db, async transaction => {
                const eventRef = doc(db, 'events', eventId);
                const userRef = doc(db, 'users', 'student-1');
                const clubRef = doc(db, 'users', 'club-1');
                const feedbackRef = doc(db, 'events', eventId, 'feedback', 'student-1');
                const notificationRef = doc(collection(db, 'users', 'club-1', 'notifications'));

                transaction.update(eventRef, {
                    'stats.feedbackCount': increment(1),
                    'stats.totalEventRating': increment(5),
                    'stats.eventRatingCount': increment(1),
                });
                transaction.update(userRef, { points: increment(5) });
                transaction.update(clubRef, {
                    'reputation.totalPoints': increment(5),
                    'reputation.totalRatings': increment(1),
                });
                transaction.update(feedbackRef, { sentiment });
                transaction.set(notificationRef, {
                    ...buildOrganizerFeedbackNotification(eventId, sentiment, 5),
                    createdAt: serverTimestamp(),
                });
            });
        });

        const feedback = await getDoc(doc(studentDb(), 'events', eventId, 'feedback', 'student-1'));
        const updatedEvent = await getDoc(doc(studentDb(), 'events', eventId));
        const updatedUser = await getServerDoc('users/student-1');
        const updatedClub = await getServerDoc('users/club-1');

        await testEnv.withSecurityRulesDisabled(async context => {
            const notifications = await getDocs(
                query(
                    collection(context.firestore(), 'users', 'club-1', 'notifications'),
                    where('eventId', '==', eventId),
                ),
            );
            expect(notifications.docs[0].data()).toMatchObject({
                type: 'feedback_sentiment',
                sentiment: 'positive',
                read: false,
            });
        });

        expect(feedback.data()?.sentiment).toBe('positive');
        expect(updatedEvent.data()?.stats).toMatchObject({
            feedbackCount: 1,
            totalEventRating: 5,
            eventRatingCount: 1,
        });
        expect((updatedUser.data() as { points?: number })?.points).toBe(5);
        expect((updatedClub.data() as { reputation?: object })?.reputation).toMatchObject({
            totalPoints: 5,
            totalRatings: 1,
        });
    });
});
