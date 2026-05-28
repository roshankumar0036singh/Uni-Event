export const COLLECTIONS = {
    EVENTS: 'events',
    USERS: 'users',
    FEEDBACK_REQUESTS: 'feedbackRequests',
    REGISTRATIONS: 'registrations',
};

export const getUserParticipatingPath = userId => `${COLLECTIONS.USERS}/${userId}/participating`;
export const getEventCheckInsPath = eventId => `${COLLECTIONS.EVENTS}/${eventId}/checkIns`;
export const getEventFeedbackPath = eventId => `${COLLECTIONS.EVENTS}/${eventId}/feedback`;
