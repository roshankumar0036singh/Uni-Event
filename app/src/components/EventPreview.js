import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import PropTypes from 'prop-types';
import React, { useMemo } from 'react';
import {
    ImageBackground,
    Modal,
    Platform,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatEventDate, formatEventTime } from '../lib/formatEventDate';
import { useTheme } from '../lib/ThemeContext';
import { getStyles as getEventDetailStyles } from '../screens/EventDetail';

const DEFAULT_BANNERS = [
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1000&q=80',
];

export default function EventPreview({ visible, onClose, eventData, organizerName }) {
    const { theme } = useTheme();
    const styles = useMemo(() => getStyles(theme), [theme]);

    const bannerUrl = useMemo(() => {
        if (eventData.imageUri) return eventData.imageUri;
        return DEFAULT_BANNERS[0];
    }, [eventData.imageUri]);

    const formattedStart = useMemo(() => {
        if (!eventData.startDate) return '';
        try {
            return `${formatEventDate(eventData.startDate)} at ${formatEventTime(eventData.startDate)}`;
        } catch {
            return String(eventData.startDate);
        }
    }, [eventData.startDate]);

    const formattedEnd = useMemo(() => {
        if (!eventData.endDate) return '';
        try {
            return `${formatEventDate(eventData.endDate)} at ${formatEventTime(eventData.endDate)}`;
        } catch {
            return String(eventData.endDate);
        }
    }, [eventData.endDate]);

    const priceLabel = useMemo(() => {
        if (!eventData.isPaid) return 'Free';
        const parsedPrice = Number.parseFloat(eventData.price);
        if (Number.isNaN(parsedPrice) || parsedPrice <= 0) return 'Free';
        return `\u20B9${parsedPrice}`;
    }, [eventData.isPaid, eventData.price]);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            onRequestClose={onClose}
            presentationStyle="overFullScreen"
        >
            <SafeAreaView style={styles.safeContainer} edges={['bottom']}>
                {/* Floating Preview Badge / Header */}
                <View style={styles.previewHeaderBanner}>
                    <Text style={styles.previewHeaderTitle}>Preview Mode</Text>
                    <Text style={styles.previewHeaderSubtitle}>
                        This is how your event will look to others
                    </Text>
                </View>

                <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                    {/* Immersive Header Image */}
                    <ImageBackground source={{ uri: bannerUrl }} style={styles.headerImage}>
                        <LinearGradient
                            colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.8)']}
                            style={styles.headerGradient}
                        >
                            <View style={styles.headerSafe}>
                                <TouchableOpacity style={styles.backButton} onPress={onClose}>
                                    <Ionicons name="arrow-back" size={24} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </ImageBackground>

                    {/* Content Sheet */}
                    <View style={styles.contentSheet}>
                        {/* Badges Row */}
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
                                    {eventData.category || 'General'}
                                </Text>
                            </View>

                            <View
                                style={[
                                    styles.priceBadge,
                                    { backgroundColor: eventData.isPaid ? '#F59E0B' : '#10B981' },
                                ]}
                            >
                                <Ionicons
                                    name={eventData.isPaid ? 'cash' : 'gift'}
                                    size={14}
                                    color="#fff"
                                />
                                <Text style={styles.priceText}>{priceLabel}</Text>
                            </View>
                        </View>

                        {/* Title */}
                        <Text style={[styles.eventTitle, { color: theme.colors.text }]}>
                            {eventData.title || 'Untitled Event'}
                        </Text>

                        {/* Organizer Profile Summary */}
                        <View style={styles.hostButton}>
                            <View
                                style={[
                                    styles.hostAvatar,
                                    { backgroundColor: theme.colors.primary + '20' },
                                ]}
                            >
                                <Text
                                    style={[styles.hostAvatarText, { color: theme.colors.primary }]}
                                >
                                    {(organizerName || 'O').charAt(0).toUpperCase()}
                                </Text>
                            </View>
                            <View>
                                <Text
                                    style={[
                                        styles.hostLabel,
                                        { color: theme.colors.textSecondary },
                                    ]}
                                >
                                    Hosted by
                                </Text>
                                <Text style={[styles.hostName, { color: theme.colors.text }]}>
                                    {organizerName || 'Club Organizer'}
                                </Text>
                            </View>
                        </View>

                        {/* Details Card */}
                        <View
                            style={[
                                styles.detailsCard,
                                {
                                    backgroundColor: theme.colors.surface,
                                    borderColor: theme.colors.border,
                                    borderWidth: 1,
                                },
                            ]}
                        >
                            {/* Date Detail */}
                            <View style={styles.detailRow}>
                                <View
                                    style={[
                                        styles.detailIconContainer,
                                        { backgroundColor: theme.colors.primary + '15' },
                                    ]}
                                >
                                    <Ionicons
                                        name="calendar"
                                        size={22}
                                        color={theme.colors.primary}
                                    />
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
                                    <Text
                                        style={[styles.detailValue, { color: theme.colors.text }]}
                                    >
                                        {formattedStart || 'Not specified'}
                                    </Text>
                                    {formattedEnd && (
                                        <Text
                                            style={[
                                                styles.detailSubValue,
                                                { color: theme.colors.textSecondary },
                                            ]}
                                        >
                                            Ends: {formattedEnd}
                                        </Text>
                                    )}
                                </View>
                            </View>

                            <View
                                style={[
                                    styles.detailDivider,
                                    { backgroundColor: theme.colors.border },
                                ]}
                            />

                            {/* Location Detail */}
                            <View style={styles.detailRow}>
                                <View
                                    style={[
                                        styles.detailIconContainer,
                                        { backgroundColor: theme.colors.primary + '15' },
                                    ]}
                                >
                                    <Ionicons
                                        name={eventData.eventMode === 'online' ? 'videocam' : 'pin'}
                                        size={22}
                                        color={theme.colors.primary}
                                    />
                                </View>
                                <View style={styles.detailContent}>
                                    <Text
                                        style={[
                                            styles.detailLabel,
                                            { color: theme.colors.textSecondary },
                                        ]}
                                    >
                                        {eventData.eventMode === 'online'
                                            ? 'Online Event'
                                            : 'Venue'}
                                    </Text>
                                    <Text
                                        style={[styles.detailValue, { color: theme.colors.text }]}
                                    >
                                        {eventData.eventMode === 'online'
                                            ? eventData.meetLink || 'Google Meet'
                                            : eventData.location || 'Not specified'}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* About Section */}
                        <View style={styles.aboutSection}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                                About Event
                            </Text>
                            <Text style={[styles.description, { color: theme.colors.text }]}>
                                {eventData.description || 'No description provided.'}
                            </Text>
                        </View>

                        {/* Tags Section */}
                        {eventData.tags && eventData.tags.length > 0 && (
                            <View style={styles.aboutSection}>
                                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                                    Tags
                                </Text>
                                <View style={styles.tagsContainer}>
                                    {eventData.tags.map(tag => (
                                        <View
                                            key={tag}
                                            style={[
                                                styles.tagChip,
                                                {
                                                    backgroundColor: theme.colors.surface,
                                                    borderColor: theme.colors.border,
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.tagText,
                                                    { color: theme.colors.textSecondary },
                                                ]}
                                            >
                                                #{tag}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Target Audience Section */}
                        <View style={styles.aboutSection}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                                Target Audience
                            </Text>
                            <View style={styles.audienceContainer}>
                                <Text
                                    style={[
                                        styles.audienceLabel,
                                        { color: theme.colors.textSecondary },
                                    ]}
                                >
                                    Branches:{' '}
                                    <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
                                        {eventData.targetBranches &&
                                        eventData.targetBranches.length > 0
                                            ? eventData.targetBranches.join(', ')
                                            : 'All'}
                                    </Text>
                                </Text>
                                <Text
                                    style={[
                                        styles.audienceLabel,
                                        { color: theme.colors.textSecondary, marginTop: 4 },
                                    ]}
                                >
                                    Years:{' '}
                                    <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
                                        {eventData.targetYears && eventData.targetYears.length > 0
                                            ? eventData.targetYears
                                                  .map(y => {
                                                      if (y === 1) return '1st Year';
                                                      if (y === 2) return '2nd Year';
                                                      if (y === 3) return '3rd Year';
                                                      if (y === 4) return '4th Year';
                                                      return `${y}th Year`;
                                                  })
                                                  .join(', ')
                                            : 'All'}
                                    </Text>
                                </Text>
                            </View>
                        </View>

                        {/* Bottom Buffer */}
                        <View style={{ height: 100 }} />
                    </View>
                </ScrollView>

                {/* Sticky Close Button in Preview */}
                <View
                    style={[
                        styles.fabContainer,
                        {
                            backgroundColor: theme.colors.background,
                            borderTopColor: theme.colors.border,
                        },
                    ]}
                >
                    <View style={styles.fabSubInfo}>
                        <Text style={styles.fabLabel}>Status</Text>
                        <Text style={[styles.fabValue, { color: theme.colors.text }]}>
                            Draft Preview
                        </Text>
                    </View>
                    <TouchableOpacity style={styles.primaryBtn} onPress={onClose}>
                        <Text style={styles.primaryBtnText}>Close Preview</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

EventPreview.propTypes = {
    visible: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    organizerName: PropTypes.string,
    eventData: PropTypes.shape({
        title: PropTypes.string,
        description: PropTypes.string,
        tags: PropTypes.arrayOf(PropTypes.string),
        category: PropTypes.string,
        location: PropTypes.string,
        startDate: PropTypes.instanceOf(Date),
        endDate: PropTypes.instanceOf(Date),
        eventMode: PropTypes.string,
        meetLink: PropTypes.string,
        isPaid: PropTypes.bool,
        price: PropTypes.string,
        imageUri: PropTypes.string,
        targetBranches: PropTypes.arrayOf(PropTypes.string),
        targetYears: PropTypes.arrayOf(PropTypes.number),
    }).isRequired,
};

const getStyles = theme => {
    const detailStyles = getEventDetailStyles(theme);
    return {
        ...detailStyles,
        safeContainer: {
            flex: 1,
            backgroundColor: theme.colors.background,
        },
        previewHeaderBanner: {
            backgroundColor: '#FF6B35',
            paddingVertical: 10,
            paddingHorizontal: 20,
            alignItems: 'center',
            justifyContent: 'center',
            ...Platform.select({
                ios: {
                    paddingTop: 14,
                },
            }),
        },
        previewHeaderTitle: {
            color: '#fff',
            fontWeight: 'bold',
            fontSize: 16,
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        previewHeaderSubtitle: {
            color: 'rgba(255,255,255,0.85)',
            fontSize: 11,
            marginTop: 2,
        },
    };
};
