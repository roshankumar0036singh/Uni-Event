import * as admin from 'firebase-admin';

process.env.GCLOUD_PROJECT = 'demo-test';
process.env.FIREBASE_CONFIG = '{"projectId":"demo-test"}';

jest.mock('firebase-admin', () => {
    const updateMock = jest.fn();
    const setMock = jest.fn();
    const queryGetMock = jest.fn();
    const docGetMock = jest.fn();
    const whereMock = jest.fn(() => ({
        where: whereMock,
        get: queryGetMock,
    }));

    const batchMock = {
        set: setMock,
        update: updateMock,
        commit: jest.fn().mockResolvedValue(undefined),
    };

    const docRefMock = {
        get: docGetMock,
        collection: jest.fn(() => collectionRefMock),
        update: jest.fn(),
    };

    const collectionRefMock = {
        doc: jest.fn(() => docRefMock),
        where: whereMock,
        get: queryGetMock,
    };

    const firestoreInstance = {
        collection: jest.fn(() => collectionRefMock),
        batch: jest.fn(() => batchMock),
        FieldValue: {
            serverTimestamp: jest.fn(() => 'SERVER_TS'),
        },
    };

    return {
        apps: [],
        initializeApp: jest.fn(),
        firestore: jest.fn(() => firestoreInstance),
    };
});

jest.mock('firebase-admin/firestore', () => ({
    FieldValue: {
        serverTimestamp: jest.fn(() => 'SERVER_TS'),
    },
    Timestamp: {
        now: jest.fn(() => ({ toDate: () => new Date() })),
    },
}));

jest.mock('expo-server-sdk', () => ({
    Expo: { isExpoPushToken: jest.fn(() => false) },
}));

jest.mock('./utils/push', () => ({
    sendPushNotifications: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./utils/emailSender', () => ({
    sendEmailWithRetry: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('./lib/participants', () => ({
    getParticipantContacts: jest.fn(),
}));

const { sendEmailWithRetry } = require('./utils/emailSender');
const { getParticipantContacts } = require('./lib/participants');
const { processDueReminders } = require('./reminders');
const adminMock = require('firebase-admin');

const remindersQueryGet = () => adminMock.firestore().collection('reminders').where().get;

const eventsDocGet = () => adminMock.firestore().collection('events').doc().get;

beforeEach(() => {
    jest.clearAllMocks();
    eventsDocGet().mockResolvedValue(makeEvent());
});

const makeReminder = data => ({
    id: 'rem-1',
    data: jest.fn(() => data),
    ref: { id: 'rem-1' },
});

const makeEvent = (overrides = {}) => ({
    exists: true,
    data: () => ({
        title: 'Hack Night',
        startAt: '2026-09-01T10:00:00.000Z',
        location: 'Auditorium',
        eventMode: 'offline',
        ...overrides,
    }),
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe('processDueReminders — email reminders (#671)', () => {
    it('sends an email reminder to every participant email', async () => {
        getParticipantContacts.mockResolvedValue([
            { id: 'p1', email: 'alice@example.com' },
            { id: 'p2', email: 'bob@example.com' },
        ]);
        const reminder = makeReminder({ userId: 'u1', eventId: 'evt1', remindAt: {} });
        remindersQueryGet().mockResolvedValue({ empty: false, docs: [reminder], size: 1 });
        eventsDocGet().mockResolvedValue(makeEvent());

        await processDueReminders(adminMock.firestore());

        expect(sendEmailWithRetry).toHaveBeenCalledTimes(2);
        expect(sendEmailWithRetry).toHaveBeenCalledWith(
            expect.objectContaining({
                to: 'alice@example.com',
                subject: expect.stringContaining('Hack Night'),
                templateName: 'universal_email_template',
            }),
            expect.objectContaining({ eventId: 'evt1', attempts: 3 }),
        );
        const updateCall = adminMock.firestore().batch().update.mock.calls[0];
        expect(updateCall[1]).toMatchObject({ sent: true, emailed: true, emailCount: 2 });
    });

    it('does not resend when the reminder was already emailed', async () => {
        const reminder = makeReminder({
            userId: 'u1',
            eventId: 'evt1',
            remindAt: {},
            emailed: true,
        });
        remindersQueryGet().mockResolvedValue({ empty: false, docs: [reminder], size: 1 });

        await processDueReminders(adminMock.firestore());

        expect(sendEmailWithRetry).not.toHaveBeenCalled();
        const updateCall = adminMock.firestore().batch().update.mock.calls[0];
        expect(updateCall[1]).toEqual({ sent: true });
    });

    it('skips emails when the event no longer exists', async () => {
        getParticipantContacts.mockResolvedValue([{ id: 'p1', email: 'a@example.com' }]);
        const reminder = makeReminder({ userId: 'u1', eventId: 'gone', remindAt: {} });
        remindersQueryGet().mockResolvedValue({ empty: false, docs: [reminder], size: 1 });
        eventsDocGet().mockResolvedValue({ exists: false });

        await processDueReminders(adminMock.firestore());

        expect(sendEmailWithRetry).not.toHaveBeenCalled();
    });

    it('filters malformed emails and computes the email count correctly', async () => {
        getParticipantContacts.mockResolvedValue([
            { id: 'p1', email: 'ok@example.com' },
            { id: 'p2', email: 'not-an-email' },
            { id: 'p3' },
        ]);
        const reminder = makeReminder({ userId: 'u1', eventId: 'evt1', remindAt: {} });
        remindersQueryGet().mockResolvedValue({ empty: false, docs: [reminder], size: 1 });
        eventsDocGet().mockResolvedValue(makeEvent());

        await processDueReminders(adminMock.firestore());

        expect(sendEmailWithRetry).toHaveBeenCalledTimes(1);
        expect(sendEmailWithRetry).toHaveBeenCalledWith(
            expect.objectContaining({ to: 'ok@example.com' }),
            expect.anything(),
        );
        const updateCall = adminMock.firestore().batch().update.mock.calls[0];
        expect(updateCall[1]).toMatchObject({ emailed: true, emailCount: 1 });
    });
});
