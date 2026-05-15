const { assertFails, assertSucceeds, initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const fs = require('fs');

describe('Firebase Storage Security Rules', () => {
    let testEnv;

    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            projectId: "security-bug-fix-test",
            storage: {
                host: "127.0.0.1",
                port: 9199,
                rules: fs.readFileSync('storage.rules', 'utf8'),
            },
        });
    });

    afterAll(async () => {
        await testEnv.cleanup();
    });
    
    beforeEach(async () => {
        await testEnv.clearStorage();
    });

    describe('Profile Photos (/users/{uid}/avatar)', () => {

        it('Verify unauthorized overwrites are rejected (User A cannot overwrite User B)', async () => {
            const attackerContext = testEnv.authenticatedContext('attacker123');
            const attackerStorage = attackerContext.storage();

            const victimAvatarRef = attackerStorage.ref('users/victim456/avatar');
            const mockImage = new Uint8Array(1024*1024);
            await assertFails(victimAvatarRef.put(mockImage,{contentType: 'image/png'}));
        });

        it('Verify owner can successfully upload an avatar within constraints', async () => {
            const ownerContext = testEnv.authenticatedContext('student123');
            const ownerStorage = ownerContext.storage();

            const ownerAvatarRef = ownerStorage.ref('users/student123/avatar');
            const mockImage = new Uint8Array(1024 * 1024); 
            await assertSucceeds(ownerAvatarRef.put(mockImage, { contentType: 'image/jpeg' }));
        });

        it('Verify file size guard rejects files larger than 5MB', async () => {
            const ownerContext = testEnv.authenticatedContext('student123');
            const ownerStorage = ownerContext.storage();

            const ownerAvatarRef = ownerStorage.ref('users/student123/avatar');
            const oversizedImage = new Uint8Array(6 * 1024 * 1024);
            await assertFails(ownerAvatarRef.put(oversizedImage, { contentType: 'image/jpeg' }));
        });
        
    });

    describe('Event Banners (/events/{eventId}/{file})', () => {

        it('Verify normal users cannot overwrite event banners',async () => {
            const normalUserContext = testEnv.authenticatedContext('student123');
            const storage = normalUserContext.storage();

            const bannerRef = storage.ref('events/dance-party/banner.png');
            const mockImage = new Uint8Array(1024 * 1024);
            await assertFails(bannerRef.put(mockImage, { contentType: 'image/png' }));
        });

        it('Verify club admins can upload event banners', async () => {
            const adminContext = testEnv.authenticatedContext('club-prez', { club: true });
            const storage = adminContext.storage();

            const bannerRef = storage.ref('events/dance-party/banner.png');
            const mockImage = new Uint8Array(1024);
            await assertSucceeds(bannerRef.put(mockImage, { contentType: 'image/png' }));
        });

        it('Verify system admins can upload event banners', async () => {
            const superAdminContext = testEnv.authenticatedContext('admin999', { admin: true });
            const storage = superAdminContext.storage();

            const bannerRef = storage.ref('events/dance-party/banner.png');
            const mockImage = new Uint8Array(1024);
            await assertSucceeds(bannerRef.put(mockImage, { contentType: 'image/png' }));
        });
    
  });

});
