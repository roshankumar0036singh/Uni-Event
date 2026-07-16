"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isExpoPushToken = isExpoPushToken;
exports.sendPushNotifications = sendPushNotifications;
const expo_server_sdk_1 = require("expo-server-sdk");
const expo = new expo_server_sdk_1.Expo();
function isExpoPushToken(token) {
    return expo_server_sdk_1.Expo.isExpoPushToken(token);
}
/**
 * Sends push notifications using Expo SDK.
 * Handles chunking and basic error logging.
 *
 * @param messages Array of ExpoPushMessage objects
 */
async function sendPushNotifications(messages) {
    if (messages.length === 0)
        return [];
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    for (const chunk of chunks) {
        try {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            tickets.push(...ticketChunk);
        }
        catch (error) {
            console.error('Error sending push notification chunk:', error);
        }
    }
    // Handle errors in tickets if needed
    const errors = tickets.filter(t => t.status === 'error');
    if (errors.length > 0) {
        console.warn(`${errors.length} push notifications failed:`, JSON.stringify(errors));
        throw new Error(`${errors.length} push notifications failed`);
    }
    return tickets;
}
