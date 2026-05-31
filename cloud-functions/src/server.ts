import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import * as admin from 'firebase-admin';
import { checkAndUpdateRateLimit } from './utils/rateLimiter';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin (ensure service account is available or uses default credentials)
// For Render, we might need to rely on strict env vars or a service account file
if (admin.apps.length === 0) {
    // Try to load credentials from environment variable
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

    if (credentialsJson) {
        try {
            const serviceAccount = JSON.parse(credentialsJson);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            console.log('✅ Firebase Admin initialized with service account from env');
        } catch (error) {
            console.error('❌ Failed to parse service account JSON:', error);
            admin.initializeApp();
        }
    } else {
        // Fallback to default credentials
        admin.initializeApp();
        console.log('⚠️  Firebase Admin initialized with default credentials');
    }
}

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: true }));
app.use(express.json());

// Auth Middleware to mimic Firebase Callable Context
const validateFirebaseIdToken = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
) => {
    if (!req.headers.authorization?.startsWith('Bearer ')) {
        res.status(403).send('Unauthorized');
        return;
    }

    const idToken = req.headers.authorization.split('Bearer ')[1];
    try {
        const decodedIdToken = await admin.auth().verifyIdToken(idToken);
        (req as any).user = decodedIdToken;
        next();
    } catch (error) {
        console.error('Error while verifying Firebase ID token:', error);
        res.status(403).send('Unauthorized');
    }
};

// Rate Limiting Middleware for Server Endpoints
const rateLimitMiddleware = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
) => {
    const user = (req as any).user;
    if (!user) {
        return next();
    }

    try {
        // Determine if the operation is event creation or regular write
        const isEventCreation = req.path === '/api/createEvent';
        const limitResult = await checkAndUpdateRateLimit(user.uid, isEventCreation);

        if (!limitResult.allowed) {
            return res.status(limitResult.statusCode).json({
                error: 'too-many-requests',
                message: limitResult.message,
            });
        }
        next();
    } catch (error) {
        console.error('Rate limiter middleware error:', error);
        return res.status(503).json({
            error: 'rate-limit-unavailable',
            message: 'Rate limiting is temporarily unavailable. Please retry shortly.',
        });
    }
};

// setRole Implementation (adapted from setRole.ts logic)
app.post(
    '/api/setRole',
    validateFirebaseIdToken,
    rateLimitMiddleware,
    async (req: express.Request, res: express.Response) => {
        const user = (req as any).user;

        // 1. Check Auth (already done by middleware, but check existence)
        if (!user) {
            return res.status(401).json({
                error: 'unauthenticated',
                message: 'The function must be called while authenticated.',
            });
        }

        // 2. Check Admin
        // Note: We use the token claims.
        // IMPORTANT: For the very first admin, manual entry in DB or claims is needed.
        if (!user.admin) {
            return res
                .status(403)
                .json({ error: 'permission-denied', message: 'Only admins can set roles.' });
        }

        const { uid, role } = req.body;

        // 3. Validation
        if (!uid || !role) {
            return res.status(400).json({
                error: 'invalid-argument',
                message: "The function must be called with 'uid' and 'role' arguments.",
            });
        }

        const validRoles = ['admin', 'club', 'student'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                error: 'invalid-argument',
                message: `Role must be one of: ${validRoles.join(', ')}`,
            });
        }

        // 4. Logic
        const claims: { [key: string]: boolean } = {};
        if (role === 'admin') claims.admin = true;
        if (role === 'club') claims.club = true;

        try {
            await admin.auth().setCustomUserClaims(uid, claims);

            // Optional: Update Firestore
            await admin.firestore().collection('users').doc(uid).set({ role }, { merge: true });

            return res.json({ result: { success: true } }); // Structure matches Callable response
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'internal', message: 'Error setting role' });
        }
    },
);

// Send Certificates Endpoint
import { sendCertificatesForEvent } from './certificateService';

app.post(
    '/api/sendCertificates',
    validateFirebaseIdToken,
    rateLimitMiddleware,
    async (req: express.Request, res: express.Response) => {
        const user = (req as any).user;
        const { eventId } = req.body;

        if (!user) {
            return res.status(401).json({ error: 'unauthenticated' });
        }

        if (!eventId) {
            return res
                .status(400)
                .json({ error: 'invalid-argument', message: 'eventId is required' });
        }

        try {
            const result = await sendCertificatesForEvent(eventId, user.uid);
            return res.json({ result });
        } catch (error: any) {
            console.error('Certificate Error:', error);
            return res.status(500).json({ error: 'internal', message: error.message });
        }
    },
);

// ── Email Template Preview Endpoints (developer-facing, no auth required) ──
import {
    getAvailableTemplates,
    renderTemplate,
    getSampleData,
} from './utils/emailTemplateRenderer';

/**
 * GET /email-preview
 * Lists all available email templates with clickable preview links.
 */
app.get('/email-preview', (_req: express.Request, res: express.Response) => {
    if (process.env.NODE_ENV === 'production') {
        res.status(403).json({ error: 'Previews are disabled in production' });
        return;
    }

    const templates = getAvailableTemplates();

    const links = templates
        .map(
            name =>
                `<li style="margin:8px 0">
          <a href="/email-preview/${name}" style="color:#FF6B35;font-size:18px">${name}</a>
          <span style="color:#888;font-size:13px;margin-left:8px">
            (variables: ${Object.keys(getSampleData(name)).join(', ') || 'none'})
          </span>
        </li>`,
        )
        .join('\n');

    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>UniEvent — Email Template Previews</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; background: #f4f4f4; margin: 0; padding: 40px; }
        .card { max-width: 700px; margin: 0 auto; background: #fff; border-radius: 12px;
                padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        h1 { color: #333; margin-top: 0; }
        .badge { display: inline-block; background: #FF6B35; color: #fff; padding: 2px 10px;
                 border-radius: 12px; font-size: 12px; margin-left: 8px; }
        ul { list-style: none; padding: 0; }
        p.hint { color: #999; font-size: 13px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px; }
        code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>📧 Email Template Previews <span class="badge">${templates.length} templates</span></h1>
        <p style="color:#666">Click a template to preview it with sample data.</p>
        <ul>${links}</ul>
        <p class="hint">
          💡 Override variables via query string, e.g.<br/>
          <code>/email-preview/feedback_email_template?to_name=Alice&event_title=My+Event</code>
        </p>
      </div>
    </body>
    </html>
  `);
});

/**
 * GET /email-preview/:templateName
 * Renders a specific template with sample data. Any template variable can be
 * overridden via query parameters (e.g. ?to_name=Alice&event_title=My+Event).
 */
app.get('/email-preview/:templateName', (req: express.Request, res: express.Response) => {
    if (process.env.NODE_ENV === 'production') {
        res.status(403).json({ error: 'Previews are disabled in production' });
        return;
    }

    const { templateName } = req.params;

    // Escape HTML entities to prevent XSS when reflecting user-controlled values
    const escHtml = (s: string) =>
        s
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');

    // Query params override sample data
    const overrides: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
            overrides[key] = value;
        }
    }

    try {
        const html = renderTemplate(templateName, overrides);

        // Wrap in a preview shell with a toolbar
        const sampleData = getSampleData(templateName);
        const allVars = { ...sampleData, ...overrides };
        const varsJson = JSON.stringify(allVars, null, 2);

        // templateName is validated by renderTemplate's allowlist — escape for display only
        const safeTemplateName = escHtml(templateName);

        const responseHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Preview: ${safeTemplateName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; }
          .toolbar { background: #16213e; color: #fff; padding: 12px 24px;
                     display: flex; align-items: center; justify-content: space-between;
                     border-bottom: 2px solid #FF6B35; position: sticky; top: 0; z-index: 10; }
          .toolbar h2 { font-size: 16px; font-weight: 600; }
          .toolbar a { color: #FF6B35; text-decoration: none; font-size: 14px; }
          .toolbar a:hover { text-decoration: underline; }
          .preview-frame { max-width: 900px; margin: 24px auto; background: #fff;
                           border-radius: 8px; overflow: hidden;
                           box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
          .vars-panel { max-width: 900px; margin: 16px auto 40px;
                        background: #16213e; border-radius: 8px; padding: 20px;
                        color: #ccc; font-size: 13px; }
          .vars-panel h3 { color: #FF6B35; margin-bottom: 8px; font-size: 14px; }
          pre { white-space: pre-wrap; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <h2>📧 ${safeTemplateName}</h2>
          <a href="/email-preview">← All Templates</a>
        </div>
        <div class="preview-frame">
          ${html}
        </div>
        <div class="vars-panel">
          <h3>Template Variables (current)</h3>
          <pre>${escHtml(varsJson)}</pre>
        </div>
      </body>
      </html>
    `;
        res.send(responseHtml); // NOSONAR
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        const errorHtml = `
      <h1>Template Not Found</h1>
      <p>${escHtml(message)}</p>
      <a href="/email-preview">← Back to template list</a>
    `;
        res.status(404).send(errorHtml); // NOSONAR
    }
});

// Basic Health Check
app.get('/', (req, res) => {
    res.send('UniEvent Backend is Running');
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
