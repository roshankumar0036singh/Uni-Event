import * as admin from 'firebase-admin';
import * as fs from 'node:fs';
import * as path from 'node:path';

admin.initializeApp();
const db = admin.firestore();

const TRACKER_DOC = 'migrations/applied';

// Get list of already applied migrations
async function getAppliedMigrations(): Promise<string[]> {
    const doc = await db.doc(TRACKER_DOC).get();
    if (!doc.exists) return [];
    return doc.data()?.applied ?? [];
}

// Atomically claim a migration slot to prevent duplicate runs
async function claimMigration(migrationName: string): Promise<boolean> {
    const ref = db.doc(TRACKER_DOC);
    try {
        await db.runTransaction(async t => {
            const doc = await t.get(ref);
            const applied: string[] = doc.exists ? (doc.data()?.applied ?? []) : [];
            if (applied.includes(migrationName)) throw new Error('already_applied');
            t.set(ref, { applied: [...applied, migrationName] });
        });
        return true;
    } catch (e: any) {
        if (e?.message === 'already_applied') return false;
        throw e;
    }
}

// Remove a migration from tracker (for rollback or failed retry)
async function unclaimMigration(migrationName: string): Promise<void> {
    const ref = db.doc(TRACKER_DOC);
    await db.runTransaction(async t => {
        const doc = await t.get(ref);
        const applied: string[] = doc.exists ? (doc.data()?.applied ?? []) : [];
        t.set(ref, { applied: applied.filter(m => m !== migrationName) });
    });
}

// Run all pending migrations
async function runMigrations() {
    const applied = await getAppliedMigrations();

    const files = fs
        .readdirSync(__dirname)
        .filter(f => f.endsWith('.ts') && f !== 'migrate.ts')
        .sort();

    if (files.length === 0) {
        console.log('No migrations found.');
        return;
    }

    for (const file of files) {
        if (applied.includes(file)) {
            console.log(`Already applied: ${file} — skipping.`);
            continue;
        }

        // Claim the migration atomically before running
        const claimed = await claimMigration(file);
        if (!claimed) {
            console.log(`Skipping ${file} — already claimed by another process.`);
            continue;
        }

        console.log(`Running: ${file}`);
        try {
            const migration = await import(path.join(__dirname, file));
            await migration.up(db);
            console.log(`Finished: ${file} ✓`);
        } catch (err) {
            // If migration fails, unclaim it so it can be retried next time
            console.error(`Migration ${file} failed — unclaiming for retry.`, err);
            await unclaimMigration(file);
            throw err;
        }
    }

    console.log('All migrations done!');
}

// Rollback the last applied migration
async function rollbackMigration() {
    const applied = await getAppliedMigrations();

    if (applied.length === 0) {
        console.log('No migrations to roll back.');
        return;
    }

    const lastFile = applied[applied.length - 1];
    console.log(`Rolling back: ${lastFile}`);

    const migration = await import(path.join(__dirname, lastFile));
    if (!migration.down) {
        console.error(`No down() function in ${lastFile}`);
        process.exit(1);
    }

    await migration.down(db);
    await unclaimMigration(lastFile);
    console.log(`Rolled back: ${lastFile} ✓`);
}

const command = process.argv[2];

if (command === 'down') {
    rollbackMigration().catch(err => {
        console.error('Rollback error:', err);
        process.exit(1);
    });
} else {
    runMigrations().catch(err => {
        console.error('Migration error:', err);
        process.exit(1);
    });
}
