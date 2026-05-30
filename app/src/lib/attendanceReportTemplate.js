/**
 * Generates the HTML template for attendance reports.
 * Shared between native and web versions to reduce code duplication.
 */
export function generateAttendanceHtml(eventTitle, participants) {
    const rows = participants
        .map(
            (p, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${p.name || 'N/A'}</td>
            <td>${p.email || 'N/A'}</td>
            <td>${p.branch || 'N/A'}</td>
            <td>${p.year || 'N/A'}</td>
            <td>${p.attended ? 'Present' : 'Absent'}</td>
        </tr>
    `,
        )
        .join('');

    return `
        <html>
        <head>
            <style>
                body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #333; }
                .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #6200ee; padding-bottom: 20px; }
                h1 { color: #6200ee; margin: 0; font-size: 28px; }
                .event-name { font-size: 18px; color: #666; margin-top: 10px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background-color: #f8f9fa; color: #6200ee; text-align: left; padding: 12px; border-bottom: 2px solid #dee2e6; }
                td { padding: 12px; border-bottom: 1px solid #dee2e6; font-size: 14px; }
                tr:nth-child(even) { background-color: #fcfcfc; }
                .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
                .stats { display: flex; justify-content: space-around; margin-bottom: 30px; background: #f8f9fa; padding: 20px; borderRadius: 10px; }
                .stat-item { text-align: center; }
                .stat-value { font-size: 20px; fontWeight: bold; color: #6200ee; }
                .stat-label { font-size: 12px; color: #666; }
                @media print {
                    body { padding: 20px; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Attendance Report</h1>
                <div class="event-name">${eventTitle}</div>
            </div>

            <div class="stats">
                <div class="stat-item">
                    <div class="stat-value">${participants.length}</div>
                    <div class="stat-label">Total Registered</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${participants.filter(p => p.attended).length}</div>
                    <div class="stat-label">Attended</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${((participants.filter(p => p.attended).length / participants.length) * 100).toFixed(1)}%</div>
                    <div class="stat-label">Show-up Ratio</div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>S.No</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Branch</th>
                        <th>Year</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>

            <div class="footer">
                <p>Generated on ${new Date().toLocaleString()}</p>
                <p>Uni-Event Platform - Centralized Event Management</p>
            </div>
            
            <script>
                // Auto-print dialog for PDF generation (for web version)
                if (typeof window !== 'undefined' && window.onload) {
                    window.onload = function() {
                        setTimeout(function() {
                            if (window.print) window.print();
                        }, 500);
                    };
                }
            </script>
        </body>
        </html>
    `;
}
