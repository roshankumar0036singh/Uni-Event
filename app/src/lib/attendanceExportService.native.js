import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { generateAttendanceHtml } from './attendanceReportTemplate';

/**
 * Export attendance data as CSV
 */
export const exportAttendanceCSV = async (eventId, eventTitle) => {
    try {
        // Fetch all check-ins
        const q = query(
            collection(db, 'events', eventId, 'checkIns'),
            orderBy('checkedInAt', 'asc'),
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            throw new Error('No attendance data to export');
        }

        // Build CSV content
        let csvContent = 'Name,Email,Year,Branch,Ticket ID,Check-In Time\n';

        snapshot.forEach(doc => {
            const data = doc.data();
            const checkInTime = data.checkedInAt?.toDate
                ? data.checkedInAt.toDate().toLocaleString()
                : 'N/A';

            csvContent += `"${data.userName || 'N/A'}","${data.userEmail || 'N/A'}",${data.userYear || 'N/A'},"${data.userBranch || 'N/A'}","${data.ticketId || 'N/A'}","${checkInTime}"\n`;
        });

        // Create file
        const fileName = `attendance_${eventTitle.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.csv`;
        const fileUri = FileSystem.documentDirectory + fileName;

        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
            encoding: FileSystem.EncodingType.UTF8,
        });

        // Share file
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
                mimeType: 'text/csv',
                dialogTitle: 'Export Attendance Report',
                UTI: 'public.comma-separated-values-text',
            });
        } else {
            throw new Error('Sharing is not available on this device');
        }

        return {
            success: true,
            message: 'CSV exported successfully',
            fileUri,
        };
    } catch (error) {
        console.error('CSV export error:', error);
        return {
            success: false,
            error: error.message || 'Failed to export CSV',
        };
    }
};

/**
 * Export attendance data as PDF (HTML-based)
 */
export const exportAttendancePDF = async (eventId, eventTitle, eventData) => {
    try {
        // Fetch all check-ins
        const q = query(
            collection(db, 'events', eventId, 'checkIns'),
            orderBy('checkedInAt', 'asc'),
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            throw new Error('No attendance data to export');
        }

        const participants = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                name: data.userName,
                email: data.userEmail,
                branch: data.userBranch,
                year: data.userYear,
                attended: true, // If they are in check-ins, they attended
            };
        });

        const htmlContent = generateAttendanceHtml(eventTitle, participants);

        // Create HTML file
        const fileName = `attendance_${eventTitle.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.html`;
        const fileUri = FileSystem.documentDirectory + fileName;

        await FileSystem.writeAsStringAsync(fileUri, htmlContent, {
            encoding: FileSystem.EncodingType.UTF8,
        });

        // Share file
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
                mimeType: 'text/html',
                dialogTitle: 'Export Attendance Report (PDF)',
            });
        } else {
            throw new Error('Sharing is not available on this device');
        }

        return {
            success: true,
            message: 'PDF exported successfully',
            fileUri,
        };
    } catch (error) {
        console.error('PDF export error:', error);
        return {
            success: false,
            error: error.message || 'Failed to export PDF',
        };
    }
};
