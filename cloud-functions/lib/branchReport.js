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
exports.generateBranchParticipationReport = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const pdf_lib_1 = require("pdf-lib");
const normalizeBranch = (value) => {
    if (value == null)
        return 'Unknown';
    if (typeof value !== 'string' && typeof value !== 'number')
        return 'Unknown';
    const raw = String(value).trim();
    if (!raw)
        return 'Unknown';
    return raw.replace(/[./#[\]$]/g, '_');
};
const toDateInput = (value, fieldName) => {
    if (value == null || value === '')
        return null;
    if (typeof value !== 'string' && typeof value !== 'number') {
        throw new functions.https.HttpsError('invalid-argument', `${fieldName} must be a date string or timestamp.`);
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new functions.https.HttpsError('invalid-argument', `${fieldName} must be a valid date.`);
    }
    return date;
};
const ensureStats = (statsByBranch, branch) => {
    const normalized = normalizeBranch(branch);
    const existing = statsByBranch.get(normalized);
    if (existing)
        return existing;
    const stats = {
        branch: normalized,
        registrations: 0,
        attendance: 0,
        events: new Set(),
    };
    statsByBranch.set(normalized, stats);
    return stats;
};
const drawText = (page, text, x, y, options) => {
    page.drawText(text, {
        x,
        y,
        size: options.size,
        font: options.font,
        color: options.color || (0, pdf_lib_1.rgb)(0.12, 0.16, 0.23),
    });
};
const formatPercent = (value) => `${value.toFixed(1)}%`;
const buildPdf = async (rows, meta) => {
    const pdfDoc = await pdf_lib_1.PDFDocument.create();
    const regularFont = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.HelveticaBold);
    const pageWidth = 842;
    const pageHeight = 595;
    const margin = 42;
    const rowHeight = 24;
    const headerFill = (0, pdf_lib_1.rgb)(0.93, 0.95, 0.98);
    const borderColor = (0, pdf_lib_1.rgb)(0.82, 0.86, 0.92);
    const textColor = (0, pdf_lib_1.rgb)(0.12, 0.16, 0.23);
    const mutedColor = (0, pdf_lib_1.rgb)(0.36, 0.42, 0.5);
    const accentColor = (0, pdf_lib_1.rgb)(0.1, 0.38, 0.85);
    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;
    const addPage = () => {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
    };
    const drawReportHeader = () => {
        drawText(page, 'Branch-wise Participation Report', margin, y, {
            size: 22,
            font: boldFont,
            color: accentColor,
        });
        y -= 26;
        let period = 'All available events';
        if (meta.fromDate || meta.toDate) {
            const periodStart = meta.fromDate
                ? meta.fromDate.toLocaleDateString('en-US')
                : 'Beginning';
            const periodEnd = meta.toDate ? meta.toDate.toLocaleDateString('en-US') : 'Present';
            period = `${periodStart} - ${periodEnd}`;
        }
        drawText(page, `Period: ${period}`, margin, y, {
            size: 10,
            font: regularFont,
            color: mutedColor,
        });
        y -= 16;
        drawText(page, `Generated: ${meta.generatedAt.toLocaleString('en-US')}`, margin, y, {
            size: 10,
            font: regularFont,
            color: mutedColor,
        });
        y -= 32;
        const summaryItems = [
            ['Events', meta.eventCount],
            ['Registrations', meta.totalRegistrations],
            ['Attendance', meta.totalAttendance],
            ['Departments', rows.length],
        ];
        const cardWidth = 170;
        summaryItems.forEach(([label, value], index) => {
            const x = margin + index * (cardWidth + 14);
            page.drawRectangle({
                x,
                y: y - 52,
                width: cardWidth,
                height: 52,
                color: headerFill,
                borderColor,
                borderWidth: 1,
            });
            drawText(page, String(value), x + 12, y - 22, {
                size: 18,
                font: boldFont,
                color: textColor,
            });
            drawText(page, String(label), x + 12, y - 40, {
                size: 9,
                font: regularFont,
                color: mutedColor,
            });
        });
        y -= 82;
    };
    const drawTableHeader = () => {
        page.drawRectangle({
            x: margin,
            y: y - rowHeight + 6,
            width: pageWidth - margin * 2,
            height: rowHeight,
            color: headerFill,
            borderColor,
            borderWidth: 1,
        });
        const columns = [
            ['Rank', margin + 10],
            ['Branch', margin + 62],
            ['Registrations', margin + 220],
            ['Attendance', margin + 350],
            ['Events', margin + 470],
            ['Share', margin + 555],
            ['Attendance Rate', margin + 635],
        ];
        columns.forEach(([label, x]) => {
            drawText(page, String(label), Number(x), y - 10, {
                size: 9,
                font: boldFont,
                color: textColor,
            });
        });
        y -= rowHeight;
    };
    drawReportHeader();
    drawTableHeader();
    if (rows.length === 0) {
        drawText(page, 'No branch participation data found.', margin, y - 20, {
            size: 12,
            font: regularFont,
            color: mutedColor,
        });
    }
    rows.forEach(row => {
        if (y < margin + rowHeight) {
            addPage();
            drawTableHeader();
        }
        page.drawLine({
            start: { x: margin, y: y - rowHeight + 5 },
            end: { x: pageWidth - margin, y: y - rowHeight + 5 },
            thickness: 0.5,
            color: borderColor,
        });
        const values = [
            [String(row.rank), margin + 10],
            [row.branch, margin + 62],
            [String(row.registrations), margin + 220],
            [String(row.attendance), margin + 350],
            [String(row.eventCount), margin + 470],
            [formatPercent(row.registrationShare), margin + 555],
            [formatPercent(row.attendanceRate), margin + 635],
        ];
        values.forEach(([value, x]) => {
            drawText(page, String(value), Number(x), y - 11, {
                size: 9,
                font: regularFont,
                color: textColor,
            });
        });
        y -= rowHeight;
    });
    const pages = pdfDoc.getPages();
    pages.forEach((pdfPage, index) => {
        drawText(pdfPage, `UniEvent | Page ${index + 1} of ${pages.length}`, margin, 24, {
            size: 8,
            font: regularFont,
            color: mutedColor,
        });
    });
    return Buffer.from(await pdfDoc.save());
};
exports.generateBranchParticipationReport = functions.https.onCall(async (data, context) => {
    if (!context.auth?.token?.admin) {
        throw new functions.https.HttpsError('permission-denied', 'Admin privileges required.');
    }
    const fromDate = toDateInput(data?.fromDate, 'fromDate');
    const toDate = toDateInput(data?.toDate, 'toDate');
    if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
        throw new functions.https.HttpsError('invalid-argument', 'fromDate cannot be after toDate.');
    }
    const db = admin.firestore();
    let eventsQuery = db.collection('events');
    if (fromDate) {
        eventsQuery = eventsQuery.where('startAt', '>=', fromDate.toISOString());
    }
    if (toDate) {
        eventsQuery = eventsQuery.where('startAt', '<=', toDate.toISOString());
    }
    const eventsSnap = await eventsQuery.get();
    const statsByBranch = new Map();
    for (const eventDoc of eventsSnap.docs) {
        const event = eventDoc.data() || {};
        const branchCounts = event.branchCounts;
        const branchCountEntries = branchCounts && typeof branchCounts === 'object' && !Array.isArray(branchCounts)
            ? Object.entries(branchCounts).filter(([, count]) => Number(count) > 0)
            : [];
        if (branchCountEntries.length > 0) {
            branchCountEntries.forEach(([branch, count]) => {
                const numericCount = Number(count) || 0;
                const stats = ensureStats(statsByBranch, branch);
                stats.registrations += numericCount;
                if (numericCount > 0)
                    stats.events.add(eventDoc.id);
            });
        }
        else {
            const participantsSnap = await eventDoc.ref.collection('participants').get();
            participantsSnap.forEach(participantDoc => {
                const participant = participantDoc.data() || {};
                const stats = ensureStats(statsByBranch, participant.branch);
                stats.registrations += 1;
                stats.events.add(eventDoc.id);
            });
        }
        const checkInsSnap = await eventDoc.ref.collection('checkIns').get();
        checkInsSnap.forEach(checkInDoc => {
            const checkIn = checkInDoc.data() || {};
            const branch = normalizeBranch(checkIn.userBranch || checkIn.branch);
            const stats = ensureStats(statsByBranch, branch);
            stats.attendance += 1;
            stats.events.add(eventDoc.id);
        });
    }
    const totalRegistrations = Array.from(statsByBranch.values()).reduce((sum, stats) => sum + stats.registrations, 0);
    const totalAttendance = Array.from(statsByBranch.values()).reduce((sum, stats) => sum + stats.attendance, 0);
    const rows = Array.from(statsByBranch.values())
        .sort((a, b) => {
        if (b.registrations !== a.registrations) {
            return b.registrations - a.registrations;
        }
        if (b.attendance !== a.attendance) {
            return b.attendance - a.attendance;
        }
        return a.branch.localeCompare(b.branch);
    })
        .map((stats, index) => ({
        rank: index + 1,
        branch: stats.branch,
        registrations: stats.registrations,
        attendance: stats.attendance,
        eventCount: stats.events.size,
        registrationShare: totalRegistrations > 0 ? (stats.registrations / totalRegistrations) * 100 : 0,
        attendanceRate: stats.registrations > 0 ? (stats.attendance / stats.registrations) * 100 : 0,
    }));
    const generatedAt = new Date();
    const pdfBuffer = await buildPdf(rows, {
        generatedAt,
        fromDate,
        toDate,
        totalRegistrations,
        totalAttendance,
        eventCount: eventsSnap.size,
    });
    return {
        success: true,
        fileName: `branch-participation-report-${generatedAt.toISOString().slice(0, 10)}.pdf`,
        mimeType: 'application/pdf',
        base64: pdfBuffer.toString('base64'),
        summary: {
            eventCount: eventsSnap.size,
            branchCount: rows.length,
            totalRegistrations,
            totalAttendance,
        },
        rows,
    };
});
