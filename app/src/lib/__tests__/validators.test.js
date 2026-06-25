jest.mock('firebase/firestore', () => ({
    addDoc: jest.fn(),
    setDoc: jest.fn(),
    updateDoc: jest.fn(),
    collection: jest.fn(),
    doc: jest.fn(),
}));

import {
    validate,
    eventSchema,
    eventUpdateSchema,
    userSchema,
    userUpdateSchema,
    clubSchema,
    checkInSchema,
    feedbackSchema,
    messageSchema,
    bookmarkSchema,
    viewSchema,
} from '../validators';

describe('eventSchema', () => {
    const validEvent = {
        title: 'Tech Symposium 2026',
        description: 'Annual tech symposium with workshops and talks',
        category: 'Tech',
        ownerId: 'user_123',
        startAt: new Date().toISOString(),
    };

    it('accepts valid event data', async () => {
        const result = await validate(validEvent, eventSchema);
        expect(result.title).toBe('Tech Symposium 2026');
    });

    it('rejects missing required fields', async () => {
        await expect(validate({}, eventSchema)).rejects.toThrow(/title|description|category|startAt/);
    });

    it('rejects title shorter than 3 characters', async () => {
        await expect(
            validate({ ...validEvent, title: 'AB' }, eventSchema),
        ).rejects.toThrow('at least 3 characters');
    });

    it('rejects title longer than 200 characters', async () => {
        await expect(
            validate({ ...validEvent, title: 'A'.repeat(201) }, eventSchema),
        ).rejects.toThrow('at most 200 characters');
    });

    it('rejects description longer than 2000 characters', async () => {
        await expect(
            validate({ ...validEvent, description: 'A'.repeat(2001) }, eventSchema),
        ).rejects.toThrow('at most 2000 characters');
    });

    it('strips unknown fields', async () => {
        const result = await validate({ ...validEvent, maliciousField: 'inject' }, eventSchema);
        expect(result.maliciousField).toBeUndefined();
    });

    it('rejects invalid price type', async () => {
        await expect(
            validate({ ...validEvent, price: 'free' }, eventSchema),
        ).rejects.toThrow('price');
    });

    it('rejects negative price', async () => {
        await expect(
            validate({ ...validEvent, price: -10 }, eventSchema),
        ).rejects.toThrow('cannot be negative');
    });

    it('accepts minimal valid event', async () => {
        const result = await validate(
            { title: 'Min Event', description: 'Desc', category: 'Tech', ownerId: 'u1', startAt: new Date().toISOString() },
            eventSchema,
        );
        expect(result.title).toBe('Min Event');
    });
});

describe('eventUpdateSchema', () => {
    it('accepts partial update data', async () => {
        const result = await validate({ title: 'Updated Title' }, eventUpdateSchema);
        expect(result.title).toBe('Updated Title');
    });

    it('accepts empty update', async () => {
        const result = await validate({}, eventUpdateSchema);
        expect(result).toEqual({});
    });

    it('rejects invalid field type', async () => {
        await expect(
            validate({ price: 'not-a-number' }, eventUpdateSchema),
        ).rejects.toThrow('price');
    });
});

describe('userSchema', () => {
    const validUser = {
        email: 'student@university.edu',
    };

    it('accepts valid user data', async () => {
        const result = await validate(validUser, userSchema);
        expect(result.email).toBe('student@university.edu');
    });

    it('rejects missing email', async () => {
        await expect(validate({}, userSchema)).rejects.toThrow('email is required');
    });

    it('rejects invalid email', async () => {
        await expect(validate({ email: 'not-an-email' }, userSchema)).rejects.toThrow('Invalid email');
    });

    it('rejects invalid role', async () => {
        await expect(
            validate({ email: 'a@b.com', role: 'superadmin' }, userSchema),
        ).rejects.toThrow('role');
    });

    it('accepts user with all optional fields', async () => {
        const result = await validate(
            {
                email: 'test@test.com',
                displayName: 'John Doe',
                role: 'student',
                points: 100,
                branch: 'CSE',
                year: 3,
                bio: 'Hello world',
            },
            userSchema,
        );
        expect(result.displayName).toBe('John Doe');
        expect(result.points).toBe(100);
    });
});

describe('userUpdateSchema', () => {
    it('accepts partial user update', async () => {
        const result = await validate({ displayName: 'New Name' }, userUpdateSchema);
        expect(result.displayName).toBe('New Name');
    });
});

describe('clubSchema', () => {
    const validClub = {
        title: 'Computer Science Club',
        ownerId: 'user_123',
    };

    it('accepts valid club data', async () => {
        const result = await validate(validClub, clubSchema);
        expect(result.title).toBe('Computer Science Club');
    });

    it('rejects missing title', async () => {
        await expect(validate({ ownerId: 'u1' }, clubSchema)).rejects.toThrow('title');
    });
});

describe('checkInSchema', () => {
    it('accepts valid check-in data', async () => {
        const result = await validate(
            { userId: 'u1', userName: 'John', userEmail: 'john@test.com', checkedInAt: new Date().toISOString() },
            checkInSchema,
        );
        expect(result.userId).toBe('u1');
    });
});

describe('feedbackSchema', () => {
    it('accepts valid feedback', async () => {
        const result = await validate(
            { userId: 'u1', description: 'Great event!', rating: 5 },
            feedbackSchema,
        );
        expect(result.description).toBe('Great event!');
    });

    it('rejects missing description', async () => {
        await expect(validate({ userId: 'u1' }, feedbackSchema)).rejects.toThrow('Description is required');
    });
});

describe('messageSchema', () => {
    it('accepts valid message', async () => {
        const result = await validate(
            { text: 'Hello everyone!', userId: 'u1' },
            messageSchema,
        );
        expect(result.text).toBe('Hello everyone!');
    });

    it('rejects empty message', async () => {
        await expect(
            validate({ text: '', userId: 'u1' }, messageSchema),
        ).rejects.toThrow('Message text is required');
    });

    it('rejects message over 1000 chars', async () => {
        await expect(
            validate({ text: 'A'.repeat(1001), userId: 'u1' }, messageSchema),
        ).rejects.toThrow('Message too long');
    });
});

describe('bookmarkSchema', () => {
    it('accepts valid bookmark', async () => {
        const result = await validate(
            { eventId: 'evt_123', savedAt: new Date().toISOString() },
            bookmarkSchema,
        );
        expect(result.eventId).toBe('evt_123');
    });
});

describe('viewSchema', () => {
    it('accepts valid view record', async () => {
        const result = await validate(
            { viewedAt: new Date().toISOString(), userId: 'u1', userName: 'John' },
            viewSchema,
        );
        expect(result.userId).toBe('u1');
    });
});
