import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { prepareParticipantsWorkbook } from './exportUtils';

/**
 * NATIVE VERSION: Exports an array of participant objects to an Excel file and shares it.
 */
export const exportParticipantsToExcel = async (participants, eventTitle) => {
    try {
        const { workbook, fileName } = prepareParticipantsWorkbook(participants, eventTitle);

        // 3. Write to File (Native)
        const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
        const uri = FileSystem.cacheDirectory + fileName;

        await FileSystem.writeAsStringAsync(uri, wbout, {
            encoding: FileSystem.EncodingType.Base64,
        });

        // 4. Share
        if (!(await Sharing.isAvailableAsync())) {
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
