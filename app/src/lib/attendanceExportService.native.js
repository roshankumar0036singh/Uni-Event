import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from './firebaseConfig';

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

        const checkIns = [];
        snapshot.forEach(doc => {
            checkIns.push({ id: doc.id, ...doc.data() });
        });

        // Calculate stats
        const totalRegistrations = eventData?.stats?.totalRegistrations || 0;
        const totalCheckedIn = checkIns.length;
        const checkInRate =
            totalRegistrations > 0 ? ((totalCheckedIn / totalRegistrations) * 100).toFixed(1) : 0;

        // Build HTML content
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Attendance Report - ${eventTitle}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            padding: 40px;
            background: #fff;
            color: #333;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 3px solid #FF9800;
        }
        h1 {
            font-size: 28px;
            color: #FF9800;
            margin-bottom: 10px;
        }
        .subtitle {
            font-size: 14px;
            color: #666;
        }
        .stats {
            display: flex;
            justify-content: space-around;
            margin: 30px 0;
            padding: 20px;
            background: #f5f5f5;
            border-radius: 8px;
        }
        .stat {
            text-align: center;
        }
        .stat-value {
            font-size: 32px;
            font-weight: bold;
            color: #FF9800;
        }
        .stat-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            margin-top: 5px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 30px;
        }
        th {
            background: #FF9800;
            color: white;
            padding: 12px;
            text-align: left;
            font-size: 12px;
            text-transform: uppercase;
        }
        td {
            padding: 10px 12px;
            border-bottom: 1px solid #eee;
            font-size: 13px;
        }
        tr:nth-child(even) {
            background: #f9f9f9;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            text-align: center;
            font-size: 11px;
            color: #999;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Attendance Report</h1>
        <div class="subtitle">${eventTitle}</div>
        <div class="subtitle">${new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        })}</div>
    </div>

    <div class="stats">
        <div class="stat">
            <div class="stat-value">${totalRegistrations}</div>
            <div class="stat-label">Total Registered</div>
        </div>
        <div class="stat">
            <div class="stat-value">${totalCheckedIn}</div>
            <div class="stat-label">Checked In</div>
        </div>
        <div class="stat">
            <div class="stat-value">${checkInRate}%</div>
            <div class="stat-label">Check-In Rate</div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Name</th>
                <th>Email</th>
                <th>Year</th>
                <th>Branch</th>
                <th>Check-In Time</th>
            </tr>
        </thead>
        <tbody>
            ${checkIns
                .map(
                    (item, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.userName || 'N/A'}</td>
                    <td>${item.userEmail || 'N/A'}</td>
                    <td>${item.userYear || 'N/A'}</td>
                    <td>${item.userBranch || 'N/A'}</td>
                    <td>${item.checkedInAt?.toDate ? item.checkedInAt.toDate().toLocaleString() : 'N/A'}</td>
                </tr>
            `,
                )
                .join('')}
        </tbody>
    </table>

    <div class="footer">
        Generated on ${new Date().toLocaleString()} • Total Records: ${totalCheckedIn}
    </div>
</body>
</html>
        `;

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
