import * as XLSX from 'xlsx';
import { prepareParticipantsWorkbook } from './exportUtils';

/**
 * WEB VERSION: Exports an array of participant objects to an Excel file and downloads it.
 */
export const exportParticipantsToExcel = async (participants, eventTitle) => {
    try {
        const { workbook, fileName } = prepareParticipantsWorkbook(participants, eventTitle);

        // 3. Download File (Web)
        XLSX.writeFile(workbook, fileName);
    } catch (error) {
        console.error('Export Error:', error);
        throw new Error('Failed to generate Excel file.');
    }
};
