import * as path from 'node:path';
import { getAvailableTemplates, getSampleData, renderTemplate } from './emailTemplateRenderer';

// Resolve the templates directory the same way the module does
const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

const expectNoPlaceholders = (html: string, keys: string[]) => {
    for (const key of keys) {
        expect(html).not.toContain(`{{${key}}}`);
    }
};

describe('emailTemplateRenderer', () => {
    // ─── getAvailableTemplates ─────────────────────────────────────────

    describe('getAvailableTemplates()', () => {
        it('should return all 3 known templates', () => {
            const templates = getAvailableTemplates();
            expect(templates).toContain('certificate_email_template');
            expect(templates).toContain('feedback_email_template');
            expect(templates).toContain('universal_email_template');
            expect(templates.length).toBeGreaterThanOrEqual(3);
        });

        it('should only return names without the .html extension', () => {
            const templates = getAvailableTemplates();
            for (const name of templates) {
                expect(name).not.toMatch(/\.html$/);
            }
        });
    });

    // ─── getSampleData ─────────────────────────────────────────────────

    describe('getSampleData()', () => {
        it('should return sample data with expected keys for certificate template', () => {
            const data = getSampleData('certificate_email_template');
            expect(data).toHaveProperty('to_name');
            expect(data).toHaveProperty('event_title');
            expect(data).toHaveProperty('cert_url');
            expect(data).toHaveProperty('date');
        });

        it('should return sample data with expected keys for feedback template', () => {
            const data = getSampleData('feedback_email_template');
            expect(data).toHaveProperty('to_name');
            expect(data).toHaveProperty('event_title');
            expect(data).toHaveProperty('feedback_link');
        });

        it('should return sample data with expected keys for universal template', () => {
            const data = getSampleData('universal_email_template');
            expect(data).toHaveProperty('subject');
            expect(data).toHaveProperty('to_name');
            expect(data).toHaveProperty('message');
            expect(data).toHaveProperty('cert_display');
            expect(data).toHaveProperty('event_title');
        });

        it('should return an empty object for an unknown template', () => {
            const data = getSampleData('nonexistent_template');
            expect(data).toEqual({});
        });
    });

    // ─── renderTemplate ────────────────────────────────────────────────

    describe('renderTemplate()', () => {
        it('should replace placeholders with provided data', () => {
            const html = renderTemplate('feedback_email_template', {
                to_name: 'TestUser',
                event_title: 'TestEvent',
                feedback_link: 'https://test.com/feedback',
            });

            expect(html).toContain('TestUser');
            expect(html).toContain('TestEvent');
            expect(html).toContain('https://test.com/feedback');
            // Should NOT contain raw placeholders for the variables we provided
            expectNoPlaceholders(html, ['to_name', 'event_title', 'feedback_link']);
        });

        it('should use sample data when no data is provided', () => {
            const html = renderTemplate('feedback_email_template');

            // Sample data should be injected — no raw {{...}} for known variables
            expectNoPlaceholders(html, ['to_name', 'event_title', 'feedback_link']);
        });

        it('should render certificate template without leftover placeholders when using defaults', () => {
            const html = renderTemplate('certificate_email_template');

            expectNoPlaceholders(html, ['to_name', 'event_title', 'cert_url', 'date']);
        });

        it('should render universal template without leftover placeholders when using defaults', () => {
            const html = renderTemplate('universal_email_template');

            expectNoPlaceholders(html, [
                'subject',
                'to_name',
                'message',
                'cert_display',
                'event_title',
            ]);
        });

        it('should allow overriding individual variables while filling others from sample data', () => {
            const html = renderTemplate('feedback_email_template', {
                to_name: 'OverriddenName',
            });

            expect(html).toContain('OverriddenName');
            // Other variables should still be filled from sample data
            expectNoPlaceholders(html, ['event_title', 'feedback_link']);
        });

        it('should escape unsafe override values', () => {
            const html = renderTemplate('feedback_email_template', {
                to_name: '<script>alert(1)</script> & Friends',
                event_title: 'Security & Safety',
            });

            expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; Friends');
            expect(html).toContain('Security &amp; Safety');
            expect(html).not.toContain('<script>alert(1)</script> & Friends');
            expect(html).not.toContain('Security & Safety');
            expectNoPlaceholders(html, ['to_name', 'event_title', 'feedback_link']);
        });

        it('should throw an error for a non-existent template', () => {
            expect(() => renderTemplate('nonexistent_template')).toThrow(
                /Template "nonexistent_template" not found/,
            );
        });

        it('should preserve HTML structure', () => {
            const html = renderTemplate('feedback_email_template');
            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('</html>');
        });
    });
});
