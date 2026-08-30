jest.mock('firebase-admin', () => ({
    apps: [],
    initializeApp: jest.fn(),
    credential: {
        cert: jest.fn(cert => {
            if (!cert || !cert.private_key || !cert.client_email || !cert.project_id) {
                throw new Error(
                    'Credential implementation provided to initializeApp() must be an object with private_key, client_email and project_id',
                );
            }
            return { cert };
        }),
    },
}));

const admin = require('firebase-admin');
const { initFirebaseAdmin } = require('./server');

describe('initFirebaseAdmin', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        admin.apps.length = 0;
    });

    test('throws a critical error on malformed credential JSON instead of falling back', () => {
        expect(() => initFirebaseAdmin('{not valid json')).toThrow(
            /Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON.*Refusing to fall back/,
        );
        expect(admin.initializeApp).not.toHaveBeenCalled();
    });

    test('throws on structurally invalid but parseable credential JSON (missing private_key)', () => {
        expect(() =>
            initFirebaseAdmin(JSON.stringify({ project_id: 'x', client_email: 'a@b.c' })),
        ).toThrow(/Failed to initialize GOOGLE_APPLICATION_CREDENTIALS_JSON/);
        expect(admin.initializeApp).not.toHaveBeenCalled();
    });

    test('initializes from env credentials when JSON is valid', () => {
        const valid = JSON.stringify({
            project_id: 'p',
            client_email: 'a@b.c',
            private_key: 'KEY',
        });
        const source = initFirebaseAdmin(valid);
        expect(source).toBe('env');
        expect(admin.initializeApp).toHaveBeenCalledTimes(1);
    });

    test('falls back to default credentials when env var is absent', () => {
        const source = initFirebaseAdmin(undefined);
        expect(source).toBe('default');
        expect(admin.initializeApp).toHaveBeenCalledTimes(1);
        expect(admin.initializeApp).toHaveBeenCalledWith();
    });

    test('is a no-op when Admin is already initialized', () => {
        admin.apps.length = 1;
        initFirebaseAdmin('{"broken":');
        expect(admin.initializeApp).not.toHaveBeenCalled();
    });
});
