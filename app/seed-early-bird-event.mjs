/**
 * seed-early-bird-event.mjs
 *
 * Inserts a test event with createdAt = NOW into the local Firebase Emulator.
 * Run from inside the /app directory:
 *   node seed-early-bird-event.mjs
 */

import { initializeApp }                          from 'firebase/app';
import {
    addDoc,
    collection,
    connectFirestoreEmulator,
    getFirestore,
} from 'firebase/firestore';

// ── Match your emulator / demo project ───────────────────────────────────────
const firebaseConfig = {
    apiKey:    'dummy_api_key_for_emulator',
    authDomain: 'demo-no-project.firebaseapp.com',
    projectId: 'demo-no-project',
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
connectFirestoreEmulator(db, 'localhost', 8080);

// ── Event payload ─────────────────────────────────────────────────────────────
const now      = new Date();
const startAt  = new Date(now.getTime() + 7  * 24 * 60 * 60 * 1000); // +7 days
const endAt    = new Date(startAt.getTime()  + 2  * 60 * 60 * 1000); // +2 h

const event = {
    title:           '🐦 Early Bird Badge Test Event',
    description:     'Seed event — RSVP within 60 min of creation to earn the Early Bird badge!',
    category:        'Workshop',
    location:        'Test Hall, CS Block',
    organizerName:   'Dev Tester',
    organization:    'UniEvent',
    ownerId:         'seed-organizer-uid',

    // ✅ createdAt = RIGHT NOW — badge window is open for 60 minutes
    createdAt: now.toISOString(),

    startAt:  startAt.toISOString(),
    endAt:    endAt.toISOString(),

    isPaid:         false,
    status:         'approved',
    hasCustomForm:  false,
    maxParticipants: 100,
    views:           0,
};

try {
    const ref = await addDoc(collection(db, 'events'), event);

    const deadline = new Date(now.getTime() + 60 * 60 * 1000);

    console.log('\n✅  Early Bird test event CREATED\n');
    console.log('═══════════════════════════════════════════════════');
    console.log(`  Event ID   : ${ref.id}`);
    console.log(`  Title      : ${event.title}`);
    console.log(`  createdAt  : ${event.createdAt}`);
    console.log(`  Badge window closes : ${deadline.toLocaleTimeString()}`);
    console.log('═══════════════════════════════════════════════════');
    console.log('\n👉  Steps to get PROOF:');
    console.log('  1. Open the app in browser (localhost)');
    console.log('  2. Search for "Early Bird Badge Test Event"');
    console.log('  3. Click RSVP / Register');
    console.log('  4. See the 🐦 banner + check Profile → Badges\n');

    process.exit(0);
} catch (err) {
    console.error('\n❌  Error:', err.message);
    console.error('    Is the Firebase Emulator running?  (npx firebase emulators:start)\n');
    process.exit(1);
}
