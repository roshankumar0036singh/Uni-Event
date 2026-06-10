# Event Notification Architecture

This document explains how the "10-minute before" notifications works.

## 1. The "Postman" (Expo Push Token) 📨

For a phone to receive a notification, it needs an address. In Expo, this is called a **Push Token** (e.g., `ExponentPushToken[xxxxxxxx]`).

### Frontend Flow:
1.  **App Starts (`App.js`)**:
    *   The app asks the user for permission to send notifications.
    *   It requests a **Push Token** from Expo's servers.
2.  **Saving the Address (`users/{uid}`)**:
    *   The app sends this token to your `users` collection in Firestore.
    *   Now the backend knows "Address X belongs to User Y".

## 2. The "Scheduler" (Cloud Functions) ⏰

We don't want the phone to constantly check "Is it time yet?". Instead, we use a server-side **Cron Job**.

### `checkUpcomingEvents` Function:
*   **Runs:** Every 1 minute.
*   **Action:**
    1.  It checks the `events` database for any event starting in **10 minutes** (from `now` to `now + 10m`).
    2.  It looks for the `status: 'active'`.
    3.  It checks if we already sent it (`notified10Min != true`) to avoid duplicates.

## 3. The "Dispatcher" (Connecting the dots) 🔗

Once an event is found:
1.  **Find Participants:** The function looks at `events/{eventId}/participants` to see who is going.
2.  **Get Tokens:** It looks up those users in the `users` collection to get their `pushToken`.
3.  **Send Message:** It sends a request to Expo's Push API via `expo-server-sdk`.
    *   "Hey Expo, send 'Event Starting!' to these tokens."
4.  **Mark Done:** It updates the event with `notified10Min: true` so it doesn't send again.

## 4. The "Explicit Reminder" Flow 🔔

For users who manually clicked "Set Reminder":
1.  **Frontend:** `EventDetail.js` saves a doc in `reminders` collection with `remindAt`.
2.  **Backend (`checkReminders`):**
    *   Runs every minute.
    *   Queries `reminders` where time has passed.
    *   Sends a Push Notification (same method as above) AND creates an in-app notification in `users/{uid}/notifications`.
3.  **Backend Cleanup (`onEventDelete`):**
    *   If an event is deleted or canceled, this trigger automatically deletes all associated documents in the `reminders` collection so phantom notifications are never sent.

## Summary Logic

| Feature | Trigger | Action |
| :--- | :--- | :--- |
| **Event Start** | 10 mins before start | Notify ALL registered participants |
| **Manual Reminder** | Event Start Time | Notify specific user who set reminder |

This ensures reliable delivery even if the user's app is completely closed!
