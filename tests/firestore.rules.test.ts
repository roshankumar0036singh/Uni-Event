/// <reference types="jest" />

import fs from 'node:fs';
import {
    initializeTestEnvironment,
    assertSucceeds,
    assertFails,
    type TokenOptions,
} from '@firebase/rules-unit-testing';

import { deleteDoc, doc, setDoc, getDoc } from 'firebase/firestore';

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

const getFirestoreContext = (userId?: string, claims?: TokenOptions) => {
    return userId
        ? testEnv.authenticatedContext(userId, claims).firestore()
        : testEnv.unauthenticatedContext().firestore();
};

describe('Firestore Security Rules', () => {
    // ---------------- EVENTS ----------------

    // FIXED: Unauthenticated users are no longer allowed to read events (Issue #342)
    test('Unauthenticated user reads /events -> denied', async () => {
        const db = getFirestoreContext();
        await assertFails(getDoc(doc(db, 'events/event1')));
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

    test("Club user cannot self-assign admin role -> denied", async () => {
        await seedDocument("users/club1", { name: "Club User", role: "club" });

        const db = getFirestoreContext("club1", { club: true });
        await assertFails(setDoc(doc(db, "users/club1"), { role: "admin" }, { merge: true }));
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

    test('Non-participant user reads participant -> denied', async () => {
        await seedDocument('events/event1/participants/student1', { joined: true });

        const db = getFirestoreContext('student2');
        await assertFails(getDoc(doc(db, 'events/event1/participants/student1')));
    });

    // FIXED: Participants are no longer allowed to snoop on other participants (Issue #342)
    test('Participant user reads another participant -> denied', async () => {
        await seedDocument('events/event1/participants/student1', { joined: true });
        await seedDocument('events/event1/participants/student2', { joined: true }); // Seed membership

        const db = getFirestoreContext('student2');
        await assertFails(getDoc(doc(db, 'events/event1/participants/student1')));
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
        await seedDocument('events/event1/participants/student1', { status: 'attending' });

        const db = getFirestoreContext('student1');
        await assertSucceeds(
            setDoc(
                doc(db, 'events/event1/participants/student1'),
                { status: 'cancelled' },
                { merge: true },
            ),
        );
    });

    test("Participant updates another user's record -> denied", async () => {
        await seedDocument('events/event1/participants/student1', { status: 'attending' });

        const db = getFirestoreContext('student2');
        await assertFails(
            setDoc(
                doc(db, 'events/event1/participants/student1'),
                { status: 'cancelled' },
                { merge: true },
            ),
        );
    });

    test("Student deletes another user's participant record -> denied", async () => {
        await seedDocument("events/event1/participants/student2", { joined: true });

        const db = getFirestoreContext("student1");
        await assertFails(deleteDoc(doc(db, "events/event1/participants/student2")));
    });

    // ---------------- EVENT CHECK-INS ----------------

    test("Club user writes event check-in -> allowed", async () => {
        await seedDocument("events/event1", { title: "Tech Fest", ownerId: "clubOwner1" });

        const db = getFirestoreContext("club1", { club: true });
        await assertSucceeds(
            setDoc(doc(db, "events/event1/checkIns/student1"), {
                userId: "student1",
                checkedInBy: "club1",
                status: "checked-in",
            }),
        );
    });

    test("Student writes event check-in -> denied", async () => {
        await seedDocument("events/event1", { title: "Tech Fest", ownerId: "clubOwner1" });

        const db = getFirestoreContext("student1");
        await assertFails(
            setDoc(doc(db, "events/event1/checkIns/student1"), {
                userId: "student1",
                checkedInBy: "student1",
                status: "checked-in",
            }),
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

    test('Authenticated participant reads event message -> allowed', async () => {
        await seedDocument('events/event1/messages/msg1', { text: 'Hello' });
        await seedDocument('events/event1/participants/student1', { joined: true }); // Make student1 a participant

        const db = getFirestoreContext('student1');
        await assertSucceeds(getDoc(doc(db, 'events/event1/messages/msg1')));
    });

    test('Unauthenticated user reads event message -> denied', async () => {
        const db = getFirestoreContext();
        await assertFails(getDoc(doc(db, 'events/event1/messages/msg1')));
    });

    test('Authenticated participant creates event message -> allowed', async () => {
        await seedDocument('events/event1/participants/student1', { joined: true }); // Make student1 a participant
        
        const db = getFirestoreContext('student1');
        await assertSucceeds(setDoc(doc(db, 'events/event1/messages/msg1'), { text: 'Hello' }));
    });

    test('Unauthenticated user creates event message -> denied', async () => {
        const db = getFirestoreContext();
        await assertFails(setDoc(doc(db, 'events/event1/messages/msg1'), { text: 'Hello' }));
    });
});
// =========================================================================
    // ISSUE #342: REGRESSION TESTS FOR NEW COLLECTIONS (Optimized)
    // =========================================================================

    const setupIssue342Data = async () => {
        await seedDocument('events/event342', { title: 'Test Event', ownerId: 'eventOwner' });
        // Root collections
        await seedDocument('certificates/rootCert', { eventId: 'event342', userId: 'student1' });
        await seedDocument('analytics/rootStat', { eventId: 'event342' });
        // Subcollections
        await seedDocument('events/event342/attendance/att1', { userId: 'student1' });
        await seedDocument('events/event342/certificates/subCert', { userId: 'student1' });
        await seedDocument('events/event342/analytics/subStat', { metrics: true });
    };

    // Define all our new paths and whether they have a specific 'user' owner
    const newCollections = [
        { name: 'root certificate', path: 'certificates/rootCert', hasOwner: true },
        { name: 'root analytics', path: 'analytics/rootStat', hasOwner: false },
        { name: 'event attendance', path: 'events/event342/attendance/att1', hasOwner: true },
        { name: 'event certificates', path: 'events/event342/certificates/subCert', hasOwner: true },
        { name: 'event analytics', path: 'events/event342/analytics/subStat', hasOwner: false }
    ];

    // Dynamically generate the tests to satisfy SonarCloud duplication limits
    newCollections.forEach(({ name, path, hasOwner }) => {
        describe(`Access control for ${name}`, () => {
            
            test('Admin reads -> allowed', async () => {
                await setupIssue342Data();
                const db = getFirestoreContext('admin1', { admin: true });
                await assertSucceeds(getDoc(doc(db, path)));
            });

            test('Event owner reads -> allowed', async () => {
                await setupIssue342Data();
                const db = getFirestoreContext('eventOwner');
                await assertSucceeds(getDoc(doc(db, path)));
            });

            test('Unrelated user reads -> denied', async () => {
                await setupIssue342Data();
                const db = getFirestoreContext('unrelatedUser');
                await assertFails(getDoc(doc(db, path)));
            });

            // This fixes the CodeRabbit missing test warning!
            if (hasOwner) {
                test('Document owner (student1) reads -> allowed', async () => {
                    await setupIssue342Data();
                    const db = getFirestoreContext('student1');
                    await assertSucceeds(getDoc(doc(db, path)));
                });
            }
        });
    });