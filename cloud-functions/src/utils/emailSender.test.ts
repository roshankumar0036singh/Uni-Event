import { sendEmail } from './emailSender';
import * as emailTemplateRenderer from './emailTemplateRenderer';

// Mock dependencies
jest.mock('./emailTemplateRenderer');

const mockFetch = jest.fn();
globalThis.fetch = mockFetch as any;

describe('sendEmail', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('renders template and returns HTML on dry run', async () => {
        (emailTemplateRenderer.renderTemplate as jest.Mock).mockReturnValue('<h1>Hello World</h1>');

        const result = await sendEmail({
            to: 'test@example.com',
            subject: 'Test Subject',
            templateName: 'test_template',
            templateData: { name: 'World' },
            dryRun: true,
        });

        expect(result.success).toBe(true);
        expect(result.html).toBe('<h1>Hello World</h1>');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns an error if renderTemplate fails', async () => {
        (emailTemplateRenderer.renderTemplate as jest.Mock).mockImplementation(() => {
            throw new Error('Template not found');
        });

        const result = await sendEmail({
            to: 'test@example.com',
            subject: 'Test Subject',
            templateName: 'test_template',
            templateData: { name: 'World' },
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Template not found');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns an error if credentials are missing', async () => {
        delete process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID;
        delete process.env.EMAILJS_SERVICE_ID;
        delete process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY;
        delete process.env.EMAILJS_PUBLIC_KEY;

        (emailTemplateRenderer.renderTemplate as jest.Mock).mockReturnValue('<h1>Hello World</h1>');

        const result = await sendEmail({
            to: 'test@example.com',
            subject: 'Test Subject',
            templateName: 'test_template',
            templateData: { name: 'World' },
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/EmailJS credentials.*not configured/);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('calls fetch and returns success message on OK response', async () => {
        process.env.EMAILJS_SERVICE_ID = 'test_service';
        process.env.EMAILJS_PUBLIC_KEY = 'test_pk';

        (emailTemplateRenderer.renderTemplate as jest.Mock).mockReturnValue('<h1>Hello World</h1>');
        mockFetch.mockResolvedValueOnce({
            ok: true,
            text: async () => 'OK',
        });

        const result = await sendEmail({
            to: 'test@example.com',
            subject: 'Test Subject',
            templateName: 'test_template',
            templateData: { name: 'World' },
        });

        expect(result.success).toBe(true);
        expect(result.messageId).toBe('OK');
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.emailjs.com/api/v1.0/email/send',
            expect.objectContaining({ method: 'POST' }),
        );
    });

    it('returns an error on non-OK response', async () => {
        process.env.EMAILJS_SERVICE_ID = 'test_service';
        process.env.EMAILJS_PUBLIC_KEY = 'test_pk';

        (emailTemplateRenderer.renderTemplate as jest.Mock).mockReturnValue('<h1>Hello World</h1>');
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            text: async () => 'Bad Request',
        });

        const result = await sendEmail({
            to: 'test@example.com',
            subject: 'Test Subject',
            templateName: 'test_template',
            templateData: { name: 'World' },
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('EmailJS error (400): Bad Request');
    });

    it('returns an error on network exception', async () => {
        process.env.EMAILJS_SERVICE_ID = 'test_service';
        process.env.EMAILJS_PUBLIC_KEY = 'test_pk';

        (emailTemplateRenderer.renderTemplate as jest.Mock).mockReturnValue('<h1>Hello World</h1>');
        mockFetch.mockRejectedValueOnce(new Error('Network failure'));

        const result = await sendEmail({
            to: 'test@example.com',
            subject: 'Test Subject',
            templateName: 'test_template',
            templateData: { name: 'World' },
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Network failure');
    });
});
