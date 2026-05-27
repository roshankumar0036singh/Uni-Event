const EVENT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
});

const EVENT_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
});

export const toEventDate = timestamp => {
    if (!timestamp) {
        return null;
    }

    const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);

    return Number.isNaN(date.getTime()) ? null : date;
};

export const formatEventDate = timestamp => {
    const date = toEventDate(timestamp);

    return date ? EVENT_DATE_FORMATTER.format(date) : 'Date TBD';
};

export const formatEventTime = timestamp => {
    const date = toEventDate(timestamp);

    return date ? EVENT_TIME_FORMATTER.format(date) : 'Time TBD';
};

export const formatEventDateTime = timestamp => {
    const date = toEventDate(timestamp);

    if (!date) {
        return 'Date TBD';
    }

    return `${formatEventDate(date)} at ${formatEventTime(date)}`;
};
