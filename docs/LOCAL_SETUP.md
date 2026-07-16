## Local Development Setup

This guide explains how to run Uni-Event locally using Docker and the Firebase Emulator Suite.

## Prerequisites

Before starting, ensure you have the following installed:

- Docker Desktop
- Docker Compose
- Git
- Firebase project (optional, only needed when testing against real Firebase services instead of the Emulator Suite)

## Environment Setup

1. Copy the Environment Template

cp app/.env.example app/.env

2. Configure Firebase

For emulator-only development, no Firebase project is required because the setup uses a demo Firebase project.

If you want to test against real Firebase services, create a Firebase project and populate the required Firebase configuration values in "app/.env".

3. Optional Configuration

Google Sign-In (only required if testing Google authentication):

EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=

Email features (optional):

EMAILJS_SERVICE_ID=
EMAILJS_TEMPLATE_ID=
EMAILJS_PUBLIC_KEY=

4. Enable Emulator Mode

Add the following to "app/.env":

EXPO_PUBLIC_USE_EMULATORS=true

Running the Development Environment

## Start all services:

docker compose up

This will start:

- Firebase Authentication Emulator
- Firestore Emulator
- Realtime Database Emulator
- Storage Emulator
- Firebase Functions Emulator
- Firebase Emulator UI
- Expo Web Application

## Available Services

Service| URL
Firebase Emulator UI| http://localhost:4000
Authentication Emulator| http://localhost:9099
Firestore Emulator| http://localhost:8090
Realtime Database Emulator| http://localhost:9000
Storage Emulator| http://localhost:9199
Functions Emulator| http://localhost:5001
Expo Web| http://localhost:8081

## Stopping Services

docker compose down

Or press "Ctrl + C" in the terminal running Docker Compose.

## Notes

- A Firebase project is not required for emulator-only development. The Docker setup uses a demo Firebase project for local testing.
- Contributors who want to test against real Firebase services should create their own Firebase project and provide the required Firebase configuration values.
- When "EXPO_PUBLIC_USE_EMULATORS=true", the application connects to the local Firebase Emulator Suite.
- Google OAuth credentials are only required for testing Google Sign-In.
- EmailJS credentials are optional and only required for email-related features.
- Do not commit ".env" files or any personal credentials.
- The Firebase Emulator Suite binds to `0.0.0.0` for Docker compatibility, making emulator ports accessible on your local network.
- Use this setup only on trusted networks and for local development purposes.
