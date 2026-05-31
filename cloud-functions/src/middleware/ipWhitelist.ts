import { Request, Response, NextFunction } from "express";

export function ipWhitelist(req: Request, res: Response, next: NextFunction): void {

    if (process.env.ENABLE_IP_WHITELIST === 'false') {
        console.warn('[ipWhitelist] IP check is DISABLED  do not use in production');
        next();
        return;
    }

    const allowedIps = (process.env.ALLOWED_IPS || '')
        .split(',')
        .map((ip) => ip.trim())
        .filter(Boolean);

    if (allowedIps.length === 0) {
        console.error('[ipWhitelist] ALLOWED_IPS is not configured — blocking all requests');
        res.status(403).json({ error: 'Forbidden' });
        return;
    }


    const normalizeIp = (ip: string) => ip.replace(/^::ffff:/, '');
    const callerIp = normalizeIp(req.ip || '');

    if (!callerIp || !allowedIps.includes(callerIp)) {
        console.warn(`[ipWhitelist] Blocked request from IP: ${callerIp}`);
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    next();
}