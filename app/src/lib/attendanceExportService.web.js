import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { generateAttendanceHtml } from './attendanceReportTemplate';

/**
 * WEB VERSION: Attendance Export Service
 * For web, we'll download files directly to the browser
 */

/**
 * Export attendance data as CSV (Web version - direct download)
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

        // Create and download file (Web)
        const fileName = `attendance_${eventTitle.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.csv`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        link.remove();

        return {
            success: true,
            message: 'CSV exported successfully',
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
 * Export attendance data as PDF (Web version - HTML download)
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
                attended: true,
            };
        });

        const htmlContent = generateAttendanceHtml(eventTitle, participants);

        // Open in new window for printing/saving as PDF
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            return {
                success: true,
                message: 'PDF report opened for printing',
            };
        } else {
            throw new Error('Pop-up blocked. Please allow pop-ups for this site.');
        }
    } catch (error) {
        console.error('PDF export error:', error);
        return {
            success: false,
            error: error.message || 'Failed to export PDF',
        };
    }
};
