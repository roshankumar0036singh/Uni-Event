import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { awardDedicatedStudentCertificate } from './dedicatedStudentCertificate';
import { Timestamp } from '@google-cloud/firestore';

const ATTENDANCE_POINTS_REWARD = 10;

function getISOWeekKey(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const year = d.getUTCFullYear();
    const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
    return `${year}-W${week}`;
}

export const attendanceStreak = onDocumentCreated(
    'events/{eventId}/checkIns/{userId}',
    async event => {
        const userId = event.params.userId ?? event.data?.data()?.userId;

        if (!userId) {
            console.error('No userId in checkIn document');
            return;
        }

        const db = admin.firestore();
        const userRef = db.collection('users').doc(userId);

        await db.runTransaction(async tx => {
            const userSnap = await tx.get(userRef);

            if (!userSnap.exists) {
                return;
            }

            const user = userSnap.data() || {};

            const currentStreak: number = user.currentStreak || 0;
            const longestStreak: number = user.longestStreak || 0;
            const lastAttendanceAt: admin.firestore.Timestamp | null =
                user.lastAttendanceAt || null;

            const now = Timestamp.fromDate(new Date());

            let newStreak = 1;

            if (lastAttendanceAt) {
                const currentWeek = getISOWeekKey(now.toDate());
                const lastWeek = getISOWeekKey(lastAttendanceAt.toDate());
                const prevWeek = getISOWeekKey(
                    new Date(now.toDate().getTime() - 7 * 24 * 60 * 60 * 1000),
                );

                if (currentWeek === lastWeek) {
                    return; //already attended this calendar week
                } else if (lastWeek === prevWeek) {
                    newStreak = currentStreak + 1; //consecutive week
                }
            }

            const newLongestStreak = Math.max(longestStreak, newStreak);

            tx.update(userRef, {
                currentStreak: newStreak,
                longestStreak: newLongestStreak,
                lastAttendanceAt: now,
                points: admin.firestore.FieldValue.increment(ATTENDANCE_POINTS_REWARD),
            });

            console.log('previous currentStreak:', currentStreak);
            console.log('lastAttendanceAt:', lastAttendanceAt);
            console.log('newStreak:', newStreak);
            console.log('newLongestStreak:', newLongestStreak);
        });

        //dedicated student certificate award
        const updatedSnap = await db.collection('users').doc(userId).get();
        const updatedStreak: number = updatedSnap.data()?.currentStreak || 0;

        if (updatedStreak >= 4) {
            try {
                await awardDedicatedStudentCertificate(userId);
            } catch (err) {
                console.error('Failed to award certificate:', err);
            }
        }
    },
);
