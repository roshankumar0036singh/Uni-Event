/// <reference types="jest" />
import fs from 'node:fs';
import {
    initializeTestEnvironment,
    assertSucceeds,
    assertFails,
    type TokenOptions,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, setDoc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

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

// --- HELPER FUNCTIONS ---

const seedDocument = async (path: string, data: object) => {
    await testEnv.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), path), data);
    });
};

const getFirestoreContext = (userId?: string, claims?: TokenOptions) =>
    userId
        ? testEnv.authenticatedContext(userId, claims).firestore()
        : testEnv.unauthenticatedContext().firestore();

type SeedDoc = { path: string; data: object };

type ReadAccessCase = {
    name: string;
    userId?: string;
    claims?: TokenOptions;
    seedDocs: SeedDoc[];
    allow: boolean;
};

const seedDocuments = async (documents: SeedDoc[]) => {
    for (const document of documents) await seedDocument(document.path, document.data);
};

const assertReadAccess = async ({
    userId,
    claims,
    path,
    seedDocs,
    allow,
}: {
    userId?: string;
    claims?: TokenOptions;
    path: string;
    seedDocs: SeedDoc[];
    allow: boolean;
}) => {
    await seedDocuments(seedDocs);
    const operation = getDoc(doc(getFirestoreContext(userId, claims), path));
    if (allow) await assertSucceeds(operation);
    else await assertFails(operation);
};

// --- READ ACCESS CASE FACTORIES ---

type ReadCaseFactoryArgs = {
    path: string;
    targetSeedDoc: SeedDoc;
    ownerExtraSeedDocs?: SeedDoc[];
    documentOwnerUserId?: string;
    unrelatedUserId?: string;
};

const makeStandardReadCases = ({
    targetSeedDoc,
    ownerExtraSeedDocs = [],
    documentOwnerUserId,
    unrelatedUserId = 'student2',
}: ReadCaseFactoryArgs): ReadAccessCase[] => [
    {
        name: 'Admin reads -> allowed',
        userId: 'admin1',
        claims: { admin: true },
        seedDocs: [targetSeedDoc],
        allow: true,
    },
    {
        name: 'Event owner reads -> allowed',
        userId: 'club1',
        claims: { club: true },
        seedDocs: [
            { path: 'events/event1', data: { ownerId: 'club1' } },
            ...ownerExtraSeedDocs,
            targetSeedDoc,
        ],
        allow: true,
    },
    {
        name: 'Unrelated user reads -> denied',
        userId: unrelatedUserId,
        seedDocs: [targetSeedDoc],
        allow: false,
    },
    ...(documentOwnerUserId
        ? [
              {
                  name: `Document owner (${documentOwnerUserId}) reads -> allowed`,
                  userId: documentOwnerUserId,
                  seedDocs: [targetSeedDoc],
                  allow: true,
              },
          ]
        : []),
];

/** Builds a describe.each row from factory args directly — eliminates per-entry IIFEs */
const makeAccessSuite = (label: string, args: ReadCaseFactoryArgs) => ({
    label,
    path: args.path,
    cases: makeStandardReadCases(args) satisfies ReadAccessCase[],
});

describe('Firestore Security Rules', () => {
    // ---------------- EVENTS ----------------

    // FIXED: Unauthenticated users are no longer allowed to read events (Issue #342)
    test('Unauthenticated user reads /events -> denied', async () => {
        await assertFails(getDoc(doc(getFirestoreContext(), 'events/event1')));
    });

    test('Unauthenticated user writes /events -> denied', async () => {
        await assertFails(
            setDoc(doc(getFirestoreContext(), 'events/event1'), { title: 'Hackathon' }),
        );
    });

    test('Club admin creates event -> allowed', async () => {
        await seedDocument('users/clubAdmin1', { role: 'club' });
        const db = getFirestoreContext('clubAdmin1', { club: true });
        const batch = writeBatch(db);
        batch.set(
            doc(db, 'users/clubAdmin1'),
            {
                writeCountMinute: 1,
                eventCountDay: 1,
                lastWriteAt: serverTimestamp(),
                lastEventDay: 20260530,
            },
            { merge: true },
        );
        batch.set(doc(db, 'events/event1'), { title: 'Tech Fest', ownerId: 'clubAdmin1' });
        await assertSucceeds(batch.commit());
    });

    test('Club admin atomically creates event + attendance placeholder + organizer stats -> allowed', async () => {
        await seedDocument('users/clubAdminAtomic', { role: 'club' });
        const db = getFirestoreContext('clubAdminAtomic', { club: true });
        const batch = writeBatch(db);
        batch.set(
            doc(db, 'users/clubAdminAtomic'),
            {
                writeCountMinute: 1,
                eventCountDay: 1,
                lastWriteAt: serverTimestamp(),
                lastEventDay: 20260530,
                organizerStats: { eventsCreated: 1 },
            },
            { merge: true },
        );
        batch.set(doc(db, 'events/eventAtomic1'), {
            title: 'Atomic Event',
            ownerId: 'clubAdminAtomic',
        });
        batch.set(doc(db, 'events/eventAtomic1/attendance/bootstrap'), {
            eventId: 'eventAtomic1',
            ownerId: 'clubAdminAtomic',
            type: 'bootstrap',
            checkInCount: 0,
        });
        await assertSucceeds(batch.commit());
    });

    test('Student tries to create event -> denied', async () => {
        await assertFails(
            setDoc(doc(getFirestoreContext('student1'), 'events/event1'), {
                title: 'Unauthorized Event',
            }),
        );
    });

    test('Admin updates any event -> allowed', async () => {
        await seedDocument('events/event1', { title: 'Original Event', ownerId: 'owner123' });
        await assertSucceeds(
            setDoc(
                doc(getFirestoreContext('admin1', { admin: true }), 'events/event1'),
                { title: 'Updated By Admin' },
                { merge: true },
            ),
        );
    });

    // ---------------- USERS ----------------

    test('Student reads own /users/{uid} doc -> allowed', async () => {
        await seedDocument('users/student1', { name: 'Hasti' });
        await assertSucceeds(getDoc(doc(getFirestoreContext('student1'), 'users/student1')));
    });

    test("Student reads another user's doc -> denied", async () => {
        await seedDocument('users/student2', { name: 'Another User' });
        await assertFails(getDoc(doc(getFirestoreContext('student1'), 'users/student2')));
    });

    test('Club user cannot self-assign admin role -> denied', async () => {
        await seedDocument('users/club1', { name: 'Club User', role: 'club' });
        await assertFails(
            setDoc(
                doc(getFirestoreContext('club1', { club: true }), 'users/club1'),
                { role: 'admin' },
                { merge: true },
            ),
        );
    });

    // ---------------- CLUBS ----------------

    test('Non-admin creates club -> denied', async () => {
        await assertFails(
            setDoc(doc(getFirestoreContext('student1'), 'clubs/club1'), { name: 'Chess Club' }),
        );
    });

    test('Admin creates club -> allowed', async () => {
        await assertSucceeds(
            setDoc(doc(getFirestoreContext('admin1', { admin: true }), 'clubs/club1'), {
                name: 'Chess Club',
            }),
        );
    });

    // ---------------- REMINDERS ----------------

    test('User creates own reminder -> allowed', async () => {
        await seedDocument('users/student1', { role: 'student' });
        const db = getFirestoreContext('student1');
        const batch = writeBatch(db);
        batch.set(
            doc(db, 'users/student1'),
            { writeCountMinute: 1, lastWriteAt: serverTimestamp() },
            { merge: true },
        );
        batch.set(doc(db, 'reminders/rem1'), { userId: 'student1', text: 'Attend seminar' });
        await assertSucceeds(batch.commit());
    });

    test('User creates reminder for another user -> denied', async () => {
        await assertFails(
            setDoc(doc(getFirestoreContext('student1'), 'reminders/rem1'), {
                userId: 'student2',
                text: 'Unauthorized reminder',
            }),
        );
    });

    // ---------------- ADMIN ----------------

    test('Admin reads /admin doc -> allowed', async () => {
        await seedDocument('admin/config', { maintenance: false });
        await assertSucceeds(
            getDoc(doc(getFirestoreContext('admin1', { admin: true }), 'admin/config')),
        );
    });

    test('Non-admin reads /admin doc -> denied', async () => {
        await seedDocument('admin/config', { maintenance: false });
        await assertFails(getDoc(doc(getFirestoreContext('student1'), 'admin/config')));
    });

    // ---------------- EVENT PARTICIPANTS ----------------

    test('Non-participant user reads participant -> denied', async () => {
        await seedDocument('events/event1/participants/student1', { joined: true });
        await assertFails(
            getDoc(doc(getFirestoreContext('student2'), 'events/event1/participants/student1')),
        );
    });

    // FIXED: Participants are no longer allowed to snoop on other participants (Issue #342)
    test('Participant user reads another participant -> denied', async () => {
        await seedDocument('events/event1/participants/student1', { joined: true });
        await seedDocument('events/event1/participants/student2', { joined: true });
        await assertFails(
            getDoc(doc(getFirestoreContext('student2'), 'events/event1/participants/student1')),
        );
    });

    test('Unauthenticated user reads participant -> denied', async () => {
        await assertFails(
            getDoc(doc(getFirestoreContext(), 'events/event1/participants/student1')),
        );
    });

    test('Authenticated user creates participant -> allowed', async () => {
        await assertSucceeds(
            setDoc(doc(getFirestoreContext('student1'), 'events/event1/participants/student1'), {
                joined: true,
            }),
        );
    });

    test('Participant updates own record -> allowed', async () => {
        await seedDocument('events/event1/participants/student1', { status: 'attending' });
        await assertSucceeds(
            setDoc(
                doc(getFirestoreContext('student1'), 'events/event1/participants/student1'),
                { status: 'cancelled' },
                { merge: true },
            ),
        );
    });

    test("Participant updates another user's record -> denied", async () => {
        await seedDocument('events/event1/participants/student1', { status: 'attending' });
        await assertFails(
            setDoc(
                doc(getFirestoreContext('student2'), 'events/event1/participants/student1'),
                { status: 'cancelled' },
                { merge: true },
            ),
        );
    });

    test("Student deletes another user's participant record -> denied", async () => {
        await seedDocument('events/event1/participants/student2', { joined: true });
        await assertFails(
            deleteDoc(doc(getFirestoreContext('student1'), 'events/event1/participants/student2')),
        );
    });

    // ---------------- EVENT CHECK-INS ----------------

    test('Club user writes event check-in -> allowed', async () => {
        await seedDocument('events/event1', { title: 'Tech Fest', ownerId: 'clubOwner1' });
        await assertSucceeds(
            setDoc(
                doc(
                    getFirestoreContext('club1', { club: true }),
                    'events/event1/checkIns/student1',
                ),
                { userId: 'student1', checkedInBy: 'club1', status: 'checked-in' },
            ),
        );
    });

    test('Student writes event check-in -> denied', async () => {
        await seedDocument('events/event1', { title: 'Tech Fest', ownerId: 'clubOwner1' });
        await assertFails(
            setDoc(doc(getFirestoreContext('student1'), 'events/event1/checkIns/student1'), {
                userId: 'student1',
                checkedInBy: 'student1',
                status: 'checked-in',
            }),
        );
    });

    // ---------------- EVENT FEEDBACK ----------------

    test('Authenticated user reads event feedback -> allowed', async () => {
        await seedDocument('events/event1/feedback/student1', { rating: 5 });
        await assertSucceeds(
            getDoc(doc(getFirestoreContext('student2'), 'events/event1/feedback/student1')),
        );
    });

    test('Unauthenticated user reads event feedback -> denied', async () => {
        await assertFails(getDoc(doc(getFirestoreContext(), 'events/event1/feedback/student1')));
    });

    test('User creates own feedback -> allowed', async () => {
        await assertSucceeds(
            setDoc(doc(getFirestoreContext('student1'), 'events/event1/feedback/student1'), {
                rating: 5,
                comments: 'Good',
            }),
        );
    });

    test('User creates feedback for another user -> denied', async () => {
        await assertFails(
            setDoc(doc(getFirestoreContext('student1'), 'events/event1/feedback/student2'), {
                rating: 5,
                comments: 'Bad',
            }),
        );
    });

    // ---------------- MESSAGES ----------------

    test('Authenticated participant reads event message -> allowed', async () => {
        await seedDocument('events/event1', { title: 'Tech Fest', ownerId: 'clubOwner1' });
        await seedDocument('events/event1/participants/student1', { joined: true });
        await assertSucceeds(
            getDoc(doc(getFirestoreContext('student1'), 'events/event1/messages/msg1')),
        );
    });

    test('Unauthenticated user reads event message -> denied', async () => {
        await assertFails(getDoc(doc(getFirestoreContext(), 'events/event1/messages/msg1')));
    });

    test('Authenticated participant creates event message -> allowed', async () => {
        await seedDocument('events/event1', { title: 'Tech Fest', ownerId: 'clubOwner1' });
        await seedDocument('events/event1/participants/student1', { joined: true });
        await assertSucceeds(
            setDoc(doc(getFirestoreContext('student1'), 'events/event1/messages/msg1'), {
                userId: 'student1',
                text: 'Hello',
            }),
        );
    });

    test('Unauthenticated user creates event message -> denied', async () => {
        await assertFails(
            setDoc(doc(getFirestoreContext(), 'events/event1/messages/msg1'), {
                userId: 'student1',
                text: 'Hello',
            }),
        );
    });

    // ---------------- READ ACCESS MATRIX (certificates, analytics, attendance) ----------------

    describe.each([
        makeAccessSuite('root certificate', {
            path: 'certificates/cert1',
            targetSeedDoc: {
                path: 'certificates/cert1',
                data: { userId: 'student1', eventId: 'event1' },
            },
            documentOwnerUserId: 'student1',
        }),
        makeAccessSuite('root analytics', {
            path: 'analytics/a1',
            targetSeedDoc: { path: 'analytics/a1', data: { eventId: 'event1' } },
            unrelatedUserId: 'student1',
        }),
        makeAccessSuite('event attendance', {
            path: 'events/event1/attendance/att1',
            targetSeedDoc: { path: 'events/event1/attendance/att1', data: { userId: 'student1' } },
            documentOwnerUserId: 'student1',
        }),
        makeAccessSuite('event certificates', {
            path: 'events/event1/certificates/cert1',
            targetSeedDoc: {
                path: 'events/event1/certificates/cert1',
                data: { userId: 'student1' },
            },
            documentOwnerUserId: 'student1',
        }),
        makeAccessSuite('event analytics', {
            path: 'events/event1/analytics/a1',
            targetSeedDoc: { path: 'events/event1/analytics/a1', data: { eventId: 'event1' } },
            unrelatedUserId: 'student1',
        }),
    ])('Access control for $label', ({ path, cases }) => {
        cases.forEach(({ name, userId, claims, seedDocs, allow }) => {
            test(name, async () => {
                await assertReadAccess({ userId, claims, path, seedDocs, allow });
            });
        });
    });
});
