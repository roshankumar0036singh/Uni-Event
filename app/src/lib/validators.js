import * as yup from 'yup';
import { addDoc, setDoc, updateDoc } from 'firebase/firestore';

const eventFieldSpecs = {
    title: yup.string().min(3, 'Title must be at least 3 characters').max(200, 'Title must be at most 200 characters'),
    description: yup.string().max(2000, 'Description must be at most 2000 characters'),
    category: yup.string().max(100),
    ownerId: yup.string(),
    ownerEmail: yup.string().email().nullable(),
    ownerName: yup.string().max(100).nullable(),
    organizerName: yup.string().max(100).nullable(),
    status: yup.string().oneOf(['draft', 'active', 'completed', 'deleted', 'suspended']).nullable(),
    location: yup.string().max(500, 'Location must be at most 500 characters').nullable(),
    eventMode: yup.string().oneOf(['offline', 'online']).nullable(),
    meetLink: yup.string().url('Invalid URL format').nullable(),
    isPaid: yup.boolean().nullable(),
    price: yup.number().min(0, 'Price cannot be negative').max(100000, 'Price too high').nullable(),
    upiId: yup.string().max(100).nullable(),
    registrationLink: yup.string().url('Invalid URL format').nullable(),
    capacity: yup.number().integer('Must be a whole number').min(0).nullable(),
    bannerUrl: yup.string().url('Invalid URL format').nullable(),
    tags: yup.array().of(yup.string()),
    startAt: yup.mixed(),
    endAt: yup.mixed().nullable(),
    coordinates: yup.mixed().nullable(),
    target: yup.mixed().nullable(),
    hasCustomForm: yup.boolean().nullable(),
    customFormSchema: yup.array().nullable(),
    certificatesSent: yup.boolean().nullable(),
    certificatesSentAt: yup.mixed().nullable(),
    appealStatus: yup.string().nullable(),
    appealSubject: yup.string().max(500).nullable(),
    appealMessage: yup.string().max(2000).nullable(),
    suspensionReason: yup.string().max(500).nullable(),
    views: yup.number().integer().min(0).nullable(),
    participantCount: yup.number().integer().min(0).nullable(),
    branchCounts: yup.mixed().nullable(),
    yearCounts: yup.mixed().nullable(),
    participantsPreview: yup.array().nullable(),
    createdAt: yup.mixed().nullable(),
    deletedAt: yup.mixed().nullable(),
    deletedBy: yup.string().nullable(),
    feedbackRequestSent: yup.boolean().nullable(),
    feedbackRequestSentAt: yup.mixed().nullable(),
    stats: yup.mixed().nullable(),
};

const eventCreateRequired = ['title', 'description', 'category', 'startAt'];

export const eventSchema = yup.object(
    Object.fromEntries(
        Object.entries(eventFieldSpecs).map(([key, spec]) => [
            key,
            eventCreateRequired.includes(key) ? spec.required(`${key} is required`) : spec,
        ]),
    ),
);

export const eventUpdateSchema = yup.object(eventFieldSpecs);

const userFieldSpecs = {
    email: yup.string().email('Invalid email').max(255),
    displayName: yup.string().min(1).max(100, 'Name must be at most 100 characters'),
    name: yup.string().max(100).nullable(),
    role: yup.string().oneOf(['student', 'club', 'admin']),
    points: yup.number().integer().min(0),
    reputation: yup.number().min(0).max(100).nullable(),
    createdAt: yup.mixed(),
    currentStreak: yup.number().integer().min(0).nullable(),
    longestStreak: yup.number().integer().min(0).nullable(),
    lastAttendanceAt: yup.mixed().nullable(),
    headline: yup.string().max(200, 'Headline too long').nullable(),
    bio: yup.string().max(1000, 'Bio too long').nullable(),
    branch: yup.string().max(100).nullable(),
    year: yup.number().integer().min(0).max(10).nullable(),
    instagram: yup.string().max(200).nullable(),
    linkedin: yup.string().max(200).nullable(),
    photoURL: yup.string().url().nullable(),
    selectedProfileBadge: yup.string().nullable(),
    verificationStatus: yup.string().nullable(),
    isVerified: yup.boolean().nullable(),
    provider: yup.string().nullable(),
    pushToken: yup.string().nullable(),
    organizerStats: yup.mixed().nullable(),
    lastEventCreatedAt: yup.mixed().nullable(),
};

const userCreateRequired = ['email'];

export const userSchema = yup.object(
    Object.fromEntries(
        Object.entries(userFieldSpecs).map(([key, spec]) => [
            key,
            userCreateRequired.includes(key) ? spec.required(`${key} is required`) : spec,
        ]),
    ),
);

export const userUpdateSchema = yup.object(userFieldSpecs);

const clubFieldSpecs = {
    title: yup.string().min(2).max(200),
    displayName: yup.string().max(200).nullable(),
    description: yup.string().max(2000).nullable(),
    message: yup.string().max(2000).nullable(),
    subject: yup.string().max(500).nullable(),
    ownerId: yup.string(),
    ownerEmail: yup.string().email().nullable(),
    approvalStatus: yup.string().oneOf(['pending', 'approved', 'rejected']).nullable(),
    approved: yup.boolean().nullable(),
    verificationStatus: yup.string().nullable(),
    followersCount: yup.number().integer().min(0).nullable(),
    createdAt: yup.mixed().nullable(),
    clubName: yup.string().nullable(),
    followedAt: yup.mixed().nullable(),
    userName: yup.string().nullable(),
};

const clubCreateRequired = ['title', 'ownerId'];

export const clubSchema = yup.object(
    Object.fromEntries(
        Object.entries(clubFieldSpecs).map(([key, spec]) => [
            key,
            clubCreateRequired.includes(key) ? spec.required(`${key} is required`) : spec,
        ]),
    ),
);

export const clubUpdateSchema = yup.object(clubFieldSpecs);

const checkInFieldSpecs = {
    userId: yup.string(),
    userName: yup.string().max(100).nullable(),
    userEmail: yup.string().email().nullable(),
    userYear: yup.string().max(20).nullable(),
    userBranch: yup.string().max(50).nullable(),
    checkedInAt: yup.mixed(),
    checkedInBy: yup.string().nullable(),
    checkedInByName: yup.string().nullable(),
    ticketId: yup.string().nullable(),
    status: yup.string().nullable(),
    deviceId: yup.string().nullable(),
    latitude: yup.number().min(-90).max(90).nullable(),
    longitude: yup.number().min(-180).max(180).nullable(),
    qrId: yup.string().nullable(),
    syncedOffline: yup.boolean().nullable(),
};

export const checkInSchema = yup.object(checkInFieldSpecs);

const feedbackFieldSpecs = {
    userId: yup.string(),
    userEmail: yup.string().email().nullable(),
    userRole: yup.string().nullable(),
    category: yup.string().max(100).nullable(),
    description: yup.string().max(5000).required('Description is required'),
    screenshotUrl: yup.string().url().nullable(),
    telemetry: yup.mixed().nullable(),
    status: yup.string().nullable(),
    createdAt: yup.mixed().nullable(),
    rating: yup.number().integer().min(1).max(5).nullable(),
    comments: yup.string().max(2000).nullable(),
    eventId: yup.string().nullable(),
};

export const feedbackSchema = yup.object({
    ...feedbackFieldSpecs,
    userId: feedbackFieldSpecs.userId.required('userId is required'),
});

export const reminderFieldSpecs = {
    userId: yup.string(),
    eventId: yup.string(),
    eventTitle: yup.string().max(200).nullable(),
    remindAt: yup.mixed().nullable(),
    notificationId: yup.string().nullable(),
    createdAt: yup.mixed().nullable(),
};

export const reminderSchema = yup.object(reminderFieldSpecs);

const messageFieldSpecs = {
    text: yup.string().min(1).max(1000, 'Message too long').required('Message text is required'),
    userId: yup.string().required(),
    displayName: yup.string().max(100).nullable(),
    createdAt: yup.mixed().nullable(),
    isOrganizer: yup.boolean().nullable(),
    role: yup.string().nullable(),
};

export const messageSchema = yup.object(messageFieldSpecs);

const bookmarkFieldSpecs = {
    eventId: yup.string(),
    savedAt: yup.mixed().nullable(),
};

export const bookmarkSchema = yup.object(bookmarkFieldSpecs);

export const viewSchema = yup.object({
    viewedAt: yup.mixed(),
    userId: yup.string(),
    userName: yup.string().max(100).nullable(),
});

const attendanceFieldSpecs = {
    eventId: yup.string(),
    ownerId: yup.string(),
    type: yup.string().nullable(),
    checkInCount: yup.number().integer().min(0).nullable(),
    createdAt: yup.mixed().nullable(),
    updatedAt: yup.mixed().nullable(),
};

export const attendanceSchema = yup.object(attendanceFieldSpecs);

const participantFieldSpecs = {
    checkInStatus: yup.string().nullable(),
    checkedInAt: yup.mixed().nullable(),
    checkedInBy: yup.string().nullable(),
    lookingForBuddy: yup.boolean().nullable(),
    status: yup.string().nullable(),
};

export const participantSchema = yup.object(participantFieldSpecs);

const ticketFieldSpecs = {
    checkInStatus: yup.string().nullable(),
    checkedInAt: yup.mixed().nullable(),
    checkedInBy: yup.string().nullable(),
};

export const ticketSchema = yup.object(ticketFieldSpecs);

export async function validate(data, schema) {
    try {
        return await schema.validate(data, { abortEarly: false, stripUnknown: true });
    } catch (error) {
        if (error instanceof yup.ValidationError) {
            const message = error.inner.map(e => e.message).join('; ');
            throw new Error(`Validation failed: ${message}`);
        }
        throw error;
    }
}

export const validateAndAddDoc = async (collectionRef, data, schema) => {
    const validated = await validate(data, schema);
    return addDoc(collectionRef, validated);
};

export const validateAndSetDoc = async (docRef, data, schema, options) => {
    const validated = await validate(data, schema);
    return setDoc(docRef, validated, options);
};

export const validateAndUpdateDoc = async (docRef, data, schema) => {
    const validated = await validate(data, schema);
    return updateDoc(docRef, validated);
};
