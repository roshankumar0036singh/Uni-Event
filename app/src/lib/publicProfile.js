import { doc } from 'firebase/firestore';
import { validateAndSetDoc, userUpdateSchema } from './validators';

export const PUBLIC_PROFILE_FIELDS = [
    'displayName',
    'name',
    'photoURL',
    'role',
    'points',
    'headline',
    'bio',
    'instagram',
    'linkedin',
    'selectedProfileBadge',
    'isAnonymous',
    'verificationStatus',
    'followersCount',
    'clubName',
    'organization',
    'bannerUrl',
];

export const pickPublicProfileData = data =>
    PUBLIC_PROFILE_FIELDS.reduce((publicData, field) => {
        if (data[field] !== undefined) {
            publicData[field] = data[field];
        }
        return publicData;
    }, {});

export const publicProfileRef = (db, userId) => doc(db, 'publicUsers', userId);

export const upsertPublicProfile = (db, userId, data) =>
    validateAndSetDoc(publicProfileRef(db, userId), pickPublicProfileData(data), userUpdateSchema, { merge: true });
