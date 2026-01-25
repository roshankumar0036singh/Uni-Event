const fs = require('fs');
const path = require('path');
require('dotenv').config();

const templatePath = path.join(__dirname, '../public/firebase-messaging-sw.example.js');
const outputPath = path.join(__dirname, '../public/firebase-messaging-sw.js');

try {
    let content = fs.readFileSync(templatePath, 'utf8');

    content = content.replace('YOUR_API_KEY', process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '');
    content = content.replace('YOUR_AUTH_DOMAIN', process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '');
    content = content.replace('YOUR_PROJECT_ID', process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '');
    content = content.replace('YOUR_STORAGE_BUCKET', process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '');
    content = content.replace('YOUR_MESSAGING_SENDER_ID', process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '');
    content = content.replace('YOUR_APP_ID', process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '');

    fs.writeFileSync(outputPath, content);
    console.log('✅ firebase-messaging-sw.js generated successfully.');
} catch (error) {
    console.error('❌ Error generating firebase-messaging-sw.js:', error);
    process.exit(1);
}
