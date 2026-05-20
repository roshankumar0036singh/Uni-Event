import {
    collection,
    deleteDoc,
    doc,
    setDoc,
} from 'firebase/firestore';

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    doc: jest.fn(),
    setDoc: jest.fn(() => Promise.resolve()),
    deleteDoc: jest.fn(() => Promise.resolve()),
}));

describe('Follow System', () => {

    const currentUserId = 'user1';
    const targetUserId = 'user2';

    test('should follow user', async () => {

        const followRef = doc(
            {},
            'users',
            currentUserId,
            'following',
            targetUserId
        );

        await setDoc(followRef, {
            createdAt: new Date(),
        });

        expect(setDoc).toHaveBeenCalled();
    });

    test('should unfollow user', async () => {

        const followRef = doc(
            {},
            'users',
            currentUserId,
            'following',
            targetUserId
        );

        await deleteDoc(followRef);

        expect(deleteDoc).toHaveBeenCalled();
    });

});