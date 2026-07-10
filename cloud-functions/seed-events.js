const admin = require('firebase-admin');

// Tell Firebase Admin to connect to the emulators
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({
    projectId: 'demo-no-project',
});

const db = admin.firestore();

const mockEvents = [
    {
        title: 'University Hackathon 2026',
        description:
            'Annual 24-hour programming hackathon and building challenge. Work with top mentors, build exciting projects, and win cool prizes!',
        ownerId: 'uwYrC5r9XQSvFz5w33qy7OAwbcLV',
        organization: 'Computer Science Club',
        category: 'Technology',
        eventMode: 'offline',
        location: 'Main Auditorium, Campus East',
        status: 'active',
        latitude: 12.9716,
        longitude: 77.5946,
        certificatesSent: false,
        startAt: new Date(Date.now() + 86400000 * 2).toISOString(),
        endAt: new Date(Date.now() + 86400000 * 2 + 3600000 * 24).toISOString(),
        createdAt: new Date().toISOString(),
        isPaid: true,
        price: 199,
        capacity: 200,
        views: 12,
        participantCount: 0,
        bannerUrl:
            'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80',
        detailImageUrl:
            'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80',
    },
    {
        title: 'Design Masterclass',
        description:
            'Learn the fundamentals of UX/UI design, wireframing, prototyping, and modern design tools like Figma from industry experts.',
        ownerId: 'uwYrC5r9XQSvFz5w33qy7OAwbcLV',
        organization: 'Design & Arts Society',
        category: 'Arts',
        eventMode: 'online',
        location: 'Google Meet',
        status: 'active',
        latitude: 12.9716,
        longitude: 77.5946,
        certificatesSent: false,
        startAt: new Date(Date.now() + 86400000 * 5).toISOString(),
        endAt: new Date(Date.now() + 86400000 * 5 + 3600000 * 3).toISOString(),
        createdAt: new Date().toISOString(),
        isPaid: false,
        price: 0,
        capacity: 500,
        views: 45,
        participantCount: 0,
        bannerUrl:
            'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80',
        detailImageUrl:
            'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80',
    },
];

async function seed() {
    console.log('Seeding events to local Firestore emulator...');
    const batch = db.batch();
    mockEvents.forEach(event => {
        const ref = db.collection('events').doc();
        batch.set(ref, event);
    });
    await batch.commit();
    console.log('Mock events successfully seeded!');
}

seed().catch(err => {
    console.error('Error seeding events:', err);
});
