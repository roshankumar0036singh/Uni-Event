import * as XLSX from 'xlsx';

/**
 * WEB VERSION: Exports an array of participant objects to an Excel file and downloads it.
 */
export const exportParticipantsToExcel = async (participants, eventTitle) => {
    try {
        // 1. Format Data
        const data = participants.map(p => ({
            Name: p.name || 'N/A',
            Email: p.email || 'N/A',
            Branch: p.branch || 'Unknown',
            Year: p.year || 'Unknown',
            'Joined At': p.joinedAt ? new Date(p.joinedAt).toLocaleString() : 'N/A',
            'User ID': p.userId || p.id || 'N/A',
        }));

        // 2. Create Workbook
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Participants');

        // Define a safe filename
        const safeTitle = eventTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
        const fileName = `${safeTitle}_participants.xlsx`;

        // 3. Download File (Web)
        XLSX.writeFile(workbook, fileName);
    } catch (error) {
        console.error('Export Error:', error);
        throw new Error('Failed to generate Excel file.');
    }
};
