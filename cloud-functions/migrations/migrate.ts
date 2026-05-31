import * as admin from 'firebase-admin';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Connect to Firebase
admin.initializeApp();
const db = admin.firestore();

// This is where we keep track of which migrations have already run
// So we never run the same migration twice
const TRACKER_DOC = 'migrations/applied';

// Get the list of migrations that have already been applied
async function getAppliedMigrations() {
    const doc = await db.doc(TRACKER_DOC).get();
    if (!doc.exists) return [];
    return doc.data()?.applied ?? [];
}

// Save a migration name to the tracker so it won't run again
async function markAsDone(migrationName: string, alreadyApplied: string[]) {
    await db.doc(TRACKER_DOC).set({
        applied: [...alreadyApplied, migrationName],
    });
}

// Main function — finds all migration files and runs the ones not yet applied
async function runMigrations() {
    const applied = await getAppliedMigrations();

    // Get all .ts files in this folder except this runner file itself
    const files = fs
        .readdirSync(__dirname)
        .filter(f => f.endsWith('.ts') && f !== 'migrate.ts')
        .sort(); // Sort so migrations always run in order (001, 002, 003...)

    if (files.length === 0) {
        console.log('No migrations found.');
        return;
    }

    for (const file of files) {
        // Skip if already applied
        if (applied.includes(file)) {
            console.log(`Already applied: ${file} — skipping.`);
            continue;
        }

        console.log(`Running: ${file}`);

        // Load and run the migration file
        const migration = await import(path.join(__dirname, file));
        await migration.up(db);

        // Mark it as done
       applied.push(file);
       await markAsDone(file, applied);

        console.log(`Finished: ${file} ✓`);
    }

    console.log('All migrations done!');
    process.exit(0);
}

// Start
runMigrations().catch(err => {
    console.error('Migration error:', err);
    process.exit(1);
});