"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTopContributorsSchema = exports.setRoleSchema = void 0;
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
