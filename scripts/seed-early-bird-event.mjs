/**
 * seed-early-bird-event.mjs
 * 
 * Adds a test event to the LOCAL Firebase Emulator (Firestore on port 8080)
 * with createdAt = NOW so the Early Bird badge can be earned immediately.
 * 
 * Usage:
 *   node scripts/seed-early-bird-event.mjs
 */

import { initializeApp } from 'firebase/app';
import {
    addDoc,
    collection,
    connectFirestoreEmulator,
    getFirestore,
} from 'firebase/firestore';

// ── Firebase config (matches your .env / emulator demo project) ──────────────
const firebaseConfig = {
    apiKey: 'dummy_api_key_for_emulator',
    authDomain: 'demo-no-project.firebaseapp.com',
    projectId: 'demo-no-project',
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);

// Connect to the LOCAL Firestore emulator
connectFirestoreEmulator(db, 'localhost', 8080);

// ── Build the test event ─────────────────────────────────────────────────────
const now         = new Date();
const startAt     = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
const endAt       = new Date(startAt.getTime() + 2 * 60 * 60 * 1000);  // +2 hours

const testEvent = {
    title:          '🐦 Early Bird Test Event',
    description:    'This event was seeded to test the Early Bird badge. RSVP now to earn the badge!',
    category:       'Workshop',
    location:       'Test Hall, Main Building',
    organizerName:  'Test Organizer',
    organization:   'UniEvent Dev Team',

    // ── Key field: must be within the last 60 minutes ─────────────────────
    createdAt:      now.toISOString(),

    startAt:        startAt.toISOString(),
    endAt:          endAt.toISOString(),

    isPaid:         false,
    status:         'approved',
    hasCustomForm:  false,

    // dummy ownerId — replace with a real organizer UID if needed
    ownerId:        'test-organizer-uid',

    views:          0,
    maxParticipants: 50,
};

// ── Insert into Firestore ────────────────────────────────────────────────────
try {
    const docRef = await addDoc(collection(db, 'events'), testEvent);

    console.log('\n✅  Test event created successfully!\n');
    console.log('──────────────────────────────────────────────');
    console.log(`  Event ID   : ${docRef.id}`);
    console.log(`  Title      : ${testEvent.title}`);
    console.log(`  createdAt  : ${testEvent.createdAt}`);
    console.log(`  Early Bird window closes at:`);

    const deadline = new Date(now.getTime() + 60 * 60 * 1000);
    console.log(`  ${deadline.toLocaleTimeString()} (1 hour from now)`);
    console.log('──────────────────────────────────────────────');
    console.log('\n👉  Open the app, find "🐦 Early Bird Test Event", and RSVP!');
    console.log('    You will earn the 🐦 Early Bird badge.\n');

    process.exit(0);
} catch (err) {
    console.error('\n❌  Failed to create event:', err.message);
    console.error('    Make sure the Firebase Emulator is running on port 8080.\n');
    process.exit(1);
}
