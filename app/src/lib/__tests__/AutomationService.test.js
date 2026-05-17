import { checkAndTriggerAutomations } from '../AutomationService';
import { getDocs, updateDoc } from 'firebase/firestore';
import { sendBulkFeedbackRequest } from '../EmailService';

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    getDocs: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    updateDoc: jest.fn(),
    doc: jest.fn(),
}));

jest.mock('../firebaseConfig', () => ({
    db: {},
}));

jest.mock('../EmailService', () => ({
    sendBulkFeedbackRequest: jest.fn(),
}));

describe('checkAndTriggerAutomations', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns early if no userId', async () => {
        await checkAndTriggerAutomations();

        expect(getDocs).not.toHaveBeenCalled();
    });

    test('returns if no events found', async () => {
        getDocs.mockResolvedValueOnce({
            empty: true,
        });

        await checkAndTriggerAutomations('user123');

        expect(getDocs).toHaveBeenCalled();
        expect(updateDoc).not.toHaveBeenCalled();
    });

    test('sends feedback emails for ended event', async () => {
        const mockEvent = {
            id: 'event1',
            data: () => ({
                title: 'Tech Fest',
                endAt: {
                    toDate: () => new Date(Date.now() - 1000),
                },
            }),
        };

        const mockParticipant = {
            data: () => ({
                name: 'Arpita',
                email: 'arpita@test.com',
            }),
        };

        getDocs
            .mockResolvedValueOnce({
                empty: false,
                size: 1,
                docs: [mockEvent],
            })
            .mockResolvedValueOnce({
                docs: [mockParticipant],
            });

        sendBulkFeedbackRequest.mockResolvedValueOnce(1);

        await checkAndTriggerAutomations('user123');

        expect(sendBulkFeedbackRequest).toHaveBeenCalled();
        expect(updateDoc).toHaveBeenCalled();
    });

    test('handles email failure gracefully', async () => {
        const mockEvent = {
            id: 'event1',
            data: () => ({
                title: 'Tech Fest',
                endAt: {
                    toDate: () => new Date(Date.now() - 1000),
                },
            }),
        };

        const mockParticipant = {
            data: () => ({
                name: 'Arpita',
                email: 'arpita@test.com',
            }),
        };

        getDocs
            .mockResolvedValueOnce({
                empty: false,
                size: 1,
                docs: [mockEvent],
            })
            .mockResolvedValueOnce({
                docs: [mockParticipant],
            });

        sendBulkFeedbackRequest.mockRejectedValueOnce(new Error('Email failed'));

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await checkAndTriggerAutomations('user123');

        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
    });
});
