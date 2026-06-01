import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Directory containing the EmailJS HTML templates.
 * Resolved from the compiled output location (lib/utils/) or source (src/utils/) to templates/.
 */
const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

const templateCache: Record<string, string> = {};

/**
 * Sample data for each known template, used for previews when no data is supplied.
 */
const SAMPLE_DATA: Record<string, Record<string, string>> = {
    certificate_email_template: {
        to_name: 'Jane Doe',
        event_title: 'Hackathon 2026',
        cert_url: '#',
        linkedin_url: '#',
        download_btn_display: 'inline-block',
        date: 'May 30, 2026',
    },
    feedback_email_template: {
        to_name: 'John Smith',
        event_title: 'Tech Talk: AI in Campus',
        feedback_link: 'https://example.com/feedback',
    },
    universal_email_template: {
        subject: 'Welcome to UniEvent!',
        to_name: 'Alex Kumar',
        message:
            'You have been successfully registered for the event. We look forward to seeing you there!',
        cert_display: 'none',
        event_title: 'Annual Fest 2026',
        date: 'May 30, 2026',
        download_btn_display: 'none',
        browse_btn_display: 'inline-block',
        event_link: '#',
    },
};

/**
 * Returns the list of available template names (without the .html extension).
 * Only returns names whose corresponding .html files exist in TEMPLATES_DIR.
 */
export function getAvailableTemplates(): string[] {
    if (fs.existsSync(TEMPLATES_DIR)) {
        return fs
            .readdirSync(TEMPLATES_DIR)
            .filter(file => file.endsWith('.html'))
            .map(file => file.replace(/\.html$/, ''));
    }
    return [];
}

/**
 * Returns the built-in sample data for a given template name.
 * If no sample data is defined, returns an empty object.
 */
export function getSampleData(templateName: string): Record<string, string> {
    return SAMPLE_DATA[templateName] ?? {};
}

/**
 * Reads an HTML template file and replaces all `{{variable}}` placeholders
 * with the corresponding values from `data`. Any placeholders not present in
 * `data` will fall back to built-in sample data for that template.
 *
 * The templateName is validated against the known allowlist to prevent
 * path traversal attacks (CWE-22).
 *
 * @param templateName - Name of the template file (without .html extension)
 * @param data - Optional key-value pairs to inject into the template
 * @returns The rendered HTML string
 * @throws Error if the template name is unknown or the file does not exist
 */
export function renderTemplate(templateName: string, data?: Record<string, string>): string {
    // Validate against the known allowlist — prevents path traversal
    const available = getAvailableTemplates();
    if (!available.includes(templateName)) {
        throw new Error(`Template "${templateName}" not found. Available: ${available.join(', ')}`);
    }

    // Safe: templateName is now guaranteed to be a known basename with no path separators
    let html = templateCache[templateName];
    if (!html || process.env.NODE_ENV !== 'production') {
        const filePath = path.join(TEMPLATES_DIR, `${templateName}.html`);
        html = fs.readFileSync(filePath, 'utf-8');
        templateCache[templateName] = html;
    }

    // Merge: explicit data overrides sample data
    const sampleData = getSampleData(templateName);
    const mergedData: Record<string, string> = { ...sampleData, ...data };

    // Helper to escape HTML characters
    const escapeHtml = (unsafe: string) => {
        return unsafe
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    };

    // Replace all {{variable}} placeholders
    return html.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
        return mergedData[key] === undefined ? `{{${key}}}` : escapeHtml(mergedData[key]);
    });
}
