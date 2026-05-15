import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

/**
 * NATIVE VERSION: Exports an array of participant objects to an Excel file and shares it.
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

        // 3. Write to File (Native)
        const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
        const uri = FileSystem.cacheDirectory + fileName;

        await FileSystem.writeAsStringAsync(uri, wbout, {
            encoding: FileSystem.EncodingType.Base64,
        });

        // 4. Share
        if (!(await Sharing.isAvailableAsync())) {
            // Fallback if sharing isn't available
            alert('Sharing is not available on this device');
            return;
        }

        await Sharing.shareAsync(uri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Download Participant List',
            UTI: 'com.microsoft.excel.xlsx',
        });
    } catch (error) {
        console.error('Export Error:', error);
        throw new Error('Failed to generate or share Excel file.');
    }
};
