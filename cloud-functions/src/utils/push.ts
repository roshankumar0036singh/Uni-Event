import { Expo, ExpoPushMessage } from 'expo-server-sdk';

const expo = new Expo();

/**
 * Sends push notifications using Expo SDK.
 * Handles chunking and basic error logging.
 *
 * @param messages Array of ExpoPushMessage objects
 */
export async function sendPushNotifications(messages: ExpoPushMessage[]) {
  if (messages.length === 0) return;

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error('Error sending push notification chunk:', error);
    }
  }

  // Handle errors in tickets if needed
  const errors = tickets.filter(t => t.status === 'error');
  if (errors.length > 0) {
    console.warn(`${errors.length} push notifications failed:`, JSON.stringify(errors));
  }

  return tickets;
}
