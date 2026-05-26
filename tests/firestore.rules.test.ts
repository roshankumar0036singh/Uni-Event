/// <reference types="jest" />

import fs from 'node:fs';
import {
    initializeTestEnvironment,
    assertSucceeds,
    assertFails,
} from '@firebase/rules-unit-testing';

import { doc, setDoc, getDoc } from 'firebase/firestore';

let testEnv: Awaited<ReturnType<typeof initializeTestEnvironment>>;

beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: 'uni-event-test',
        firestore: {
            host: '127.0.0.1',
            port: 8080,
            rules: fs.readFileSync('firestore.rules', 'utf8'),
        },
    });
});

afterAll(async () => {
    await testEnv.cleanup();
});

beforeEach(async () => {
    await testEnv.clearFirestore();
});

// --- HELPER FUNCTIONS TO ELIMINATE DUPLICATION ---
const seedDocument = async (path: string, data: object) => {
    await testEnv.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), path), data);
    });
};

const getFirestoreContext = (userId?: string, claims?: object) => {
    return userId
        ? // cast claims to any / TokenOptions to satisfy TS signature
          testEnv.authenticatedContext(userId, claims as any).firestore()
        : testEnv.unauthenticatedContext().firestore();
};

describe('Firestore Security Rules', () => {
    // ---------------- EVENTS ----------------

    test('Unauthenticated user reads /events -> allowed', async () => {
        const db = getFirestoreContext();
        await assertSucceeds(getDoc(doc(db, 'events/event1')));
    });

    test('Unauthenticated user writes /events -> denied', async () => {
        const db = getFirestoreContext();
        await assertFails(setDoc(doc(db, 'events/event1'), { title: 'Hackathon' }));
    });

    test('Club admin creates event -> allowed', async () => {
        const db = getFirestoreContext('clubAdmin1', { club: true });
        await assertSucceeds(
            setDoc(doc(db, 'events/event1'), {
                title: 'Tech Fest',
                ownerId: 'clubAdmin1',
            }),
        );
    });

    test('Student tries to create event -> denied', async () => {
        const db = getFirestoreContext('student1');
        await assertFails(setDoc(doc(db, 'events/event1'), { title: 'Unauthorized Event' }));
    });

    test('Admin updates any event -> allowed', async () => {
        await seedDocument('events/event1', { title: 'Original Event', ownerId: 'owner123' });

        const db = getFirestoreContext('admin1', { admin: true });
        await assertSucceeds(
            setDoc(doc(db, 'events/event1'), { title: 'Updated By Admin' }, { merge: true }),
        );
    });

    // ---------------- USERS ----------------

    test('Student reads own /users/{uid} doc -> allowed', async () => {
        await seedDocument('users/student1', { name: 'Hasti' });

        const db = getFirestoreContext('student1');
        await assertSucceeds(getDoc(doc(db, 'users/student1')));
    });

    test("Student reads another user's doc -> denied", async () => {
        await seedDocument('users/student2', { name: 'Another User' });

        const db = getFirestoreContext('student1');
        await assertFails(getDoc(doc(db, 'users/student2')));
    });

    // ---------------- CLUBS ----------------

    test('Non-admin creates club -> denied', async () => {
        const db = getFirestoreContext('student1');
        await assertFails(setDoc(doc(db, 'clubs/club1'), { name: 'Chess Club' }));
    });

    test('Admin creates club -> allowed', async () => {
        const db = getFirestoreContext('admin1', { admin: true });
        await assertSucceeds(setDoc(doc(db, 'clubs/club1'), { name: 'Chess Club' }));
    });

    // ---------------- REMINDERS ----------------

    test('User creates own reminder -> allowed', async () => {
        const db = getFirestoreContext('student1');
        await assertSucceeds(
            setDoc(doc(db, 'reminders/rem1'), { userId: 'student1', text: 'Attend seminar' }),
        );
    });

    test('User creates reminder for another user -> denied', async () => {
        const db = getFirestoreContext('student1');
        await assertFails(
            setDoc(doc(db, 'reminders/rem1'), {
                userId: 'student2',
                text: 'Unauthorized reminder',
            }),
        );
    });

    // ---------------- ADMIN ----------------

    test('Admin reads /admin doc -> allowed', async () => {
        await seedDocument('admin/config', { maintenance: false });

        const db = getFirestoreContext('admin1', { admin: true });
        await assertSucceeds(getDoc(doc(db, 'admin/config')));
    });

    test('Non-admin reads /admin doc -> denied', async () => {
        await seedDocument('admin/config', { maintenance: false });

        const db = getFirestoreContext('student1');
        await assertFails(getDoc(doc(db, 'admin/config')));
    });

    // ---------------- EVENT PARTICIPANTS ----------------

    test('Authenticated user reads participant -> allowed', async () => {
        await seedDocument('events/event1/participants/student1', { joined: true });

        const db = getFirestoreContext('student2');
        await assertSucceeds(getDoc(doc(db, 'events/event1/participants/student1')));
    });

    test('Unauthenticated user reads participant -> denied', async () => {
        const db = getFirestoreContext();
        await assertFails(getDoc(doc(db, 'events/event1/participants/student1')));
    });

    test('Authenticated user creates participant -> allowed', async () => {
        const db = getFirestoreContext('student1');
        await assertSucceeds(
            setDoc(doc(db, 'events/event1/participants/student1'), { joined: true }),
        );
    });

    test('Participant updates own record -> allowed', async () => {
        await seedDocument('events/event1/participants/student1', { joined: true });

        const db = getFirestoreContext('student1');
        await assertSucceeds(
            setDoc(
                doc(db, 'events/event1/participants/student1'),
                { joined: false },
                { merge: true },
            ),
        );
    });

    test("Participant updates another user's record -> denied", async () => {
        await seedDocument('events/event1/participants/student1', { joined: true });

        const db = getFirestoreContext('student2');
        await assertFails(
            setDoc(
                doc(db, 'events/event1/participants/student1'),
                { joined: false },
                { merge: true },
            ),
        );
    });

    // ---------------- EVENT FEEDBACK ----------------

    test('Authenticated user reads event feedback -> allowed', async () => {
        await seedDocument('events/event1/feedback/student1', { rating: 5 });

        const db = getFirestoreContext('student2');
        await assertSucceeds(getDoc(doc(db, 'events/event1/feedback/student1')));
    });

    test('Unauthenticated user reads event feedback -> denied', async () => {
        const db = getFirestoreContext();
        await assertFails(getDoc(doc(db, 'events/event1/feedback/student1')));
    });

    test('User creates own feedback -> allowed', async () => {
        const db = getFirestoreContext('student1');
        await assertSucceeds(setDoc(doc(db, 'events/event1/feedback/student1'), { rating: 5 }));
    });

    test('User creates feedback for another user -> denied', async () => {
        const db = getFirestoreContext('student1');
        await assertFails(setDoc(doc(db, 'events/event1/feedback/student2'), { rating: 5 }));
    });

    // ---------------- EVENT MESSAGES ----------------

    test('Authenticated user reads event message -> allowed', async () => {
        await seedDocument('events/event1/messages/msg1', { text: 'Hello' });

        const db = getFirestoreContext('student1');
        await assertSucceeds(getDoc(doc(db, 'events/event1/messages/msg1')));
    });

    test('Unauthenticated user reads event message -> denied', async () => {
        const db = getFirestoreContext();
        await assertFails(getDoc(doc(db, 'events/event1/messages/msg1')));
    });

    test('Authenticated user creates event message -> allowed', async () => {
        const db = getFirestoreContext('student1');
        await assertSucceeds(setDoc(doc(db, 'events/event1/messages/msg1'), { text: 'Hello' }));
    });

    test('Unauthenticated user creates event message -> denied', async () => {
        const db = getFirestoreContext();
        await assertFails(setDoc(doc(db, 'events/event1/messages/msg1'), { text: 'Hello' }));
    });
});
