/**
 * Client-side input validation for Firestore writes (#154).
 *
 * Mirrors the server-side rules (validateEventShape in firestore.rules)
 * so invalid payloads are rejected locally with friendly messages before
 * any network write is attempted, instead of surfacing generic
 * permission errors from the rules layer.
 */

export const LIMITS = {
    TITLE_MIN: 3,
    TITLE_MAX: 200,
    DESCRIPTION_MAX: 5000,
    PRICE_MAX: 100000,
    CAPACITY_MAX: 10000,
    URL_MAX: 2048,
};

export const isNonEmptyString = value => typeof value === 'string' && value.trim().length > 0;

export const isStringOfLength = (value, min, max) =>
    typeof value === 'string' && value.length >= min && value.length <= max;

export const isFiniteNumber = (value, min, max) =>
    typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

export const isIsoDateString = value =>
    typeof value === 'string' && !Number.isNaN(Date.parse(value));

export const isHttpUrl = (value, maxLength = LIMITS.URL_MAX) =>
    typeof value === 'string' && value.length <= maxLength && /^https:\/\/.+/.test(value);

/**
 * Validates an event payload before writing it to Firestore.
 * @param {object} data candidate event document
 * @returns {{ valid: boolean, errors: string[] }}
 */
export const validateEventInput = (data = {}) => {
    const errors = [];

    if (!isStringOfLength(data.title, LIMITS.TITLE_MIN, LIMITS.TITLE_MAX)) {
        errors.push(
            `Title must be between ${LIMITS.TITLE_MIN} and ${LIMITS.TITLE_MAX} characters.`,
        );
    }

    if (!isNonEmptyString(data.description) || data.description.length > LIMITS.DESCRIPTION_MAX) {
        errors.push(
            `Description is required and must not exceed ${LIMITS.DESCRIPTION_MAX} characters.`,
        );
    }

    if (!isIsoDateString(data.startAt)) {
        errors.push('Start date must be a valid date.');
    }
    if (!isIsoDateString(data.endAt)) {
        errors.push('End date must be a valid date.');
    }
    if (isIsoDateString(data.startAt) && isIsoDateString(data.endAt)) {
        if (new Date(data.endAt) <= new Date(data.startAt)) {
            errors.push('End date must be after the start date.');
        }
    }

    if (!isFiniteNumber(data.price, 0, LIMITS.PRICE_MAX)) {
        errors.push(`Price must be a number between 0 and ${LIMITS.PRICE_MAX}.`);
    }

    if (data.capacity !== null && data.capacity !== undefined) {
        if (!isFiniteNumber(data.capacity, 1, LIMITS.CAPACITY_MAX)) {
            errors.push(`Capacity must be a whole number between 1 and ${LIMITS.CAPACITY_MAX}.`);
        }
    }

    if (data.meetLink && !isHttpUrl(data.meetLink)) {
        errors.push('Meet link must be an https:// URL.');
    }
    if (data.registrationLink && !isHttpUrl(data.registrationLink)) {
        errors.push('Registration link must be an https:// URL.');
    }
    if (
        data.bannerUrl &&
        !isHttpUrl(data.bannerUrl) &&
        /^https?:\/\//.test(data.bannerUrl) === false
    ) {
        errors.push('Banner URL must be an https:// URL.');
    }

    return { valid: errors.length === 0, errors };
};

/**
 * Validates user/participant profile writes.
 */
export const validateProfileInput = (data = {}) => {
    const errors = [];

    if (data.displayName !== undefined) {
        if (!isStringOfLength(data.displayName, 1, 60)) {
            errors.push('Display name must be between 1 and 60 characters.');
        }
    }
    if (data.bio !== undefined && data.bio.length > 600) {
        errors.push('Bio must not exceed 600 characters.');
    }
    if (
        data.instagram !== undefined &&
        data.instagram &&
        !/^[a-zA-Z0-9._]{1,30}$/.test(data.instagram)
    ) {
        errors.push('Instagram handle contains invalid characters.');
    }
    if (data.linkedin !== undefined && data.linkedin && !isHttpUrl(data.linkedin)) {
        errors.push('LinkedIn URL must be an https:// URL.');
    }

    return { valid: errors.length === 0, errors };
};
