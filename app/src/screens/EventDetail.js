import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    increment,
    onSnapshot,
    query,
    setDoc,
    updateDoc,
    where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    ImageBackground,
    Linking,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import FeedbackModal from '../components/FeedbackModal';
import AppealModal from '../components/AppealModal';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../lib/AuthContext';
import * as CalendarService from '../lib/CalendarService';
import { submitFeedback } from '../lib/feedbackService';
import { db, functions } from '../lib/firebaseConfig';
import { cancelScheduledNotification, scheduleEventReminder } from '../lib/notificationService';
import { useTheme } from '../lib/ThemeContext';
import { sendBulkCertificates } from '../lib/EmailService';

const { width } = Dimensions.get('window');

const UniEventLogo = require('../../assets/UniEvent.png');

export default function EventDetail({ route, navigation }) {
    const { eventId, action } = route.params;
    const { user, role } = useAuth();
    const { theme } = useTheme();
    const styles = useMemo(() => getStyles(theme), [theme]);

    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sendingCertificates, setSendingCertificates] = useState(false);
    const [rsvpStatus, setRsvpStatus] = useState(null);
    const [participantCount, setParticipantCount] = useState(0);
    const [hasGivenFeedback, setHasGivenFeedback] = useState(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [showAppealModal, setShowAppealModal] = useState(false);

    const [sendingAppeal, setSendingAppeal] = useState(false);

    // Waitlist states
    const [isOnWaitlist, setIsOnWaitlist] = useState(false);
    const [waitlistPosition, setWaitlistPosition] = useState(null);
    const [isWaitlistLoading, setIsWaitlistLoading] = useState(false);

    // ... existing useEffects ...

    const handleSubmitAppeal = async ({ subject, message }) => {
        setSendingAppeal(true);
        try {
            await updateDoc(doc(db, 'events', event.id), {
                appealStatus: 'pending',
                appealSubject: subject,
                appealMessage: message,
            });
            setShowAppealModal(false);
            Alert.alert('Submitted', 'Appeal sent to admin for review.');
        } catch (e) {
            Alert.alert('Error', 'Failed to submit appeal');
        } finally {
            setSendingAppeal(false);
        }
    };
    const [hostName, setHostName] = useState('Organizer');
    const [reminderId, setReminderId] = useState(null); // Firestore Doc ID if set
    const [isBookmarked, setIsBookmarked] = useState(false);

    // Auto-open feedback modal if accessed via feedback link
    useEffect(() => {
        if (action === 'feedback' && event && !loading) {
            // Check if event has ended and user is registered
            const eventEnded = new Date() > new Date(event.endAt);
            if (eventEnded && rsvpStatus === 'going' && !hasGivenFeedback) {
                setShowFeedbackModal(true);
            }
        }
    }, [action, event, loading, rsvpStatus, hasGivenFeedback]);

    useEffect(() => {
        if (event?.ownerId) {
            getDoc(doc(db, 'users', event.ownerId)).then(snap => {
                if (snap.exists()) {
                    setHostName(snap.data().displayName || event.organizerName || 'Organizer');
                }
            });
        } else if (event?.organizerName) {
            setHostName(event.organizerName);
        }
    }, [event]);

    // Increment View Count (Unique per User)
    useEffect(() => {
        const recordView = async () => {
            if (!user || !eventId) return;

            try {
                // Check if user has already viewed this event
                const viewRef = doc(db, `events/${eventId}/views`, user.uid);
                const viewSnap = await getDoc(viewRef);

                if (!viewSnap.exists()) {
                    // First time viewing: Record it and increment counter
                    await setDoc(viewRef, {
                        viewedAt: new Date().toISOString(),
                        userId: user.uid,
                        userName: user.displayName || 'Anonymous',
                    });

                    await updateDoc(doc(db, 'events', eventId), {
                        views: increment(1),
                    });
                }
            } catch (error) {
                console.log('Error recording view:', error);
            }
        };

        recordView();
    }, [eventId, user]); // Run when user loads

    // Cleanup logic merged into the main effect or kept simple
    useEffect(() => {
        navigation.setOptions({ headerShown: false }); // Hide default header

        const unsubEvent = onSnapshot(doc(db, 'events', eventId), doc => {
            if (doc.exists()) {
                setEvent({ id: doc.id, ...doc.data() });
            } else {
                Alert.alert('Error', 'Event not found');
                navigation.goBack();
            }
            setLoading(false);
        });

        const unsubParticipants = onSnapshot(
            collection(db, `events/${eventId}/participants`),
            snapshot => {
                setParticipantCount(snapshot.size);
                if (user) {
                    const myDoc = snapshot.docs.find(d => d.id === user.uid);
                    if (myDoc) setRsvpStatus('going');
                    else setRsvpStatus(null);
                }
            },
        );

        getDoc(doc(db, `events/${eventId}/feedback`, user.uid)).then(snap => {
            if (snap.exists()) setHasGivenFeedback(true);
        });

        // Check if reminder exists
        getDocs(
            query(
                collection(db, 'reminders'),
                where('userId', '==', user.uid),
                where('eventId', '==', eventId),
            ),
        ).then(snap => {
            if (!snap.empty) {
                setReminderId(snap.docs[0].id);
            }
        });

        // Check if event is bookmarked
        if (user) {
            getDoc(doc(db, 'users', user.uid, 'savedEvents', eventId)).then(snap => {
                setIsBookmarked(snap.exists());
            });
        }

        return () => {
            unsubEvent();
            unsubParticipants();
        };
    }, [eventId, user]);

    // Check waitlist status when component loads or user changes
    useEffect(() => {
        checkWaitlistStatus();
    }, [eventId, user]);

    // Check if user is on waitlist
    const checkWaitlistStatus = async () => {
        if (!user || !eventId) return;
        
        try {
            const waitlistQuery = await getDocs(
                query(
                    collection(db, 'events', eventId, 'waitlist'),
                    where('userId', '==', user.uid),
                    where('status', '==', 'waiting')
                )
            );
            
            if (!waitlistQuery.empty) {
                const waitlistData = waitlistQuery.docs[0].data();
                setIsOnWaitlist(true);
                setWaitlistPosition(waitlistData.position);
            } else {
                setIsOnWaitlist(false);
                setWaitlistPosition(null);
            }
        } catch (error) {
            console.error('Error checking waitlist:', error);
        }
    };

    // Join waitlist
    const handleJoinWaitlist = async () => {
        if (!user) {
            Alert.alert('Sign In', 'Please sign in to join waitlist.');
            return;
        }
        
        setIsWaitlistLoading(true);
        try {
            const joinWaitlistFunction = httpsCallable(functions, 'joinWaitlist');
            const result = await joinWaitlistFunction({ eventId });
            
            if (result.data.success) {
                setIsOnWaitlist(true);
                setWaitlistPosition(result.data.position);
                Alert.alert('Joined Waitlist', result.data.message);
                await checkWaitlistStatus();
            }
        } catch (error) {
            console.error('Join waitlist error:', error);
            Alert.alert('Error', error.message || 'Failed to join waitlist');
        } finally {
            setIsWaitlistLoading(false);
        }
    };

    // Leave waitlist
    const handleLeaveWaitlist = async () => {
        Alert.alert(
            'Leave Waitlist',
            'Are you sure you want to leave the waitlist?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const leaveWaitlistFunction = httpsCallable(functions, 'leaveWaitlist');
                            await leaveWaitlistFunction({ eventId });
                            setIsOnWaitlist(false);
                            setWaitlistPosition(null);
                            Alert.alert('Success', 'Removed from waitlist');
                            await checkWaitlistStatus();
                        } catch (error) {
                            console.error('Leave waitlist error:', error);
                            Alert.alert('Error', error.message || 'Failed to leave waitlist');
                        }
                    }
                }
            ]
        );
    };

    // Derived State
    const isOwner = user && event?.ownerId === user.uid;
    const isAdmin = role === 'admin';
    const isSuspended = event?.status === 'suspended';

    const toggleBookmark = async () => {
        if (!user) {
            Alert.alert('Error', 'Please login to save events.');
            return;
        }

        try {
            console.log('Toggling bookmark for event:', eventId, 'Current state:', isBookmarked);
            const bookmarkRef = doc(db, 'users', user.uid, 'savedEvents', eventId);

            if (isBookmarked) {
                console.log('Removing bookmark...');
                await deleteDoc(bookmarkRef);
                setIsBookmarked(false);
                Alert.alert('Removed', 'Event removed from saved events.');
            } else {
                console.log('Adding bookmark...');
                await setDoc(bookmarkRef, {
                    eventId: eventId,
                    savedAt: new Date().toISOString(),
                });
                setIsBookmarked(true);
                Alert.alert('Saved', 'Event saved for later!');
            }
            console.log('Bookmark toggled successfully. New state:', !isBookmarked);
        } catch (e) {
            console.error('Bookmark error:', e);
            Alert.alert('Error', `Failed to save event: ${e.message}`);
        }
    };

    const shareEvent = async () => {
        try {
            const eventUrl = `https://unievent-ez2w.onrender.com/event/${eventId}`; // Replace with your actual domain
            const shareMessage = `🎉 Check out this event: ${event.title}\n\n📅 ${new Date(event.startAt).toLocaleDateString()} at ${new Date(event.startAt).toLocaleTimeString()}\n📍 ${event.location || 'Online'}\n\n${eventUrl}`;

            // For web, use Web Share API if available
            if (Platform.OS === 'web' && navigator.share) {
                await navigator.share({
                    title: event.title,
                    text: shareMessage,
                    url: eventUrl,
                });
            } else if (Platform.OS === 'web') {
                // Fallback for web browsers without Share API
                Alert.alert('Share Event', 'Choose a platform:', [
                    {
                        text: 'WhatsApp',
                        onPress: () => {
                            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
                            window.open(whatsappUrl, '_blank');
                        },
                    },
                    {
                        text: 'Twitter',
                        onPress: () => {
                            const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`;
                            window.open(twitterUrl, '_blank');
                        },
                    },
                    {
                        text: 'Copy Link',
                        onPress: () => {
                            navigator.clipboard.writeText(eventUrl);
                            Alert.alert('Copied!', 'Event link copied to clipboard');
                        },
                    },
                    { text: 'Cancel', style: 'cancel' },
                ]);
            } else {
                // For mobile (React Native Share)
                const { Share } = require('react-native');
                await Share.share({
                    message: shareMessage,
                    url: eventUrl,
                    title: event.title,
                });
            }
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    const toggleReminder = async () => {
        if (!user) return Alert.alert('Error', 'Please login to set reminders.');

        try {
            if (reminderId) {
                // Remove Reminder
                const reminderDoc = await getDoc(doc(db, 'reminders', reminderId));
                if (reminderDoc.exists()) {
                    await cancelScheduledNotification(reminderDoc.data().notificationId);
                }
                await deleteDoc(doc(db, 'reminders', reminderId));
                setReminderId(null);
                Alert.alert('Reminder Removed');
            } else {
                // Set Reminder
                const notifId = await scheduleEventReminder(event);
                if (notifId) {
                    const docRef = await addDoc(collection(db, 'reminders'), {
                        userId: user.uid,
                        eventId: event.id,
                        eventTitle: event.title,
                        remindAt: new Date(new Date(event.startAt).getTime() - 10 * 60000), // 10 mins before
                        notificationId: notifId,
                        createdAt: new Date().toISOString(),
                    });
                    setReminderId(docRef.id);
                    Alert.alert('Reminder Added'); // Simple match to request
                } else {
                    Alert.alert('Notice', 'Event is too close or passed.');
                }
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Action failed.');
        }
    };

    const toggleRsvp = async () => {
        if (!user) {
            Alert.alert('Sign In', 'Please sign in to register.');
            return;
        }

        // 1. Custom Form Logic (if not already going and custom form exists)
        if (event.hasCustomForm && event.customFormSchema?.length > 0 && rsvpStatus !== 'going') {
            navigation.navigate('EventRegistrationForm', { event });
            return;
        }

        // 2. Paid Event Logic
        if (event.isPaid && rsvpStatus !== 'going') {
            if (event.registrationLink) {
                Alert.alert('External Registration', 'This event requires external registration.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Go to Link', onPress: () => openLink(event.registrationLink) },
                ]);
                return;
            }
            // Navigate to Payment
            navigation.navigate('Payment', { event, price: event.price || 0 });
            return;
        }

        // 3. Normal RSVP
        performRsvp();
    };

    const performRsvp = async () => {
        const ref = doc(db, 'events', eventId, 'participants', user.uid);
        const userRef = doc(db, 'users', user.uid, 'participating', eventId);
        const userProfileRef = doc(db, 'users', user.uid);

        try {
            if (rsvpStatus === 'going') {
                await deleteDoc(ref);
                await deleteDoc(userRef);
                await updateDoc(userProfileRef, { points: increment(-10) });
                Alert.alert('Withdrawn', 'You are no longer registered. (-10 Points)');
            } else {
                const userDoc = await getDoc(userProfileRef);
                const userData = userDoc.exists() ? userDoc.data() : {};

                await setDoc(ref, {
                    userId: user.uid,
                    email: user.email,
                    name: user.displayName || 'Anonymous',
                    branch: userData.branch || 'Unknown',
                    year: userData.year || 'Unknown',
                    joinedAt: new Date().toISOString(),
                });
                await setDoc(userRef, { eventId: eventId, joinedAt: new Date().toISOString() });
                await updateDoc(userProfileRef, { points: increment(10) });

                await scheduleEventReminder(event);
                Alert.alert('Success', 'Registered! (+10 Points)');
            }
        } catch (e) {
            console.error('RSVP Error: ', e);
            Alert.alert('Error', 'Failed to update RSVP');
        }
    };

    const { request, response, promptAsync } = CalendarService.useCalendarAuth();

    useEffect(() => {
        if (response?.type === 'success') {
            const { access_token } = response.params;
            CalendarService.addToCalendar(access_token, event)
                .then(() => Alert.alert('Success', 'Added to Google Calendar!'))
                .catch(() => Alert.alert('Error', 'Failed to add to calendar.'));
        }
    }, [response]);

    const openLink = url => {
        if (url) Linking.openURL(url).catch(() => Alert.alert('Error', 'Invalid Link'));
    };

    const handleExportReviews = async () => {
        try {
            const feedbackRef = collection(db, `events/${eventId}/feedback`);
            const snapshot = await getDocs(feedbackRef);

            if (snapshot.empty) {
                Alert.alert('No Reviews', 'This event has no feedback yet.');
                return;
            }

            let csv = 'User Name,Event Rating,Organizer Rating,Feedback,Date\n';
            snapshot.forEach(doc => {
                const d = doc.data();
                const line = `\"${d.userName || 'Anonymous'}\",${d.eventRating || '-'}\",${d.clubRating || '-'}\",\"${(d.feedback || '').replace(/\"/g, '""')}\",${d.createdAt}\n`;
                csv += line;
            });

            await Share.share({ message: csv, title: `Reviews - ${event.title}` });
        } catch (error) {
            console.error('Export Error: ', error);
            Alert.alert('Error', 'Failed to export reviews.');
        }
    };

    const sendCertificates = async () => {
        setSendingCertificates(true);
        try {
            // Fetch Participants
            console.log(`Fetching participants for event: ${event.id}`);
            const participantsRef = collection(db, `events/${event.id}/participants`);
            const snapshot = await getDocs(participantsRef);
            console.log(`Snapshot size: ${snapshot.size}`);

            const participants = snapshot.docs
                .map(doc => {
                    const data = doc.data();
                    console.log(`Participant: ${data.name}, Email: ${data.email}`);
                    return {
                        name: data.name,
                        email: data.email,
                    };
                })
                .filter(p => p.email && p.email !== '-');

            console.log(`Valid participants count: ${participants.length}`);

            if (participants.length === 0) {
                Alert.alert('Error', 'No participants found with valid emails.');
                setSendingCertificates(false);
                return;
            }

            // Send certificates via EmailJS (Frontend)
            console.log('Calling sendBulkCertificates...');
            const eventLink = `https://unievent-ez2w.onrender.com/event/${event.id}`;
            const count = await sendBulkCertificates(
                participants,
                event.title,
                new Date(event.startAt).toLocaleDateString(),
                eventLink,
            );
            console.log(`Sent count: ${count}`);

            // Update event status
            await updateDoc(doc(db, 'events', event.id), {
                certificatesSent: true,
                certificatesSentAt: new Date().toISOString(),
            });

            Alert.alert('Success', `Certificates sent to ${count} participants.`);
        } catch (e) {
            console.error('Certificate Send Error:', e);
            Alert.alert('Error', 'Failed to send certificates via EmailJS');
        } finally {
            setSendingCertificates(false);
        }
    };

    const handleDownloadCertificate = async () => {
        try {
            setSendingCertificates(true);

            // Modern Professional Certificate Design
            const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Great+Vibes&family=Montserrat:wght@300;400;600&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');
                    
                    @page { margin: 0; size: auto; }
                    
                    body { margin: 0; padding: 0; background-color: #fff; -webkit-print-color-adjust: exact; }
                    
                    .page { 
                        width: 100vw; height: 100vh; 
                        box-sizing: border-box; 
                        display: flex; align-items: center; justify-content: center;
                        background: #fff;
                        padding: 20px;
                    }

                    .border-frame {
                        width: 100%; height: 100%;
                        max-width: 95%; max-height: 95%;
                        border: 5px solid #FF6B35;
                        display: flex; align-items: center; justify-content: center;
                        position: relative;
                        background: radial-gradient(circle at center, #ffffff 0%, #fffbf2 100%);
                    }

                    .inner-frame {
                        width: 98%; height: 98%;
                        border: 2px solid #333;
                        display: flex; flex-direction: column;
                        justify-content: space-between;
                        align-items: center;
                        padding: 40px 20px;
                        box-sizing: border-box;
                        position: relative;
                    }

                    /* Corner Ornaments (CSS Shapes) */
                    .corner {
                        position: absolute; width: 40px; height: 40px;
                        border-color: #FF6B35; border-style: solid;
                    }
                    .tl { top: 10px; left: 10px; border-width: 3px 0 0 3px; }
                    .tr { top: 10px; right: 10px; border-width: 3px 3px 0 0; }
                    .bl { bottom: 10px; left: 10px; border-width: 0 0 3px 3px; }
                    .br { bottom: 10px; right: 10px; border-width: 0 3px 3px 0; }

                    /* Text Logo */
                    .brand-name {
                        font-family: 'Great Vibes', cursive;
                        font-size: 50px;
                        color: #FF6B35;
                        margin-bottom: 30px;
                    }
                    
                    /* Title */
                    h1 { 
                        font-family: 'Cinzel', serif; 
                        font-size: 42px; 
                        color: #1a1a1a; 
                        text-transform: uppercase; 
                        letter-spacing: 6px; 
                        margin: 0;
                        font-weight: 700;
                        text-align: center;
                        border-bottom: 2px solid #FF6B35;
                        padding-bottom: 10px;
                        display: inline-block;
                    }
                    
                    p.certify { 
                        font-family: 'Montserrat', sans-serif;
                        font-size: 14px; 
                        color: #555; 
                        text-transform: uppercase;
                        letter-spacing: 3px;
                        margin-top: 40px;
                        margin-bottom: 10px;
                    }
                    
                    /* Participant Name */
                    h2.name { 
                        font-family: 'Playfair Display', serif;
                        font-style: italic;
                        font-size: 58px; 
                        color: #000; 
                        margin: 10px 0;
                        padding: 0 20px;
                        text-align: center;
                        line-height: 1.2;
                    }
                    
                    p.participated { 
                        font-family: 'Montserrat', sans-serif;
                        font-size: 16px; 
                        color: #555; 
                        margin: 20px 0;
                        letter-spacing: 1px;
                        max-width: 80%;
                        text-align: center;
                        line-height: 1.5;
                    }

                    p.participated strong {
                        color: #FF6B35;
                        font-weight: 600;
                    }
                    
                    /* Event Title */
                    h3.event { 
                        font-family: 'Cinzel', serif;
                        color: #e65100; 
                        font-size: 32px; 
                        margin: 0 0 40px 0; 
                        font-weight: 600; 
                        text-transform: uppercase;
                        letter-spacing: 2px;
                        text-align: center;
                    }
                    
                    .footer { 
                        width: 100%;
                        display: flex; 
                        justify-content: space-around; 
                        align-items: flex-end;
                        margin-top: auto;
                        padding-bottom: 20px;
                    }
                    
                    .sign-box { text-align: center; }
                    .sign-name { 
                        font-family: 'Great Vibes', cursive; 
                        font-size: 32px; 
                        color: #333; 
                        margin-bottom: 5px; 
                        border-bottom: 1px solid #999;
                        min-width: 180px;
                        padding-bottom: 5px;
                    }
                    .sign-label { 
                        font-family: 'Montserrat', sans-serif;
                        font-size: 10px; 
                        color: #777; 
                        text-transform: uppercase; 
                        letter-spacing: 2px;
                        padding-top: 5px;
                    }

                    .watermark {
                        position: absolute;
                        top: 50%; left: 50%;
                        transform: translate(-50%, -50%);
                        font-family: 'Cinzel', serif;
                        font-size: 110px;
                        opacity: 0.03;
                        color: #000;
                        font-weight: 700;
                        z-index: 0;
                        pointer-events: none;
                        white-space: nowrap;
                    }

                    .certificate-id {
                        position: absolute;
                        bottom: 10px;
                        right: 15px;
                        font-family: 'Montserrat', sans-serif;
                        font-size: 8px;
                        color: #aaa;
                    }
                </style>
            </head>
            <body>
                <div class="page">
                    <div class="border-frame">
                        <div class="inner-frame">
                            <div class="corner tl"></div>
                            <div class="corner tr"></div>
                            <div class="corner bl"></div>
                            <div class="corner br"></div>

                            <div class="watermark">UniEvent</div>
                            
                            <!-- Header -->
                            <div style="text-align: center; width: 100%; z-index: 1;">
                                <div class="brand-name">UniEvent</div>
                                <h1>Certificate of Participation</h1>
                            </div>
                            
                            <!-- Body -->
                            <div style="text-align: center; width: 100%; z-index: 1; flex: 1; display: flex; flex-direction: column; justify-content: center;">
                                <p class="certify">This is to certify that</p>
                                
                                <h2 class="name">${user.displayName || 'Participant'}</h2>
                                
                                <p class="participated">
                                    has successfully demonstrated commitment and enthusiasm by participating in the event
                                </p>
                                
                                <h3 class="event">${event.title}</h3>
                            </div>
                            
                            <!-- Footer -->
                            <div class="footer" style="z-index: 1;">
                                <div class="sign-box">
                                    <div class="sign-name">UniEvent Team</div>
                                    <div class="sign-label">Organizer</div>
                                </div>
                                
                                <div style="opacity: 0.9;">
                                    <!-- Badge Icon -->
                                    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#FFB74D" stroke="#E65100" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M12 17.77V2" stroke="#E65100" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.5"/>
                                    </svg>
                                </div>
                                
                                <div class="sign-box">
                                    <div class="sign-name">${new Date(event.startAt).toLocaleDateString()}</div>
                                    <div class="sign-label">Date Issued</div>
                                </div>
                            </div>

                            <div class="certificate-id">ID: ${event.id.substring(0, 8).toUpperCase()}-${Date.now().toString().substring(8)}</div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
            `;

            if (Platform.OS === 'web') {
                // Open separate window for reliable printing on mobile web
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                    printWindow.document.write(html);
                    printWindow.document.close();

                    // Allow styles and fonts to load
                    setTimeout(() => {
                        printWindow.focus();
                        printWindow.print();
                    }, 500);
                } else {
                    Alert.alert('Blocked', 'Please allow pop-ups to download the certificate.');
                }
            } else {
                const { uri } = await Print.printToFileAsync({ html });

                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
                } else {
                    Alert.alert('Success', 'Certificate generated!');
                }
            }
        } catch (e) {
            console.error('Certificate Error:', e);
            Alert.alert('Error', 'Failed to generate certificate: ' + e.message);
        } finally {
            setSendingCertificates(false); // Reset loading state
        }
    };

    const handleSendCertificates = async () => {
        console.log('Send Certificates Button Clicked');
        sendCertificates();
    };

    const handleFeedbackSubmit = async data => {
        try {
            await submitFeedback({
                eventId: event.id,
                clubId: event.ownerId,
                userId: user.uid,
                attended: true,
                eventRating: data.eventRating,
                clubRating: data.clubRating,
                feedback: data.feedback,
            });

            setHasGivenFeedback(true);
            Alert.alert('Thank You', 'Feedback submitted!');
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to submit feedback');
        }
    };

    if (loading || !event)
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                {/* Immersive Header Image */}
                <ImageBackground
                    source={{ uri: event.bannerUrl || 'https://via.placeholder.com/800x600' }}
                    style={styles.headerImage}
                >
                    <LinearGradient
                        colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.8)']}
                        style={styles.headerGradient}
                    >
                        <View style={styles.headerSafe}>
                            <TouchableOpacity
                                style={styles.backButton}
                                onPress={() => navigation.goBack()}
                            >
                                <Ionicons name="arrow-back" size={24} color="#fff" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.bookmarkButton}
                                onPress={toggleBookmark}
                            >
                                <Ionicons
                                    name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                                    size={24}
                                    color="#fff"
                                />
                            </TouchableOpacity>
                        </View>

                        {/* Live Badge - only show when event is currently happening */}
                        {new Date() >= new Date(event.startAt) &&
                            new Date() <= new Date(event.endAt) && (
                                <View style={styles.liveBadge}>
                                    <Ionicons name="radio-button-on" size={14} color="#fff" />
                                    <Text style={styles.liveText}>LIVE</Text>
                                </View>
                            )}
                    </LinearGradient>
                </ImageBackground>

                {/* Content Sheet */}
                <View style={styles.contentSheet}>
                    {/* SUSPENSION BANNER */}
                    {event?.status === 'suspended' && (
                        <View
                            style={{
                                backgroundColor: '#FF444420',
                                padding: 16,
                                borderRadius: 12,
                                marginBottom: 20,
                                borderWidth: 1,
                                borderColor: '#FF4444',
                            }}
                        >
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 10,
                                    marginBottom: 8,
                                }}
                            >
                                <Ionicons name="warning" size={24} color="#FF4444" />
                                <Text
                                    style={{ fontSize: 18, fontWeight: 'bold', color: '#FF4444' }}
                                >
                                    Event Suspended
                                </Text>
                            </View>
                            <Text style={{ color: theme.colors.text }}>
                                This event has been suspended by the admin for violating guidelines.
                                {event.appealStatus === 'pending'
                                    ? '\n\n⚠️ Your appeal is under review.'
                                    : ''}
                            </Text>

                            {/* OWNER APPEAL BUTTON */}
                            {user?.uid === event?.ownerId && event?.appealStatus !== 'pending' && (
                                <TouchableOpacity
                                    style={{
                                        backgroundColor: '#FF4444',
                                        padding: 12,
                                        borderRadius: 8,
                                        marginTop: 12,
                                        alignItems: 'center',
                                    }}
                                    onPress={() => setShowAppealModal(true)}
                                >
                                    <Text style={{ color: 'white', fontWeight: 'bold' }}>
                                        Appeal Suspension
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Header Section */}
                    <View style={styles.headerSection}>
                        <View style={styles.badgeRow}>
                            <View
                                style={[
                                    styles.categoryBadge,
                                    { backgroundColor: theme.colors.primary + '20' },
                                ]}
                            >
                                <Text
                                    style={[styles.categoryText, { color: theme.colors.primary }]}
                                >
                                    {event.category}
                                </Text>
                            </View>
                            {event.isPaid ? (
                                <View style={[styles.priceBadge, { backgroundColor: '#F59E0B' }]}>
                                    <Ionicons name="cash" size={14} color="#fff" />
                                    <Text style={styles.priceText}>₹{event.price}</Text>
                                </View>
                            ) : (
                                <View style={[styles.priceBadge, { backgroundColor: '#F59E0B' }]}>
                                    <Ionicons name="gift" size={14} color="#fff" />
                                    <Text style={styles.priceText}>Free</Text>
                                </View>
                            )}
                        </View>

                        <Text style={[styles.eventTitle, { color: theme.colors.text }]}>
                            {event.title}
                        </Text>

                        <TouchableOpacity
                            style={styles.hostButton}
                            onPress={() =>
                                navigation.navigate('ClubProfile', {
                                    clubId: event.ownerId,
                                    clubName: hostName,
                                })
                            }
                        >
                            <View
                                style={[
                                    styles.hostAvatar,
                                    { backgroundColor: theme.colors.primary + '20' },
                                ]}
                            >
                                <Text
                                    style={[styles.hostAvatarText, { color: theme.colors.primary }]}
                                >
                                    {hostName?.[0]?.toUpperCase()}
                                </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={[
                                        styles.hostLabel,
                                        { color: theme.colors.textSecondary },
                                    ]}
                                >
                                    Hosted by
                                </Text>
                                <Text style={[styles.hostName, { color: theme.colors.text }]}>
                                    {hostName}
                                </Text>
                            </View>
                            <Ionicons
                                name="chevron-forward"
                                size={20}
                                color={theme.colors.textSecondary}
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Quick Actions Row */}
                    <View
                        style={[styles.quickActionsCard, { backgroundColor: theme.colors.surface }]}
                    >
                        <TouchableOpacity style={styles.quickAction} onPress={toggleReminder}>
                            <View
                                style={[
                                    styles.quickActionIcon,
                                    {
                                        backgroundColor: reminderId
                                            ? theme.colors.primary
                                            : theme.colors.primary + '20',
                                    },
                                ]}
                            >
                                <Ionicons
                                    name={reminderId ? 'notifications' : 'notifications-outline'}
                                    size={20}
                                    color={reminderId ? '#fff' : theme.colors.primary}
                                />
                            </View>
                            <Text style={[styles.quickActionLabel, { color: theme.colors.text }]}>
                                Remind
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.quickAction} onPress={() => promptAsync()}>
                            <View
                                style={[
                                    styles.quickActionIcon,
                                    { backgroundColor: theme.colors.primary + '20' },
                                ]}
                            >
                                <Ionicons
                                    name="calendar-outline"
                                    size={20}
                                    color={theme.colors.primary}
                                />
                            </View>
                            <Text style={[styles.quickActionLabel, { color: theme.colors.text }]}>
                                Calendar
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.quickAction} onPress={shareEvent}>
                            <View
                                style={[
                                    styles.quickActionIcon,
                                    { backgroundColor: theme.colors.primary + '20' },
                                ]}
                            >
                                <Ionicons
                                    name="share-social-outline"
                                    size={20}
                                    color={theme.colors.primary}
                                />
                            </View>
                            <Text style={[styles.quickActionLabel, { color: theme.colors.text }]}>
                                Share
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.quickAction}
                            onPress={() =>
                                navigation.navigate('EventChat', {
                                    eventId: event.id,
                                    title: event.title,
                                })
                            }
                        >
                            <View
                                style={[
                                    styles.quickActionIcon,
                                    { backgroundColor: theme.colors.primary + '20' },
                                ]}
                            >
                                <Ionicons
                                    name="chatbubbles-outline"
                                    size={20}
                                    color={theme.colors.primary}
                                />
                            </View>
                            <Text style={[styles.quickActionLabel, { color: theme.colors.text }]}>
                                Chat
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Event Details Card */}
                    <View style={[styles.detailsCard, { backgroundColor: theme.colors.surface }]}>
                        <View style={styles.detailRow}>
                            <View
                                style={[
                                    styles.detailIconContainer,
                                    { backgroundColor: theme.colors.primary + '15' },
                                ]}
                            >
                                <Ionicons name="calendar" size={22} color={theme.colors.primary} />
                            </View>
                            <View style={styles.detailContent}>
                                <Text
                                    style={[
                                        styles.detailLabel,
                                        { color: theme.colors.textSecondary },
                                    ]}
                                >
                                    Date & Time
                                </Text>
                                <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                                    {new Date(event.startAt).toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                    })}
                                </Text>
                                <Text
                                    style={[
                                        styles.detailSubValue,
                                        { color: theme.colors.textSecondary },
                                    ]}
                                >
                                    {new Date(event.startAt).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </Text>
                            </View>
                        </View>

                        <View
                            style={[styles.detailDivider, { backgroundColor: theme.colors.border }]}
                        />

                        <View style={styles.detailRow}>
                            <View
                                style={[
                                    styles.detailIconContainer,
                                    { backgroundColor: theme.colors.primary + '15' },
                                ]}
                            >
                                <Ionicons name="location" size={22} color={theme.colors.primary} />
                            </View>
                            <View style={styles.detailContent}>
                                <Text
                                    style={[
                                        styles.detailLabel,
                                        { color: theme.colors.textSecondary },
                                    ]}
                                >
                                    Location
                                </Text>
                                <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                                    {event.eventMode === 'online' ? 'Online' : event.location}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* About Section */}
                    <View style={styles.aboutSection}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                            About Event
                        </Text>
                        <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
                            {event.description}
                        </Text>
                    </View>

                    {/* Meeting Link - Only for Attendees/Owner */}
                    {(rsvpStatus === 'going' || isOwner) && event.meetLink && (
                        <TouchableOpacity
                            style={[styles.outlinedButton, { borderColor: theme.colors.primary }]}
                            onPress={() => Linking.openURL(event.meetLink)}
                        >
                            <Ionicons name="videocam" size={22} color={theme.colors.primary} />
                            <Text
                                style={[styles.outlinedButtonText, { color: theme.colors.primary }]}
                            >
                                Join Virtual Meeting
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Organizer Tools */}
                    {isOwner && (
                        <View style={styles.organizerSection}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                                Organizer Tools
                            </Text>

                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                                <TouchableOpacity
                                    style={[
                                        styles.compactButton,
                                        { borderColor: theme.colors.primary },
                                    ]}
                                    onPress={() =>
                                        navigation.navigate('CreateEvent', { event: event })
                                    }
                                >
                                    <Ionicons
                                        name="create-outline"
                                        size={20}
                                        color={theme.colors.primary}
                                    />
                                    <Text
                                        style={[
                                            styles.compactButtonText,
                                            { color: theme.colors.primary },
                                        ]}
                                    >
                                        Edit
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.compactButton,
                                        { borderColor: theme.colors.primary },
                                    ]}
                                    onPress={() =>
                                        navigation.navigate('QRScanner', {
                                            eventId: event.id,
                                            eventTitle: event.title,
                                        })
                                    }
                                >
                                    <Ionicons
                                        name="qr-code"
                                        size={20}
                                        color={theme.colors.primary}
                                    />
                                    <Text
                                        style={[
                                            styles.compactButtonText,
                                            { color: theme.colors.primary },
                                        ]}
                                    >
                                        Check-In
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.compactButton,
                                        { borderColor: theme.colors.primary },
                                    ]}
                                    onPress={() =>
                                        navigation.navigate('AttendanceDashboard', {
                                            eventId: event.id,
                                            eventTitle: event.title,
                                        })
                                    }
                                >
                                    <Ionicons
                                        name="bar-chart"
                                        size={20}
                                        color={theme.colors.primary}
                                    />
                                    <Text
                                        style={[
                                            styles.compactButtonText,
                                            { color: theme.colors.primary },
                                        ]}
                                    >
                                        Analytics
                                    </Text>
                                </TouchableOpacity>

                                {new Date(event.endAt || event.startAt) < new Date() && (
                                    <TouchableOpacity
                                        style={[
                                            styles.compactButton,
                                            {
                                                borderColor: event.certificatesSent
                                                    ? theme.colors.success
                                                    : theme.colors.primary,
                                                width: '100%',
                                                marginTop: 4,
                                            },
                                            event.certificatesSent && {
                                                backgroundColor: theme.colors.success + '10',
                                                borderColor: theme.colors.success,
                                            },
                                        ]}
                                        onPress={
                                            event.certificatesSent
                                                ? () =>
                                                      Alert.alert(
                                                          'Sent',
                                                          'Certificates have already been sent.',
                                                      )
                                                : handleSendCertificates
                                        }
                                        disabled={sendingCertificates}
                                    >
                                        {sendingCertificates ? (
                                            <ActivityIndicator
                                                size="small"
                                                color={
                                                    event.certificatesSent
                                                        ? theme.colors.success
                                                        : theme.colors.primary
                                                }
                                            />
                                        ) : (
                                            <Ionicons
                                                name={
                                                    event.certificatesSent
                                                        ? 'checkmark-done-circle'
                                                        : 'mail-outline'
                                                }
                                                size={20}
                                                color={
                                                    event.certificatesSent
                                                        ? theme.colors.success
                                                        : theme.colors.primary
                                                }
                                            />
                                        )}
                                        <Text
                                            style={[
                                                styles.compactButtonText,
                                                {
                                                    color: event.certificatesSent
                                                        ? theme.colors.success
                                                        : theme.colors.primary,
                                                },
                                            ]}
                                        >
                                            {sendingCertificates
                                                ? 'Sending...'
                                                : event.certificatesSent
                                                  ? 'Certificates Sent'
                                                  : 'Send Certificates'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    )}

                    {/* Feedback Button (Post Event) */}
                    {rsvpStatus === 'going' &&
                        !isOwner &&
                        new Date(event.endAt) < new Date() &&
                        !isSuspended && (
                            <TouchableOpacity
                                style={[
                                    styles.feedbackCard,
                                    {
                                        backgroundColor: hasGivenFeedback
                                            ? theme.colors.surface
                                            : theme.colors.primary,
                                        borderWidth: hasGivenFeedback ? 1 : 0,
                                        borderColor: theme.colors.border,
                                    },
                                ]}
                                onPress={() =>
                                    hasGivenFeedback
                                        ? Alert.alert('Done', 'Feedback already sent.')
                                        : setShowFeedbackModal(true)
                                }
                            >
                                <Ionicons
                                    name={hasGivenFeedback ? 'checkmark-circle' : 'star'}
                                    size={24}
                                    color={hasGivenFeedback ? theme.colors.primary : '#fff'}
                                />
                                <Text
                                    style={[
                                        styles.feedbackText,
                                        {
                                            color: hasGivenFeedback ? theme.colors.text : '#fff',
                                        },
                                    ]}
                                >
                                    {hasGivenFeedback ? 'Feedback Submitted' : 'Rate This Event'}
                                </Text>
                                {!hasGivenFeedback && (
                                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                                )}
                            </TouchableOpacity>
                        )}

                    {/* Spacer for FAB */}
                    <View style={{ height: 100 }} />
                </View>
            </ScrollView>

            {/* Floating Action Bar (Bottom) */}
            {!isSuspended && (
                <View style={[styles.fabContainer, { backgroundColor: theme.colors.surface }]}>
                    <View style={styles.fabSubInfo}>
                        <Text style={styles.fabLabel}>Attending</Text>
                        <Text style={styles.fabValue}>{participantCount} People</Text>
                    </View>

                    {!rsvpStatus && event && event.capacity && participantCount >= event.capacity && !isOnWaitlist ? (
                        <TouchableOpacity
                            style={[styles.waitlistButton]}
                            onPress={handleJoinWaitlist}
                            disabled={isWaitlistLoading}
                        >
                            <Text style={styles.buttonText}>
                                {isWaitlistLoading ? 'Joining...' : 'Join Waitlist'}
                            </Text>
                        </TouchableOpacity>
                    ) : isOnWaitlist ? (
                        <TouchableOpacity
                            style={[styles.leaveWaitlistButton]}
                            onPress={handleLeaveWaitlist}
                        >
                            <Text style={styles.leaveWaitlistText}>
                                Waitlist #{waitlistPosition}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[
                                styles.primaryBtn,
                                rsvpStatus === 'going' && styles.secondaryBtn,
                                new Date(event.endAt) < new Date() &&
                                    !(rsvpStatus === 'going' && event.certificatesSent) && {
                                        backgroundColor: theme.colors.textSecondary,
                                        borderColor: theme.colors.textSecondary,
                                    },
                            ]}
                            onPress={
                                new Date(event.endAt) < new Date()
                                    ? rsvpStatus === 'going' && event.certificatesSent
                                        ? handleDownloadCertificate
                                        : null
                                    : toggleRsvp
                            }
                            disabled={
                                new Date(event.endAt) < new Date() &&
                                !(rsvpStatus === 'going' && event.certificatesSent)
                            }
                        >
                            <Text
                                style={[
                                    styles.primaryBtnText,
                                    rsvpStatus === 'going' && styles.secondaryBtnText,
                                    new Date(event.endAt) < new Date() &&
                                        !(rsvpStatus === 'going' && event.certificatesSent) && {
                                            color: '#fff',
                                        },
                                ]}
                            >
                                {new Date(event.endAt) < new Date()
                                    ? rsvpStatus === 'going'
                                        ? event.certificatesSent
                                            ? 'Download Certificate'
                                            : 'Event Ended'
                                        : 'Closed'
                                    : rsvpStatus === 'going'
                                      ? 'Registered ✓'
                                      : event.isPaid
                                        ? `Book Ticket (₹${event.price})`
                                        : 'RSVP Now'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            <FeedbackModal
                visible={showFeedbackModal}
                onClose={() => setShowFeedbackModal(false)}
                feedbackRequest={{
                    eventTitle: event.title,
                    clubName: event.organizerName || 'Organizer',
                }}
                onSubmit={handleFeedbackSubmit}
            />

            <AppealModal
                visible={showAppealModal}
                onClose={() => setShowAppealModal(false)}
                onSubmit={handleSubmitAppeal}
                isSubmitting={sendingAppeal}
            />
        </View>
    );
}

const getStyles = theme =>
    StyleSheet.create({
        // Header
        headerImage: { height: 350, width: '100%' },
        headerGradient: { flex: 1, paddingTop: 40, paddingHorizontal: 20 },
        headerSafe: { flexDirection: 'row', justifyContent: 'space-between' },
        backButton: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
            ...theme.shadows.small,
        },
        bookmarkButton: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
            ...theme.shadows.small,
        },
        liveBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#FF3B30',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            position: 'absolute',
            top: 20,
            left: 20,
        },
        liveText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

        contentSheet: {
            flex: 1,
            marginTop: -40,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            backgroundColor: theme.colors.background,
            paddingHorizontal: 24,
            paddingTop: 32,
        },

        // Header Section
        headerSection: {
            marginBottom: 20,
        },
        badgeRow: {
            flexDirection: 'row',
            gap: 8,
            marginBottom: 16,
        },
        categoryBadge: {
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
        },
        categoryText: {
            fontSize: 12,
            fontWeight: '600',
        },
        priceBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
        },
        priceText: {
            color: '#fff',
            fontSize: 12,
            fontWeight: '700',
        },
        eventTitle: {
            fontSize: 28,
            fontWeight: '800',
            marginBottom: 16,
            lineHeight: 34,
        },
        hostButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 12,
        },
        hostAvatar: {
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
        },
        hostAvatarText: {
            fontSize: 18,
            fontWeight: '700',
        },
        hostLabel: {
            fontSize: 12,
        },
        hostName: {
            fontSize: 16,
            fontWeight: '600',
        },

        // Quick Actions
        quickActionsCard: {
            flexDirection: 'row',
            justifyContent: 'space-around',
            padding: 16,
            borderRadius: 20,
            marginBottom: 20,
            ...theme.shadows.small,
        },
        quickAction: {
            alignItems: 'center',
            gap: 8,
        },
        quickActionIcon: {
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
        },
        quickActionLabel: {
            fontSize: 12,
            fontWeight: '500',
        },

        // Details Card
        detailsCard: {
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
            ...theme.shadows.small,
        },
        detailRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 16,
        },
        detailIconContainer: {
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
        },
        detailContent: {
            flex: 1,
        },
        detailLabel: {
            fontSize: 12,
            fontWeight: '500',
            marginBottom: 4,
        },
        detailValue: {
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 2,
        },
        detailSubValue: {
            fontSize: 14,
        },
        detailDivider: {
            height: 1,
            marginVertical: 16,
        },

        // About Section
        aboutSection: {
            marginBottom: 20,
        },
        sectionTitle: {
            fontSize: 20,
            fontWeight: '700',
            marginBottom: 12,
        },
        description: {
            fontSize: 15,
            lineHeight: 24,
        },

        // Outlined Button (for Virtual Meeting, Check-In, Analytics)
        outlinedButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            paddingVertical: 16,
            paddingHorizontal: 24,
            borderRadius: 14,
            borderWidth: 2,
            marginBottom: 14,
            backgroundColor: theme.colors.surface,
            ...theme.shadows.small,
        },
        outlinedButtonText: {
            fontSize: 16,
            fontWeight: '700',
        },

        // Meet Link Card
        meetLinkCard: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 14,
            paddingHorizontal: 16,
            borderRadius: 14,
            marginBottom: 20,
            gap: 12,
            ...theme.shadows.default,
        },
        meetLinkIcon: {
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
        },
        meetLinkTitle: {
            color: '#fff',
            fontSize: 14,
            fontWeight: '700',
            marginBottom: 2,
        },
        meetLinkSubtitle: {
            color: 'rgba(255,255,255,0.85)',
            fontSize: 11,
        },

        // Organizer Section
        organizerSection: {
            marginBottom: 20,
        },
        organizerGrid: {
            flexDirection: 'row',
            gap: 10,
        },
        organizerCard: {
            flex: 1,
            padding: 16,
            paddingVertical: 18,
            borderRadius: 14,
            alignItems: 'center',
            ...theme.shadows.small,
            justifyContent: 'center',
        },
        organizerIconBg: {
            width: 44,
            height: 44,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
        },
        organizerCardTitle: {
            fontSize: 15,
            fontWeight: '700',
            marginBottom: 4,
        },
        organizerCardDesc: {
            fontSize: 12,
            textAlign: 'center',
            opacity: 0.7,
        },

        // Compact Buttons for Organizer Tools
        compactButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderWidth: 1,
            borderRadius: 12,
            flexGrow: 1, // Allow buttons to grow to fill space
            minWidth: '45%', // Ensure 2 per row roughly
        },
        compactButtonText: {
            fontSize: 14,
            fontWeight: '600',
        },

        // Feedback Card
        feedbackCard: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 18,
            borderRadius: 20,
            gap: 12,
            marginBottom: 20,
            ...theme.shadows.default,
        },
        feedbackText: {
            fontSize: 16,
            fontWeight: '700',
            flex: 1,
        },

        // Waitlist Styles
        waitlistButton: {
            backgroundColor: '#f59e0b',
            paddingVertical: 14,
            paddingHorizontal: 32,
            borderRadius: 12,
            ...theme.shadows.default,
        },
        leaveWaitlistButton: {
            backgroundColor: '#fef3c7',
            paddingVertical: 14,
            paddingHorizontal: 32,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#f59e0b',
        },
        leaveWaitlistText: {
            color: '#92400e',
            fontWeight: 'bold',
            fontSize: 14,
        },
        buttonText: {
            color: '#fff',
            fontWeight: 'bold',
            fontSize: 16,
        },

        // FAB
        fabContainer: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 20,
            paddingBottom: 30,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            ...theme.shadows.large,
        },
        fabSubInfo: { justifyContent: 'center' },
        fabLabel: { fontSize: 12, color: theme.colors.textSecondary },
        fabValue: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text },
        primaryBtn: {
            backgroundColor: theme.colors.primary,
            paddingVertical: 14,
            paddingHorizontal: 32,
            borderRadius: 12,
            ...theme.shadows.default,
        },
        secondaryBtn: {
            backgroundColor: theme.colors.surface,
            borderWidth: 2,
            borderColor: theme.colors.primary,
        },
        primaryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
        secondaryBtnText: { color: theme.colors.primary },
    });