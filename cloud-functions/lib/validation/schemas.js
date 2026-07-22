"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handoverClubAdminSchema = exports.getTopContributorsSchema = exports.setRoleSchema = void 0;
const zod_1 = require("zod");
exports.setRoleSchema = zod_1.z.object({
    uid: zod_1.z.string().min(1, 'uid is required'),
    role: zod_1.z.enum(['admin', 'club', 'student']),
});
exports.getTopContributorsSchema = zod_1.z
    .object({
    limit: zod_1.z.number().int().min(1).max(25).optional(),
    lastPoints: zod_1.z.number().optional(),
    lastUserId: zod_1.z.string().optional(),
    startRank: zod_1.z.number().int().min(1).optional(),
})
    .refine(data => (data.lastPoints === undefined && data.lastUserId === undefined) ||
    (data.lastPoints !== undefined && data.lastUserId !== undefined), {
    message: 'lastPoints and lastUserId must be provided together',
    path: ['lastPoints'],
});
exports.handoverClubAdminSchema = zod_1.z
    .object({
    newAdminUid: zod_1.z.string().optional(),
    newAdminEmail: zod_1.z.string().email('Invalid email address').optional(),
})
    .refine(data => data.newAdminUid || data.newAdminEmail, {
    message: 'Either newAdminUid or newAdminEmail must be provided',
    path: ['newAdminEmail'],
});
