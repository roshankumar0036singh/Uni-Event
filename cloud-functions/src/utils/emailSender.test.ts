import { sendEmail } from './emailSender';
import * as emailTemplateRenderer from './emailTemplateRenderer';

// Mock dependencies
jest.mock('./emailTemplateRenderer');

const mockResendSend = jest.fn();
jest.mock('resend', () => ({
    Resend: jest.fn().mockImplementation(() => ({
        emails: {
            send: mockResendSend,
        },
    })),
}));

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
        expect(mockResendSend).not.toHaveBeenCalled();
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
        expect(mockResendSend).not.toHaveBeenCalled();
    });

    it('returns an error if credentials are missing', async () => {
        delete process.env.RESEND_API_KEY;

        (emailTemplateRenderer.renderTemplate as jest.Mock).mockReturnValue('<h1>Hello World</h1>');

        const result = await sendEmail({
            to: 'test@example.com',
            subject: 'Test Subject',
            templateName: 'test_template',
            templateData: { name: 'World' },
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Resend credentials.*not configured/);
        expect(mockResendSend).not.toHaveBeenCalled();
    });

    it('calls Resend and returns success message id', async () => {
        process.env.RESEND_API_KEY = 'test_key';

        (emailTemplateRenderer.renderTemplate as jest.Mock).mockReturnValue('<h1>Hello World</h1>');
        mockResendSend.mockResolvedValueOnce({ data: { id: 'message_123' }, error: null });

        const result = await sendEmail({
            to: 'test@example.com',
            subject: 'Test Subject',
            templateName: 'test_template',
            templateData: { name: 'World' },
        });

        expect(result.success).toBe(true);
        expect(result.messageId).toBe('message_123');
        expect(mockResendSend).toHaveBeenCalledTimes(1);
        expect(mockResendSend).toHaveBeenCalledWith(
            expect.objectContaining({
                from: 'onboarding@resend.dev',
                to: ['test@example.com'],
                subject: 'Test Subject',
                html: '<h1>Hello World</h1>',
            }),
        );
    });

    it('returns an error on Resend provider errors', async () => {
        process.env.RESEND_API_KEY = 'test_key';

        (emailTemplateRenderer.renderTemplate as jest.Mock).mockReturnValue('<h1>Hello World</h1>');
        mockResendSend.mockResolvedValueOnce({ data: null, error: { message: 'Bad Request' } });

        const result = await sendEmail({
            to: 'test@example.com',
            subject: 'Test Subject',
            templateName: 'test_template',
            templateData: { name: 'World' },
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Bad Request');
    });

    it('returns an error on network exception', async () => {
        process.env.RESEND_API_KEY = 'test_key';

        (emailTemplateRenderer.renderTemplate as jest.Mock).mockReturnValue('<h1>Hello World</h1>');
        mockResendSend.mockRejectedValueOnce(new Error('Network failure'));

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
