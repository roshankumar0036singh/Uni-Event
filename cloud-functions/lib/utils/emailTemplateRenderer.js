"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableTemplates = getAvailableTemplates;
exports.getSampleData = getSampleData;
exports.renderTemplate = renderTemplate;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
/**
 * Directory containing the EmailJS HTML templates.
 * Resolved from the compiled output location (lib/utils/) or source (src/utils/) to templates/.
 */
const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');
const templateCache = {};
/**
 * Sample data for each known template, used for previews when no data is supplied.
 */
const SAMPLE_DATA = {
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
        message: 'You have been successfully registered for the event. We look forward to seeing you there!',
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
function getAvailableTemplates() {
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
function getSampleData(templateName) {
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
function renderTemplate(templateName, data) {
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
    const mergedData = { ...sampleData, ...data };
    // Helper to escape HTML characters
    const escapeHtml = (unsafe) => {
        return unsafe
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    };
    // Replace all {{variable}} placeholders
    return html.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
        return mergedData[key] === undefined ? `{{${key}}}` : escapeHtml(mergedData[key]);
    });
}
