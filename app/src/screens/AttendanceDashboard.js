import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
    collection,
    onSnapshot,
    orderBy,
    query,
    getDocs,
    doc,
    getDoc,
    where,
    updateDoc,
} from 'firebase/firestore';
import { useEffect, useState, useMemo } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Platform,
    Modal,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-chart-kit';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';
import { sendBulkAnnouncement, sendBulkFeedbackRequest } from '../lib/EmailService';

const { width } = Dimensions.get('window');

export default function AttendanceDashboard({ route, navigation }) {
    const { eventId, eventTitle } = route.params;
    const { user } = useAuth();
    const { theme } = useTheme();

    const [checkIns, setCheckIns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [departmentStats, setDepartmentStats] = useState({});
    const [yearStats, setYearStats] = useState({});
    const [eventData, setEventData] = useState(null);

    // Announcement State
    const [announcementModalVisible, setAnnouncementModalVisible] = useState(false);
    const [announcementSubject, setAnnouncementSubject] = useState('');
    const [announcementMessage, setAnnouncementMessage] = useState('');
    const [sending, setSending] = useState(false);

    // Feedback Request Modal State
    const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);

    const handleRequestFeedback = () => {
        setFeedbackModalVisible(true);
    };

    const handleSendFeedbackRequest = async () => {
        setSending(true);
        setFeedbackModalVisible(false);

        try {
            const participantsRef = collection(db, `events/${eventId}/participants`);
            const snapshot = await getDocs(participantsRef);
            const participants = snapshot.docs
                .map(doc => ({
                    name: doc.data().name,
                    email: doc.data().email,
                }))
                .filter(p => p.email && p.email !== '-');

            if (participants.length === 0) {
                Alert.alert('Error', 'No participants found.');
                setSending(false);
                return;
            }

            const count = await sendBulkFeedbackRequest(participants, eventTitle, eventId);

            // Update event to mark feedback as sent
            await updateDoc(doc(db, 'events', eventId), {
                feedbackRequestSent: true,
                feedbackRequestSentAt: new Date().toISOString(),
            });

            Alert.alert('Success', `Feedback request sent to ${count} participants.`);
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to send requests.');
        } finally {
            setSending(false);
        }
    };

    const handleSendAnnouncement = async () => {
        if (!announcementSubject.trim() || !announcementMessage.trim()) {
            Alert.alert('Error', 'Please enter subject and message');
            return;
        }

        setSending(true);
        try {
            // Fetch Participants
            const participantsRef = collection(db, `events/${eventId}/participants`);
            const snapshot = await getDocs(participantsRef);

            if (snapshot.empty) {
                Alert.alert('No Participants', 'No one to send email to.');
                setSending(false);
                return;
            }

            const participants = snapshot.docs
                .map(doc => ({
                    name: doc.data().name,
                    email: doc.data().email,
                }))
                .filter(p => p.email && p.email !== '-');

            if (participants.length === 0) {
                Alert.alert('No Emails', 'No valid emails found.');
                setSending(false);
                return;
            }

            // Send
            const count = await sendBulkAnnouncement(
                participants,
                announcementSubject,
                announcementMessage,
            );

            Alert.alert('Success', `Sent to ${count} participants.`);
            setAnnouncementModalVisible(false);
            setAnnouncementSubject('');
            setAnnouncementMessage('');
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to send.');
        } finally {
            setSending(false);
        }
    };

    // Fetch Event Data to check for Custom Form
    useEffect(() => {
        getDoc(doc(db, 'events', eventId)).then(snap => {
            if (snap.exists()) setEventData(snap.data());
        });
    }, [eventId]);

    // Live Participant Count
    const [totalRegistrations, setTotalRegistrations] = useState(0);

    // Real-time participants listener
    useEffect(() => {
        const participantsRef = collection(db, `events/${eventId}/participants`);
        const unsubscribe = onSnapshot(
            participantsRef,
            snapshot => {
                setTotalRegistrations(snapshot.size);
                setLoading(false);
            },
            error => {
                console.error('Error fetching participants:', error);
                setLoading(false);
            },
        );

        return () => unsubscribe();
    }, [eventId]);

    // Note: Automatic feedback sending is now handled globally in App.js via AutomationService.
    // This component simply reflects the status via 'eventData.feedbackRequestSent'.

    // Real-time check-ins listener
    useEffect(() => {
        const q = query(
            collection(db, 'events', eventId, 'checkIns'),
            orderBy('checkedInAt', 'desc'),
        );

        const unsubscribe = onSnapshot(q, snapshot => {
            const checkInsList = [];
            const deptCount = {};
            const yearCount = {};

            snapshot.forEach(doc => {
                const data = doc.data();
                checkInsList.push({ id: doc.id, ...data });

                const dept = data.userBranch || 'Unknown';
                deptCount[dept] = (deptCount[dept] || 0) + 1;

                const year = data.userYear || 'Unknown';
                yearCount[year] = (yearCount[year] || 0) + 1;
            });

            setCheckIns(checkInsList);
            setDepartmentStats(deptCount);
            setYearStats(yearCount);
        });

        return () => unsubscribe();
    }, [eventId]);

    // Calculate Peak Attendance Data
    const peakAttendanceData = useMemo(() => {
        if (!checkIns || checkIns.length === 0 || !eventData?.startAt) return null;

        const startAt = new Date(eventData.startAt).getTime();
        if (isNaN(startAt)) return null;
        const buckets = {
            '>30m Early': 0,
            '15-30m Early': 0,
            '0-15m Early': 0,
            '0-15m Late': 0,
            '15-30m Late': 0,
            '>30m Late': 0,
        };

        checkIns.forEach(checkIn => {
            const checkInTime = checkIn.checkedInAt?.toMillis();
            if (!checkInTime) return;

            const diffMinutes = (checkInTime - startAt) / 60000;

            if (diffMinutes < -30) buckets['>30m Early']++;
            else if (diffMinutes >= -30 && diffMinutes < -15) buckets['15-30m Early']++;
            else if (diffMinutes >= -15 && diffMinutes < 0) buckets['0-15m Early']++;
            else if (diffMinutes >= 0 && diffMinutes <= 15) buckets['0-15m Late']++;
            else if (diffMinutes > 15 && diffMinutes <= 30) buckets['15-30m Late']++;
            else buckets['>30m Late']++;
        });

        // Only render graph if there is at least one check-in with a valid timestamp
        const totalValid = Object.values(buckets).reduce((sum, val) => sum + val, 0);
        if (totalValid === 0) return null;

        const data = Object.values(buckets);
        const maxVal = Math.max(...data);

        return {
            segments: Math.max(1, Math.min(maxVal, 4)), // Prevent duplicate Y-axis labels by limiting segments
            labels: ['>30 E', '15-30 E', '0-15 E', '0-15 L', '15-30 L', '>30 L'],
            datasets: [
                {
                    data,
                    colors: [
                        (opacity = 1) => theme.colors.success || '#00C853',
                        (opacity = 1) => '#4CAF50',
                        (opacity = 1) => theme.colors.primary,
                        (opacity = 1) => theme.colors.warning || '#FFAB00',
                        (opacity = 1) => '#FF5722',
                        (opacity = 1) => theme.colors.error || '#FF3D00',
                    ],
                },
            ],
        };
    }, [checkIns, eventData, theme]);

    const downloadCSV = async (csvContent, fileName) => {
        if (Platform.OS === 'web') {
            // Create a blob and trigger download
            const bom = new Uint8Array([0xef, 0xbb, 0xbf]); // UTF-8 BOM
            const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            // Use standard share on mobile
            await Share.share({ message: csvContent, title: fileName });
        }
    };

    const handleExportParticipants = async () => {
        setExporting(true);
        try {
            const participantsRef = collection(db, `events/${eventId}/participants`);
            const snapshot = await getDocs(participantsRef);

            if (snapshot.empty) {
                Alert.alert('No Data', 'No registered participants yet.');
                setExporting(false);
                return;
            }

            let csv = 'Name,Email,Branch,Year,Joined At\n';

            // Fetch live user profiles to fill in missing Branch/Year
            const rows = await Promise.all(
                snapshot.docs.map(async docSnap => {
                    const d = docSnap.data();
                    let branch = d.branch;
                    let year = d.year;

                    // If missing, try to fetch from User Profile
                    if ((!branch || branch === '-' || branch === 'Unknown') && d.userId) {
                        try {
                            const { getDoc, doc } = require('firebase/firestore'); // Ensure imports
                            const userSnap = await getDoc(doc(db, 'users', d.userId));
                            if (userSnap.exists()) {
                                const userData = userSnap.data();
                                branch = userData.branch || branch;
                                year = userData.year || year;
                            }
                        } catch (e) {
                            console.log('Profile fetch err', e);
                        }
                    }

                    return `"${d.name || 'Anonymous'}","${d.email || '-'}","${branch || '-'}","${year || '-'}","${d.joinedAt}"\n`;
                }),
            );

            csv += rows.join('');

            await downloadCSV(csv, `Participants_${eventTitle}.csv`);
            if (Platform.OS === 'web') Alert.alert('Success', 'Download started!');
        } catch (error) {
            console.error('Export Error: ', error);
            Alert.alert('Error', 'Failed to export participants.');
        } finally {
            setExporting(false);
        }
    };

    const handleExportReviews = async () => {
        setExporting(true);
        try {
            const feedbackRef = collection(db, `events/${eventId}/feedback`);
            const snapshot = await getDocs(feedbackRef);

            if (snapshot.empty) {
                Alert.alert('No Reviews', 'This event has no feedback yet.');
                setExporting(false);
                return;
            }

            let csv = 'User Name,Event Rating,Organizer Rating,Feedback,Date\n';
            snapshot.forEach(doc => {
                const d = doc.data();
                // Fix CSV escaping and formatting
                const safeFeedback = (d.feedback || '').replace(/"/g, '""');
                const dateStr = d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '-';

                const line = `"${d.userName || 'Anonymous'}","${d.eventRating || '-'}","${d.clubRating || '-'}","${safeFeedback}","${dateStr}"\n`;
                csv += line;
            });

            await downloadCSV(csv, `Reviews_${eventTitle}.csv`);
            if (Platform.OS === 'web') Alert.alert('Success', 'Download started!');
        } catch (error) {
            console.error('Export Error: ', error);
            Alert.alert('Error', 'Failed to export reviews.');
        } finally {
            setExporting(false);
        }
    };

    const handleExportFormResponses = async () => {
        setExporting(true);
        try {
            const q = query(collection(db, 'registrations'), where('eventId', '==', eventId));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                Alert.alert('No Data', 'No form responses found.');
                setExporting(false);
                return;
            }

            // Build CSV Header from Schema
            const schema = eventData.customFormSchema || [];
            if (schema.length === 0) {
                Alert.alert('Error', 'Schema not found');
                setExporting(false);
                return;
            }

            let csv = 'User Name,User Email,' + schema.map(f => f.label).join(',') + ',Date\n';

            snapshot.forEach(doc => {
                const d = doc.data();
                const responseMap = d.responses || {};

                const responseValues = schema.map(f => {
                    let val = responseMap[f.id] || '';
                    val = String(val).replace(/"/g, '""'); // Escape quotes
                    return `"${val}"`;
                });

                const line = `"${d.userName || 'Anonymous'}","${d.userEmail || '-'}","${responseValues.join('","')}","${d.timestamp}"\n`;
                csv += line;
            });

            await downloadCSV(csv, `Form_Responses_${eventTitle}.csv`);
            if (Platform.OS === 'web') Alert.alert('Success', 'Download started!');
        } catch (e) {
            console.error('Export Error: ', e);
            Alert.alert('Error', 'Failed to export responses.');
        } finally {
            setExporting(false);
        }
    };

    const StatCard = ({ icon, label, value, color, subtitle, gradient }) => (
        <View style={styles.statCard}>
            <LinearGradient
                colors={gradient || [color + '20', color + '10']}
                style={styles.statGradient}
            >
                <View style={[styles.statIconBox, { backgroundColor: color + '30' }]}>
                    <Ionicons name={icon} size={22} color={color} />
                </View>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>{value}</Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                    {label}
                </Text>
                {subtitle && (
                    <Text style={[styles.statSubtitle, { color: theme.colors.textSecondary }]}>
                        {subtitle}
                    </Text>
                )}
            </LinearGradient>
        </View>
    );

    const CheckInItem = ({ item }) => {
        const timeAgo = getTimeAgo(item.checkedInAt?.toMillis());

        return (
            <View style={[styles.checkInItem, { backgroundColor: theme.colors.surface }]}>
                <View
                    style={[styles.checkInAvatar, { backgroundColor: theme.colors.primary + '20' }]}
                >
                    <Text style={[styles.avatarText, { color: theme.colors.primary }]}>
                        {item.userName?.[0]?.toUpperCase() || '?'}
                    </Text>
                </View>
                <View style={styles.checkInInfo}>
                    <Text style={[styles.checkInName, { color: theme.colors.text }]}>
                        {item.userName}
                    </Text>
                    <View style={styles.checkInMeta}>
                        <Ionicons
                            name="school-outline"
                            size={12}
                            color={theme.colors.textSecondary}
                        />
                        <Text
                            style={[styles.checkInDetails, { color: theme.colors.textSecondary }]}
                        >
                            {item.userBranch} • Year {item.userYear}
                        </Text>
                    </View>
                </View>
                <View style={styles.checkInTime}>
                    <View style={styles.checkmarkBadge}>
                        <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />
                    </View>
                    <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>
                        {timeAgo}
                    </Text>
                </View>
            </View>
        );
    };

    const getTimeAgo = timestamp => {
        if (!timestamp) return 'Just now';
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'Just now';
        if (minutes === 1) return '1 min ago';
        if (minutes < 60) return `${minutes} mins ago`;
        const hours = Math.floor(minutes / 60);
        if (hours === 1) return '1 hour ago';
        if (hours < 24) return `${hours} hours ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    const AnalyticsSection = ({ title, data, icon }) => {
        const total = Object.values(data).reduce((sum, val) => sum + val, 0);
        const sortedData = Object.entries(data).sort((a, b) => b[1] - a[1]);

        return (
            <View style={[styles.analyticsCard, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.analyticsHeader}>
                    <View style={styles.analyticsHeaderLeft}>
                        <Ionicons name={icon} size={18} color={theme.colors.primary} />
                        <Text style={[styles.analyticsTitle, { color: theme.colors.text }]}>
                            {title}
                        </Text>
                    </View>
                    <Text style={[styles.analyticsTotal, { color: theme.colors.textSecondary }]}>
                        {total} total
                    </Text>
                </View>
                {sortedData.map(([key, value]) => {
                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                    return (
                        <View key={key} style={styles.analyticsItem}>
                            <View style={styles.analyticsItemHeader}>
                                <Text style={[styles.analyticsLabel, { color: theme.colors.text }]}>
                                    {key}
                                </Text>
                                <Text
                                    style={[
                                        styles.analyticsValue,
                                        { color: theme.colors.textSecondary },
                                    ]}
                                >
                                    {value} ({percentage}%)
                                </Text>
                            </View>
                            <View style={styles.analyticsBarBg}>
                                <LinearGradient
                                    colors={[theme.colors.primary, theme.colors.primary + '80']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={[styles.analyticsBarFill, { width: `${percentage}%` }]}
                                />
                            </View>
                        </View>
                    );
                })}
            </View>
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView
            style={[styles.container, { backgroundColor: theme.colors.background }]}
            // Removed edges={['bottom']} so iOS notch doesn't cover the back button
        >
            <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                        Attendance
                    </Text>
                    <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
                        {eventTitle}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => navigation.navigate('QRScanner', { eventId, eventTitle })}
                    style={[styles.scanBtn, { backgroundColor: theme.colors.primary }]}
                >
                    <Ionicons name="qr-code" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.statsContainer}>
                    {/* Updated Stat Cards to use Primary Theme */}
                    <StatCard
                        icon="people"
                        label="REGISTERED"
                        value={totalRegistrations}
                        color={theme.colors.primary}
                        gradient={[theme.colors.primary + '20', theme.colors.primary + '10']}
                    />
                    <StatCard
                        icon="checkmark-done-circle"
                        label="CHECKED IN"
                        value={checkIns.length}
                        color={theme.colors.success} // Use Success/Green for check-ins for distinction, or Primary if strictly requested. Let's use Primary for now but maybe a variant. Wait, user screenshot showed Gold 0. Let's stick strictly to Theme.
                        gradient={[theme.colors.surface, theme.colors.surface]}
                    />
                    {/* Re-doing the StatCards to be safe and consistent */}
                </View>
                {/* ... (rest of render is handled by partial replacement or I need to include it) */}
                {/* Wait, the replace_file_content needs to be precise. I will just replace the StatCards implementation in the render block */}

                {/* Live Check-Ins Feed */}
                <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionHeaderLeft}>
                            <View style={styles.liveDotContainer}>
                                <View style={styles.liveDot} />
                            </View>
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                                Live Check-Ins
                            </Text>
                        </View>
                        <View style={styles.countBadge}>
                            <Text style={[styles.countText, { color: theme.colors.primary }]}>
                                {checkIns.length}
                            </Text>
                        </View>
                    </View>
                    {checkIns.length === 0 ? (
                        <View style={styles.emptyState}>
                            <View
                                style={[
                                    styles.emptyIcon,
                                    { backgroundColor: theme.colors.background },
                                ]}
                            >
                                <Ionicons
                                    name="people-outline"
                                    size={40}
                                    color={theme.colors.textSecondary}
                                />
                            </View>
                            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                                No check-ins yet
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.checkInsList}>
                            {checkIns.slice(0, 10).map(item => (
                                <CheckInItem key={item.id} item={item} />
                            ))}
                        </View>
                    )}
                </View>

                {peakAttendanceData && (
                    <View style={[styles.analyticsCard, { backgroundColor: theme.colors.surface }]}>
                        <View style={styles.analyticsHeader}>
                            <View style={styles.analyticsHeaderLeft}>
                                <Ionicons name="bar-chart" size={18} color={theme.colors.primary} />
                                <Text style={[styles.analyticsTitle, { color: theme.colors.text }]}>
                                    Peak Attendance Time
                                </Text>
                            </View>
                        </View>
                        <BarChart
                            data={peakAttendanceData}
                            width={width - 40}
                            height={220}
                            yAxisLabel=""
                            yAxisSuffix=""
                            segments={peakAttendanceData.segments}
                            chartConfig={{
                                backgroundGradientFrom: theme.colors.surface,
                                backgroundGradientTo: theme.colors.surface,
                                color: (opacity = 1) => theme.colors.border,
                                labelColor: (opacity = 1) => theme.colors.textSecondary,
                                barPercentage: 0.7,
                                barRadius: 4,
                                decimalPlaces: 0,
                                propsForLabels: {
                                    fontSize: 10,
                                    fontWeight: '600',
                                },
                                propsForBackgroundLines: {
                                    strokeDasharray: '4',
                                    stroke: theme.colors.textSecondary + '20',
                                },
                            }}
                            style={{
                                marginVertical: 0,
                                borderRadius: 16,
                                marginHorizontal: -10,
                                paddingRight: 30,
                            }}
                            showValuesOnTopOfBars={true}
                            fromZero={true}
                            withInnerLines={true}
                            withCustomBarColorFromData={true}
                            flatColor={true}
                        />
                    </View>
                )}

                {Object.keys(departmentStats).length > 0 && (
                    <AnalyticsSection
                        title="Department Breakdown"
                        data={departmentStats}
                        icon="school"
                    />
                )}

                {Object.keys(yearStats).length > 0 && (
                    <AnalyticsSection
                        title="Year-wise Distribution"
                        data={yearStats}
                        icon="calendar"
                    />
                )}

                {/* Communication Section */}
                <View style={styles.exportContainer}>
                    <Text style={[styles.exportTitle, { color: theme.colors.text }]}>
                        Communication
                    </Text>
                    <View style={styles.exportButtons}>
                        <TouchableOpacity
                            style={[
                                styles.exportBtn,
                                styles.premiumBtn,
                                { borderColor: theme.colors.primary },
                            ]}
                            onPress={() => setAnnouncementModalVisible(true)}
                        >
                            <Ionicons name="megaphone" size={24} color={theme.colors.primary} />
                            <Text style={[styles.exportBtnText, { color: theme.colors.primary }]}>
                                Announce
                            </Text>
                        </TouchableOpacity>

                        {/* Manual Feedback Request Button */}
                        <TouchableOpacity
                            style={[
                                styles.exportBtn,
                                styles.premiumBtn,
                                {
                                    borderColor: eventData?.feedbackRequestSent
                                        ? theme.colors.success
                                        : theme.colors.primary,
                                    backgroundColor: theme.colors.surface,
                                },
                            ]}
                            onPress={handleRequestFeedback}
                            disabled={sending}
                        >
                            {eventData?.feedbackRequestSent ? (
                                <>
                                    <Ionicons
                                        name="checkmark-done-circle"
                                        size={24}
                                        color={theme.colors.success}
                                    />
                                    <Text
                                        style={[
                                            styles.exportBtnText,
                                            { color: theme.colors.success },
                                        ]}
                                    >
                                        Feedback Sent
                                    </Text>
                                </>
                            ) : (
                                <>
                                    <Ionicons
                                        name="star-outline"
                                        size={24}
                                        color={theme.colors.primary}
                                    />
                                    <Text
                                        style={[
                                            styles.exportBtnText,
                                            { color: theme.colors.primary },
                                        ]}
                                    >
                                        Feedback
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Export Data Section */}
                <View style={styles.exportContainer}>
                    <Text style={[styles.exportTitle, { color: theme.colors.text }]}>
                        Export Data
                    </Text>
                    <View style={styles.exportButtons}>
                        {/* Intelligent Export Button: Prioritizes Custom Form Responses */}
                        <TouchableOpacity
                            style={[styles.exportBtn, styles.premiumBtn]}
                            onPress={
                                eventData?.hasCustomForm
                                    ? handleExportFormResponses
                                    : handleExportParticipants
                            }
                            disabled={exporting}
                        >
                            <Ionicons name="document-text" size={24} color={theme.colors.primary} />
                            <Text style={[styles.exportBtnText, { color: theme.colors.primary }]}>
                                {eventData?.hasCustomForm ? 'Form Responses' : 'Participants'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.exportBtn, styles.premiumBtn]}
                            onPress={handleExportReviews}
                            disabled={exporting}
                        >
                            <Ionicons name="star" size={24} color={theme.colors.primary} />
                            <Text style={[styles.exportBtnText, { color: theme.colors.primary }]}>
                                Reviews
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Announcement Modal */}
            <Modal
                visible={announcementModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setAnnouncementModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                                New Announcement
                            </Text>
                            <TouchableOpacity onPress={() => setAnnouncementModalVisible(false)}>
                                <Ionicons
                                    name="close"
                                    size={24}
                                    color={theme.colors.textSecondary}
                                />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                            Subject
                        </Text>
                        <TextInput
                            style={[
                                styles.input,
                                { color: theme.colors.text, borderColor: theme.colors.border },
                            ]}
                            placeholder="e.g. Important Update regarding..."
                            placeholderTextColor={theme.colors.textSecondary}
                            value={announcementSubject}
                            onChangeText={setAnnouncementSubject}
                        />

                        <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                            Message
                        </Text>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    color: theme.colors.text,
                                    borderColor: theme.colors.border,
                                    height: 100,
                                    textAlignVertical: 'top',
                                },
                            ]}
                            placeholder="Type your message here..."
                            placeholderTextColor={theme.colors.textSecondary}
                            multiline
                            value={announcementMessage}
                            onChangeText={setAnnouncementMessage}
                        />

                        <TouchableOpacity
                            style={[styles.sendBtn, { backgroundColor: theme.colors.primary }]}
                            onPress={handleSendAnnouncement}
                            disabled={sending}
                        >
                            {sending ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.sendBtnText}>Send Announcement</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Feedback Request Modal */}
            <Modal
                visible={feedbackModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setFeedbackModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                                Feedback
                            </Text>
                            <TouchableOpacity onPress={() => setFeedbackModalVisible(false)}>
                                <Ionicons
                                    name="close"
                                    size={24}
                                    color={theme.colors.textSecondary}
                                />
                            </TouchableOpacity>
                        </View>

                        <View style={{ paddingVertical: 20 }}>
                            <Ionicons
                                name="mail-outline"
                                size={48}
                                color={theme.colors.primary}
                                style={{ alignSelf: 'center', marginBottom: 16 }}
                            />
                            <Text
                                style={[
                                    styles.modalDescription,
                                    { color: theme.colors.text, textAlign: 'center' },
                                ]}
                            >
                                Send feedback request emails to all registered participants?
                            </Text>
                            <Text
                                style={[
                                    styles.modalSubtext,
                                    {
                                        color: theme.colors.textSecondary,
                                        textAlign: 'center',
                                        marginTop: 8,
                                    },
                                ]}
                            >
                                They will receive a beautiful email with a link to rate the event
                                and provide feedback.
                            </Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    {
                                        backgroundColor: theme.colors.surface,
                                        borderWidth: 1,
                                        borderColor: theme.colors.border,
                                        flex: 1,
                                    },
                                ]}
                                onPress={() => setFeedbackModalVisible(false)}
                            >
                                <Text
                                    style={[styles.modalButtonText, { color: theme.colors.text }]}
                                >
                                    Cancel
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    { backgroundColor: theme.colors.primary, flex: 1 },
                                ]}
                                onPress={handleSendFeedbackRequest}
                                disabled={sending}
                            >
                                {sending ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons
                                            name="send"
                                            size={16}
                                            color="#fff"
                                            style={{ marginRight: 6 }}
                                        />
                                        <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                                            Send Emails
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
        elevation: 2,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 22, fontWeight: '800' },
    headerSubtitle: { fontSize: 13, marginTop: 2 },
    scanBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statsContainer: { flexDirection: 'row', padding: 16, gap: 10 },
    statCard: { flex: 1, borderRadius: 14, overflow: 'hidden', elevation: 2 },
    statGradient: {
        padding: 14,
        alignItems: 'center',
        gap: 6,
        minHeight: 130,
        justifyContent: 'center',
    },
    statIconBox: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    statValue: { fontSize: 28, fontWeight: '800', lineHeight: 32 },
    statLabel: {
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        fontWeight: '700',
        textAlign: 'center',
    },
    statSubtitle: { fontSize: 10, marginTop: 4, textAlign: 'center' },
    section: { margin: 16, marginTop: 0, borderRadius: 16, padding: 16 },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    liveDotContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FF000020',
        alignItems: 'center',
        justifyContent: 'center',
    },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF0000' },
    sectionTitle: { fontSize: 17, fontWeight: '700' },
    countBadge: {
        backgroundColor: '#FF980020',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    countText: { fontSize: 14, fontWeight: '700' },
    checkInsList: { gap: 10 },
    checkInItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        gap: 12,
    },
    checkInAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { fontSize: 18, fontWeight: '700' },
    checkInInfo: { flex: 1, gap: 4 },
    checkInName: { fontSize: 15, fontWeight: '600' },
    checkInMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    checkInDetails: { fontSize: 12 },
    checkInTime: { alignItems: 'flex-end', gap: 6 },
    checkmarkBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#4CAF5020',
        alignItems: 'center',
        justifyContent: 'center',
    },
    timeText: { fontSize: 11 },
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyText: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
    analyticsCard: { margin: 16, marginTop: 0, padding: 16, borderRadius: 16 },
    analyticsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    analyticsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    analyticsTitle: { fontSize: 17, fontWeight: '700' },
    analyticsTotal: { fontSize: 12, fontWeight: '600' },
    analyticsItem: { marginBottom: 14 },
    analyticsItemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    analyticsLabel: { fontSize: 14, fontWeight: '600' },
    analyticsValue: { fontSize: 13 },
    analyticsBarBg: {
        height: 8,
        backgroundColor: 'rgba(0,0,0,0.08)',
        borderRadius: 4,
        overflow: 'hidden',
    },
    analyticsBarFill: { height: '100%', borderRadius: 4 },
    exportContainer: { margin: 16, marginTop: 0 },
    exportTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
    exportButtons: { flexDirection: 'row', gap: 12 },
    exportBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
    premiumBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        borderWidth: 1,
        borderColor: '#FFD700',
        borderRadius: 14, // Gold border
    },
    exportBtnText: { fontSize: 14, fontWeight: '700' },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: { borderRadius: 20, padding: 20, elevation: 5 },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    inputLabel: { fontSize: 14, marginBottom: 8, fontWeight: '600' },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        fontSize: 16,
    },
    sendBtn: {
        padding: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 10,
    },
    sendBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    // Feedback Modal Styles
    modalDescription: { fontSize: 16, fontWeight: '600', lineHeight: 24 },
    modalSubtext: { fontSize: 14, lineHeight: 20 },
    modalButton: {
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    modalButtonText: { fontSize: 15, fontWeight: '700' },
});
