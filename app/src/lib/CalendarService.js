import { makeRedirectUri, Prompt, ResponseType, useAuthRequest } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';

// Use the same Client ID as AuthScreen to ensure consistent Redirect URI configuration
const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const DISCOVERY = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
};
const SCOPES = ['openid', 'https://www.googleapis.com/auth/calendar.events'];

WebBrowser.maybeCompleteAuthSession();

export const useCalendarAuth = () => {
    // Simplified Redirect Logic
    const redirectUri =
        Platform.OS === 'web' ? window.location.origin : makeRedirectUri({ useProxy: true });

    // 🔍 DEBUG: Show Redirect URI only on Mobile Web (Ngrok)
    useEffect(() => {
        if (Platform.OS === 'web' && window.location.hostname !== 'localhost') {
            Alert.alert(
                'Mobile Web Calendar Debug',
                `Generated Redirect URI:\n${redirectUri}\n\nPlease add EXACTLY this to Google Console.`,
            );
        }
    }, []);

    const [request, response, promptAsync] = useAuthRequest(
        {
            clientId: CLIENT_ID,
            scopes: SCOPES,
            redirectUri,
            responseType: ResponseType.Token,
            prompt: Prompt.SelectAccount,
            usePKCE: false, // ✅ FIXED: Disable PKCE for Implicit Flow (ResponseType.Token)
        },
        DISCOVERY,
    );

    // ✅ FIXED: Using Implicit Flow (ResponseType.Token), so we get accessToken directly.
    const getAccessToken = async () => {
        if (response?.type === 'success') {
            // Check both locations just to be safe (authentication object is preferred in newer versions)
            const token = response.authentication?.accessToken || response.params?.access_token;
            return token || null;
        }
        return null;
    };

    return { request, response, promptAsync, getAccessToken };
};

export const createMeetEvent = async (accessToken, eventDetails) => {
    try {
        const { title, description, startAt, endAt } = eventDetails;

        const eventBody = {
            summary: title,
            description: description,
            start: { dateTime: startAt }, // ISO String
            end: { dateTime: endAt },
            conferenceData: {
                createRequest: {
                    requestId: `req-${Date.now()}`,
                    conferenceSolutionKey: { type: 'hangoutsMeet' },
                },
            },
        };

        const response = await fetch(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventBody),
            },
        );

        const data = await response.json();

        if (data.error) throw new Error(data.error.message);

        return {
            meetLink: data.hangoutLink,
            eventId: data.id,
            htmlLink: data.htmlLink, // Link to calendar event
        };
    } catch (error) {
        console.error('Calendar API Error:', error);
        throw error;
    }
};

export const addToCalendar = async (accessToken, event) => {
    try {
        const description = event.meetLink
            ? `${event.description}\n\nJoin with Google Meet: ${event.meetLink}\n\nApp Event ID: ${event.id}`
            : `${event.description}\n\nApp Event ID: ${event.id}`;

        const eventBody = {
            summary: event.title,
            description: description,
            location: event.location,
            start: { dateTime: event.startAt },
            end: { dateTime: event.endAt },
        };

        const response = await fetch(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventBody),
            },
        );

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return data;
    } catch (error) {
        console.error('Add to Calendar Error:', error);
        throw error;
    }
};
