import * as XLSX from 'xlsx';

/**
 * Shared logic for preparing an Excel workbook from participants data.
 */
export function prepareParticipantsWorkbook(participants, eventTitle) {
    // 1. Prepare Data
    const data = participants.map((p, index) => ({
        'S.No': index + 1,
        Name: p.name || 'N/A',
        Email: p.email || 'N/A',
        Branch: p.branch || 'N/A',
        Year: p.year || 'N/A',
        Status: p.attended ? 'Present' : 'Absent',
    }));

    // 2. Create Workbook
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Participants');

    const fileName = `participants_${eventTitle.replace(/[^a-z0-9]/gi, '_')}.xlsx`;

    return { workbook, fileName };
}
