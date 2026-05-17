import { createMeetEvent, addToCalendar } from '../CalendarService';

global.fetch = jest.fn();

describe('CalendarService', () => {
    let startAt;
    let endAt;

    beforeEach(() => {
        startAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

        endAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

        fetch.mockClear();

        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('creates Google Meet event successfully', async () => {
        fetch.mockResolvedValueOnce({
            json: async () => ({
                hangoutLink: 'https://meet.google.com/test',
                id: 'event123',
                htmlLink: 'https://calendar.google.com/event',
            }),
        });

        const result = await createMeetEvent('token123', {
            title: 'Tech Fest',
            description: 'Event Description',
            startAt,
            endAt,
        });

        expect(fetch).toHaveBeenCalled();

        expect(result.meetLink).toBe('https://meet.google.com/test');
    });

    test('throws error when Google Meet API fails', async () => {
        fetch.mockResolvedValueOnce({
            json: async () => ({
                error: {
                    message: 'API Failure',
                },
            }),
        });

        await expect(
            createMeetEvent('token123', {
                title: 'Tech Fest',
                description: 'Event Description',
                startAt,
                endAt,
            }),
        ).rejects.toThrow('API Failure');
    });

    test('adds event to calendar successfully', async () => {
        fetch.mockResolvedValueOnce({
            json: async () => ({
                id: 'calendar-event-1',
            }),
        });

        const result = await addToCalendar('token123', {
            id: 'app-event-1',
            title: 'Hackathon',
            description: 'Coding Event',
            location: 'Online',
            startAt,
            endAt,
            meetLink: 'https://meet.google.com/test',
        });

        expect(fetch).toHaveBeenCalled();

        expect(result.id).toBe('calendar-event-1');
    });

    test('throws error when addToCalendar fails', async () => {
        fetch.mockResolvedValueOnce({
            json: async () => ({
                error: {
                    message: 'Calendar Failure',
                },
            }),
        });

        await expect(
            addToCalendar('token123', {
                id: 'app-event-1',
                title: 'Hackathon',
                description: 'Coding Event',
                location: 'Online',
                startAt,
                endAt,
            }),
        ).rejects.toThrow('Calendar Failure');
    });
});
