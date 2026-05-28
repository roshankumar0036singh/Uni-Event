import { Alert } from 'react-native';

export const formatCsvCell = value => {
    const s = value == null ? 'N/A' : String(value);
    return `"${s.replaceAll('"', '""')}"`;
};

export const mapCheckInToCsvLine = data => {
    const checkInTime = data.checkedInAt?.toDate
        ? data.checkedInAt.toDate().toLocaleString()
        : 'N/A';

    return [
        formatCsvCell(data.userName || 'N/A'),
        formatCsvCell(data.userEmail || 'N/A'),
        formatCsvCell(data.userYear || 'N/A'),
        formatCsvCell(data.userBranch || 'N/A'),
        formatCsvCell(data.ticketId || 'N/A'),
        formatCsvCell(checkInTime),
    ]
        .join(',')
        .concat('\n');
};

export const computeTotalRegistrations = eventData =>
    eventData?.stats?.attendeeCount ??
    eventData?.stats?.totalRegistrations ??
    eventData?.participantCount ??
    0;

export const showSlowQueryWarning = (label, durationMs, totalDocs) => {
    const message = `${label} took ${durationMs}ms while loading ${totalDocs} attendance records.`;
    console.warn(message);
    Alert.alert('Slow attendance query', message);
};
