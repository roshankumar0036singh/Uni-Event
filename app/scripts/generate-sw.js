const fs = require('fs');
const path = require('path');
require('dotenv').config();

const templatePath = path.join(__dirname, '../public/firebase-messaging-sw.example.js');
const outputPath = path.join(__dirname, '../public/firebase-messaging-sw.js');

const requiredEnvVars = [
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'EXPO_PUBLIC_FIREBASE_APP_ID',
];

// Validate required environment variables
const missingVars = requiredEnvVars.filter(key => !process.env[key]?.trim());

if (missingVars.length > 0) {
    console.error('❌ Missing required Firebase environment variables:\n');

    missingVars.forEach(key => {
        console.error(`- ${key}`);
    });

    process.exit(1);
}

try {
    let content = fs.readFileSync(templatePath, 'utf8');

    requiredEnvVars.forEach(key => {
        const placeholder = key.replace('EXPO_PUBLIC_FIREBASE_', 'YOUR_');

        content = content.replaceAll(placeholder, process.env[key]);
    });

    fs.writeFileSync(outputPath, content);

    console.log('✅ firebase-messaging-sw.js generated successfully.');
} catch (error) {
    console.error('❌ Error generating firebase-messaging-sw.js:', error);

    process.exit(1);
}
