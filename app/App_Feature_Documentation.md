# centralized-event-platform - Application Documentation

## Overview

This application is a comprehensive Event Management Platform designed for University Students, Club Owners, and Administrators. It facilitates event discovery, registration (RSVP), management, and analytics with a modern, dynamic user interface.

## Problem Statement & Value Proposition

- **The Need**:
    - **Fragmented Information**: Students often miss events because details are scattered across emails, WhatsApp groups, and notice boards.
    - **Scheduling Conflicts**: Without calendar integration, students frequently double-book or forget online sessions.
    - **Blindspots for Clubs**: Organizers lack data on _who_ is attending (e.g., "Are we reaching enough 1st-year CSE students?") and cannot track long-term engagement trends.
    - **Accessibility Barriers**: Finding a specific Meet link at the last minute is often stressful and difficult.
- **The Solution**:
    - A centralized hub that syncs directly with **Google Calendar** for seamless reminders.
    - **AI-Powered Assistance** via Gemini to instantly retrieve schedules and links.
    - **Granular Analytics** that empower clubs to refine their promotion strategies based on real data (Branch-wise trends, participation heatmaps).

## 1. Authentication & User Mangement

### Features

- **Role-Based Access Control (RBAC)**:
    - **Student**: Can browse events, RSVP, set reminders, and manage their profile.
    - **Club Owner**: Includes Student privileges + can Create Events, Manage "My Events", and View Analytics.
    - **Admin**: Superuser privileges. Can manage ALL events, Suspend/Unsuspend events, and access a dedicated Control Panel.
- **Multi-Account Support**:
    - **Switch Accounts**: Users can save multiple login credentials and switch between them instantly from the Profile screen without re-entering passwords.
    - **Secure Storage**: Credentials are securely stored using `expo-secure-store`.
- **Sign Up / Login**:
    - Email/Password authentication via Firebase Auth.
    - Automatic role assignment (defaults to Student, upgradeable via Admin/Database).

## 2. Dynamic Home Screen (User Feed)

### Features

- **Collapsing "Welcome" Header**:
    - Aesthetically pleasing animation where the "Welcome [User]" text fades out and slides up as the user scrolls down.
    - **Persistent Notification Bell**: The bell icon remains accessible even as the header collapses (or scrolls away based on latest configuration).
- **Sticky "Explore Events" Navigation**:
    - The "Explore Events" title and **Filter Chips** (e.g., specific departments, "Show All") stick to the top of the screen when scrolled, ensuring easy filtering access at all times.
- **Event Feed**:
    - Displays a list of active events sorted by date.
    - **Visual Indicators**: Badges for "Free"/"Paid" and Event Category.
- **System Navigation Sync**:
    - The Android bottom navigation bar automatically adapts its color (black/white) to match the app's current theme (Dark/Light mode).

## 3. Event Discovery & Interaction

### Features

- **Event Details Screen**:
    - **Rich Media**: Banner image that opens in a full-screen modal on tap.
    - **Event Info**: Date, Time, Location, Target Audience (Years/Branches).
    - **RSVP System**:
        - One-tap "RSVP Now" button.
        - Captures user details (**Name, Branch, Year**) at the moment of registration for analytics.
        - **Auto-Reminder**: Automatically sets a local reminder (10 mins before) upon RSVP.
    - **Manual Reminders**: Dedicated "Alarm" button to set personal reminders without RSVPing.
    - **External Links**: Support for opening external registration forms (e.g., GForms) via in-app browser/linking.
    - **Admin Controls**: Visible only to Admins/Owners. Allows Suspending/Unsuspending events directly from the details page.
    - **Suspension Status**: Clear red warning banner if an event is suspended (User cannot RSVP if suspended).

## 4. Club & Admin Dashboard ("My Events")

### Features

- **Dedicated Tab**: Accessible via the main bottom navigation bar for Club/Admin users.
- **My Events List**:
    - Shows all events created by the logged-in user.
    - **Status Indicators**: "Active" (Green) vs "Suspended" (Red) dots.
    - **Delete Event**: Option to permanently remove an event.
- **Event Analytics Hub**:
    - **"Analytics" Button** on each event card.
    - **Stats Summary**:
        - Total Registrations.
        - Total Reminders Set.
    - **Participant List**:
        - Detailed list of students who RSVP'd.
        - Shows **Name, Email, Branch, and Year** for granular tracking.
    - **Trend Tracking & Deep Analytics**:
        - **Branch-wise Breakdown**: Visual data showing which branches (e.g., CSE vs. ECE) are responding most to specific events.
        - **Long-term Analysis**: Track participation trends over months to identify growth patterns and optimize future promotional campaigns.

## 5. Admin Control Panel

### Features

- **Admin Dashboard Screen**:
    - Aggregated view of platform activity (can be expanded in future).
    - Access to User Management and platform-wide settings.
- **Moderation**:
    - Ability to **Suspend** events that violate guidelines.
    - Suspended events are hidden from the public Student feed but remain visible to the Owner (with a warning).
    - **Appeals**: Owners can "Raise Appeal" on suspended events; Admins can review and "Un-suspend".

## 6. Reminders & Notifications

### Features

- **Reminders Tab**:
    - Centralized list of all active reminders set by the user.
    - **Countdown/Status**: Shows time remaining or if the event has passed.
    - **Delete Reminder**: Option to remove specific reminders.
- **Push Notifications**:
    - Local notifications triggered 10 minutes before an event starts.
    - Support for "Event Registered" confirmations.
    - **Debug Tools**: "Clear All Notifications" button in Profile to fix stuck schedules.

## 7. Profile & Settings

### Features

- **User Info**: Displays Name, Email, and Role badge.
- **Dark Mode / Theming**:
    - Global **Dark Mode** support.
    - Dynamic switching that updates all screens, text, inputs, and system bars instantly.
    - Persists user preference.
- **Account Management**:
    - Switch Account menu.
    - Logout.

## 8. Technical Stack

- **Frontend**: React Native with Expo (Managed Workflow).
- **Navigation**: React Navigation (Bottom Tabs, Native Stack).
- **Backend**: Firebase (Firestore Database, Authentication).
- **Styling**: Custom Theme Context (`useTheme`) with dynamic palette management.
- **Notifications**: `expo-notifications`.
- **AI & Integration**: `Google Gemini API`, `Google Calendar API`, `Google Meet API`.
- **Animations**: `react-native-reanimated` (implied/used) or standard `Animated` API for integration.

## 9. Google Workspace & AI Integration (New)

### Features

- **Automated Meeting Links**:
    - **Online/Offline Toggle**: When a Club Owner creates an event, they can toggle "Online Event".
    - **Auto-Generate**: The system automatically generates a unique **Google Meet** link and attaches it to the event details.
- **Smart Calendar Sync**:
    - **Seamless RSVP**: When a student clicks "RSVP" or sets a reminder, the event is automatically added to their **Google Calendar**.
    - **Context Rich**: The calendar event includes the Event Title, Description, and the direct Google Meet link.
- **Gemini AI Assistant**:
    - **Natural Language Queries**: Users can ask Gemini, _"Check my schedule for today"_ or _"Do I have any club events?"_.
    - **Instant Link Retrieval**: If an event is found, Gemini returns the schedule and provides the **Google Meet link** directly in the chat.
    - **Accessibility**: Provides a hands-free, conversational way to access event details, making the platform more inclusive.
