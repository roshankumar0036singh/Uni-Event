import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as NavigationBar from 'expo-navigation-bar';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PropTypes from 'prop-types';

import 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { doc, updateDoc } from 'firebase/firestore';
import CustomTabBar from './src/components/CustomTabBar';
import NotificationBell from './src/components/NotificationBell';
import PWAInstallPrompt from './src/components/PWAInstallPrompt';
import ScreenWrapper from './src/components/ScreenWrapper';
import { AuthProvider, useAuth } from './src/lib/AuthContext';
import { ThemeProvider, useTheme } from './src/lib/ThemeContext';
import { db } from './src/lib/firebaseConfig';
import { registerForPushNotificationsAsync } from './src/lib/notificationService';
import AdminDashboard from './src/screens/AdminDashboard';
import AppearanceScreen from './src/screens/AppearanceScreen';
import AttendanceDashboard from './src/screens/AttendanceDashboard';
import AuthScreen from './src/screens/AuthScreen';
import ClubProfileScreen from './src/screens/ClubProfileScreen';
import CreateEvent from './src/screens/CreateEvent';
import EventAnalytics from './src/screens/EventAnalytics';
import EventChatScreen from './src/screens/EventChatScreen';
import EventDetail from './src/screens/EventDetail';
import EventRegistrationFormScreen from './src/screens/EventRegistrationFormScreen';
import FormBuilderScreen from './src/screens/FormBuilderScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import MyEventsScreen from './src/screens/MyEventsScreen';
import MyRegisteredEventsScreen from './src/screens/MyRegisteredEventsScreen';
import ParticipatingEventsScreen from './src/screens/ParticipatingEventsScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import QRScannerScreen from './src/screens/QRScannerScreen';
import RemindersScreen from './src/screens/RemindersScreen';
import ReportBugScreen from './src/screens/ReportBugScreen';
import SavedEventsScreen from './src/screens/SavedEventsScreen';
import TicketScreen from './src/screens/TicketScreen';
import UserFeed from './src/screens/UserFeed';
import WalletScreen from './src/screens/WalletScreen';
import WrappedScreen from './src/screens/WrappedScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function HomeScreen({ navigation }) {
    const { user, role } = useAuth();
    const { theme, isDarkMode } = useTheme();

    useEffect(() => {
        const updateNavBar = async () => {
            await NavigationBar.setBackgroundColorAsync(theme.colors.surface);
            await NavigationBar.setButtonStyleAsync(isDarkMode ? 'light' : 'dark');
        };
        updateNavBar();
    }, [theme, isDarkMode]);

    const welcomeContent = (
        <View style={{ marginBottom: theme.spacing.m }}>
            <View
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginTop: theme.spacing.m,
                }}
            >
                <View style={styles.userInfo}>
                    <Text style={[theme.typography.h2, { color: theme.colors.text }]}>
                        Welcome,
                    </Text>
                    <Text
                        style={[theme.typography.h3, { color: theme.colors.text }]}
                        numberOfLines={1}
                    >
                        {user?.displayName || 'User'}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: theme.colors.secondary }]}>
                        <Text style={styles.badgeText}>{role?.toUpperCase() || 'STUDENT'}</Text>
                    </View>
                </View>
                <NotificationBell />
            </View>

            <View
                style={[
                    styles.actionContainer,
                    { marginBottom: theme.spacing.m, marginTop: theme.spacing.s },
                ]}
            >
                {(role === 'admin' || role === 'club') && (
                    <TouchableOpacity
                        style={[
                            styles.primaryButton,
                            { backgroundColor: theme.colors.primary, ...theme.shadows.default },
                        ]}
                        onPress={() => navigation.navigate('CreateEvent')}
                    >
                        <Text style={theme.typography.button}>+ Create Event</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    return (
        <ScreenWrapper>
            <UserFeed navigation={navigation} headerContent={welcomeContent} />
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        </ScreenWrapper>
    );
}

function TabNavigator() {
    const { role } = useAuth();

    return (
        <Tab.Navigator
            tabBar={props => <CustomTabBar {...props} />}
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    position: 'absolute',
                    backgroundColor: 'transparent',
                    elevation: 0,
                    borderTopWidth: 0,
                },
            }}
        >
            <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />

            {role === 'admin' && (
                <Tab.Screen
                    name="Admin"
                    component={AdminDashboard}
                    options={{ title: 'Control' }}
                />
            )}

            {(role === 'admin' || role === 'club') && (
                <Tab.Screen
                    name="MyEvents"
                    component={MyEventsScreen}
                    options={{ title: 'My Events' }}
                />
            )}

            <Tab.Screen
                name="Reminders"
                component={RemindersScreen}
                options={{ title: 'Reminders' }}
            />

            <Tab.Screen
                name="Leaderboard"
                component={LeaderboardScreen}
                options={{ title: 'Rankings' }}
            />

            <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
        </Tab.Navigator>
    );
}

const linking = {
    prefixes: ['https://unievent-ez2w.onrender.com', 'unievent://', 'http://localhost:19006'],
    config: {
        screens: {
            Main: {
                screens: {
                    Home: 'home',
                },
            },
            EventDetail: 'event/:eventId/:action?',
        },
    },
};

function Navigation() {
    const { user, loading } = useAuth();
    const { theme } = useTheme();

    if (loading) {
        return (
            <View
                style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: theme.colors.background,
                }}
            >
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={{ marginTop: 20, color: theme.colors.textSecondary, fontSize: 16 }}>
                    Please wait...
                </Text>
            </View>
        );
    }

    return (
        <NavigationContainer linking={linking}>
            <Stack.Navigator
                screenOptions={{
                    headerStyle: {
                        backgroundColor: theme.colors.surface,
                    },
                    headerTintColor: theme.colors.primary,
                    headerTitleStyle: {
                        fontWeight: 'bold',
                        color: theme.colors.text,
                    },
                    contentStyle: {
                        backgroundColor: theme.colors.background,
                    },
                }}
            >
                {user ? (
                    <>
                        <Stack.Screen
                            name="Main"
                            component={TabNavigator}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="CreateEvent"
                            component={CreateEvent}
                            options={{ title: 'Create New Event' }}
                        />
                        <Stack.Screen
                            name="EventDetail"
                            component={EventDetail}
                            options={{ title: 'Event Details' }}
                        />
                        <Stack.Screen
                            name="ParticipatingEvents"
                            component={ParticipatingEventsScreen}
                            options={{ title: "Events I'm Going To" }}
                        />
                        <Stack.Screen
                            name="EventAnalytics"
                            component={EventAnalytics}
                            options={{ title: 'Analytics' }}
                        />
                        <Stack.Screen
                            name="AttendanceDashboard"
                            component={AttendanceDashboard}
                            options={{ title: 'Attendance', headerShown: false }}
                        />
                        <Stack.Screen
                            name="QRScanner"
                            component={QRScannerScreen}
                            options={{ title: 'Scan QR', headerShown: false }}
                        />
                        <Stack.Screen
                            name="Appearance"
                            component={AppearanceScreen}
                            options={{ title: 'Appearance' }}
                        />
                        <Stack.Screen
                            name="ClubProfile"
                            component={ClubProfileScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="EventChat"
                            component={EventChatScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="Payment"
                            component={PaymentScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="TicketScreen"
                            component={TicketScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="Wallet"
                            component={WalletScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="MyRegisteredEvents"
                            component={MyRegisteredEventsScreen}
                            options={{ title: 'My Calendar' }}
                        />
                        <Stack.Screen
                            name="SavedEvents"
                            component={SavedEventsScreen}
                            options={{ title: 'Saved Events' }}
                        />
                        <Stack.Screen
                            name="FormBuilder"
                            component={FormBuilderScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="EventRegistrationForm"
                            component={EventRegistrationFormScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="Wrapped"
                            component={WrappedScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="ReportBug"
                            component={ReportBugScreen}
                            options={{ title: 'Report a Bug' }}
                        />
                    </>
                ) : (
                    <Stack.Screen
                        name="Auth"
                        component={AuthScreen}
                        options={{ headerShown: false }}
                    />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}

export default function App() {
    return (
        <SafeAreaProvider>
            <ThemeProvider>
                <AuthProvider>
                    <AppContent />
                    <PWAInstallPrompt />
                </AuthProvider>
            </ThemeProvider>
        </SafeAreaProvider>
    );
}

function AppContent() {
    const { user } = useAuth();
    const notificationListener = useRef();
    const responseListener = useRef();

    useEffect(() => {
        registerForPushNotificationsAsync().then(token => {
            if (user && token) {
                updateDoc(doc(db, 'users', user.uid), {
                    pushToken: token,
                }).catch(err => console.log('Failed to save push token', err));
            }
        });
        // Global Automation Check - DISABLED (Manual feedback sending only)
        // checkAndTriggerAutomations(user.uid);

        notificationListener.current = Notifications.addNotificationReceivedListener(
            notification => {
                console.log('Notification Received:', notification);
            },
        );

        responseListener.current = Notifications.addNotificationResponseReceivedListener(
            response => {
                console.log('Notification Tapped:', response);
            },
        );

        return () => {
            if (notificationListener.current)
                Notifications.removeNotificationSubscription(notificationListener.current);
            if (responseListener.current)
                Notifications.removeNotificationSubscription(responseListener.current);
        };
    }, [user]);

    return <Navigation />;
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    userInfo: {
        flex: 1,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginTop: 4,
    },
    badgeText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 10,
    },
    actionContainer: {
        flexDirection: 'row',
        gap: 10,
    },
    primaryButton: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        flex: 1,
        alignItems: 'center',
    },
});

HomeScreen.propTypes = {
    navigation: PropTypes.shape({
        navigate: PropTypes.func.isRequired,
    }).isRequired,
};
