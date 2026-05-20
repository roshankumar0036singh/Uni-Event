import PropTypes from 'prop-types';
import { BarChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import ScreenWrapper from '../components/ScreenWrapper';
import { useTheme } from '../lib/ThemeContext';
import { calculateRegion, getHeatmapData } from '../lib/heatmapService';

let MapView = null;
let Heatmap = null;
let Marker = null;
if (Platform.OS !== 'web') {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Heatmap = Maps.Heatmap;
    Marker = Maps.Marker;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Date range filter options ─────────────────────────────────────────────────
const DATE_FILTERS = [
    { label: 'All Time', value: 'all' },
    { label: 'This Year', value: 'year' },
    { label: 'Last 6 Months', value: '6m' },
    { label: 'Last Month', value: '1m' },
];

function getDateRange(filterValue) {
    const now = new Date();
    const endDate = now;

    switch (filterValue) {
        case 'year': {
            const startDate = new Date(now.getFullYear(), 0, 1); 
            return { startDate, endDate };
        }
        case '6m': {
            const startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() - 6);
            return { startDate, endDate };
        }
        case '1m': {
            const startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() - 1);
            return { startDate, endDate };
        }
        default:
            return { startDate: null, endDate: null };
    }
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function HeatmapScreen({ navigation }) {
    const { theme } = useTheme();
    const styles = useMemo(() => getStyles(theme), [theme]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [heatmapPoints, setHeatmapPoints] = useState([]);
    const [unmappedLocations, setUnmappedLocations] = useState([]);
    const [totalEvents, setTotalEvents] = useState(0);
    const [dateFilter, setDateFilter] = useState('all');

    // ── Fetch data ────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        try {
            setError(null);
            const { startDate, endDate } = getDateRange(dateFilter);
            const result = await getHeatmapData({ startDate, endDate });
            setHeatmapPoints(result.points);
            setUnmappedLocations(result.unmapped);
            setTotalEvents(result.totalEvents);
        } catch (err) {
            console.error('HeatmapScreen fetch error:', err);
            setError('Failed to load heatmap data. Check your connection.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [dateFilter]);

    useEffect(() => {
        setLoading(true);
        fetchData();
    }, [fetchData]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, [fetchData]);

    // ── Derived values ────────────────────────────────────────────────────────
    const mapRegion = useMemo(() => calculateRegion(heatmapPoints), [heatmapPoints]);

    const topLocations = heatmapPoints.slice(0, 10);

    const barChartData = useMemo(() => {
        const MAX_LABEL_LENGTH = 8;
        return {
            labels: topLocations.map(p =>
                p.locationName.length > MAX_LABEL_LENGTH
                    ? p.locationName.slice(0, MAX_LABEL_LENGTH) + '…'
                    : p.locationName,
            ),
            datasets: [{ data: topLocations.map(p => p.count) }],
        };
    }, [topLocations]);

    // ── Render states ─────────────────────────────────────────────────────────
    if (loading) {
        return (
            <ScreenWrapper>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                        Loading heatmap data...
                    </Text>
                </View>
            </ScreenWrapper>
        );
    }

    if (error) {
        return (
            <ScreenWrapper>
                <View style={styles.center}>
                    <Ionicons name="warning-outline" size={48} color={theme.colors.error} />
                    <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
                    <TouchableOpacity
                        style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]}
                        onPress={fetchData}
                    >
                        <Text style={styles.retryBtnText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </ScreenWrapper>
        );
    }

    // ── Main render ───────────────────────────────────────────────────────────
    return (
        <ScreenWrapper>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[theme.colors.primary]}
                        tintColor={theme.colors.primary}
                    />
                }
            >
                {/* ── Header ──────────────────────────────────────────────── */}
                <View style={styles.header}>
                    {navigation && (
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.backBtn}
                        >
                            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                        </TouchableOpacity>
                    )}
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.title, { color: theme.colors.text }]}>
                            Campus Heatmap
                        </Text>
                        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                            {totalEvents} events · {heatmapPoints.length} venues mapped
                        </Text>
                    </View>
                </View>

                {/* ── Date Range Filter ────────────────────────────────────── */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterRow}
                    contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
                >
                    {DATE_FILTERS.map(f => (
                        <TouchableOpacity
                            key={f.value}
                            style={[
                                styles.filterChip,
                                {
                                    backgroundColor:
                                        dateFilter === f.value
                                            ? theme.colors.primary
                                            : theme.colors.surface,
                                    borderColor:
                                        dateFilter === f.value
                                            ? theme.colors.primary
                                            : theme.colors.border,
                                },
                            ]}
                            onPress={() => setDateFilter(f.value)}
                        >
                            <Text
                                style={[
                                    styles.filterChipText,
                                    {
                                        color: dateFilter === f.value ? '#fff' : theme.colors.text,
                                    },
                                ]}
                            >
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* ── Empty State ──────────────────────────────────────────── */}
                {heatmapPoints.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="map-outline" size={64} color={theme.colors.textSecondary} />
                        <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                            No Data Yet
                        </Text>
                        <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                            No offline events found for this period, or venue names haven&apos;t
                            been mapped yet. Ask your admin to update campusLocations.js.
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* ── Platform: Native Map ─────────────────────────── */}
                        {Platform.OS !== 'web' && MapView && (
                            <View style={styles.mapContainer}>
                                <MapView
                                    style={styles.map}
                                    region={mapRegion}
                                    mapType="satellite"
                                    showsUserLocation
                                    showsCompass
                                    showsScale
                                >
                                    {/* Heatmap layer */}
                                    {Heatmap && (
                                        <Heatmap
                                            points={heatmapPoints.map(p => ({
                                                latitude: p.lat,
                                                longitude: p.lng,
                                                weight: p.weight,
                                            }))}
                                            radius={40}
                                            opacity={0.8}
                                            gradient={{
                                                colors: ['#00ff00', '#ffff00', '#ff0000'],
                                                startPoints: [0.1, 0.5, 1.0],
                                                colorMapSize: 256,
                                            }}
                                        />
                                    )}

                                    {/* Markers with count labels */}
                                    {Marker &&
                                        heatmapPoints.map((p, idx) => (
                                            <Marker
                                                key={`marker-${idx}`}
                                                coordinate={{ latitude: p.lat, longitude: p.lng }}
                                                title={p.locationName}
                                                description={`${p.count} event${p.count !== 1 ? 's' : ''}`}
                                                pinColor={theme.colors.primary}
                                            />
                                        ))}
                                </MapView>
                            </View>
                        )}

                        {/* ── Platform: Web Bar Chart ──────────────────────── */}
                        {Platform.OS === 'web' && topLocations.length > 0 && (
                            <View
                                style={[
                                    styles.chartContainer,
                                    { backgroundColor: theme.colors.surface },
                                ]}
                            >
                                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                                    Top Venues by Event Count
                                </Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <BarChart
                                        data={barChartData}
                                        width={Math.max(
                                            topLocations.length * 70,
                                            SCREEN_WIDTH - 40,
                                        )}
                                        height={240}
                                        yAxisLabel=""
                                        yAxisSuffix=""
                                        fromZero
                                        showValuesOnTopOfBars
                                        chartConfig={{
                                            backgroundGradientFrom: theme.colors.surface,
                                            backgroundGradientTo: theme.colors.surface,
                                            color: (opacity = 1) =>
                                                `rgba(255, 183, 77, ${opacity})`, // #FFB74D
                                            labelColor: () => theme.colors.textSecondary,
                                            barPercentage: 0.7,
                                            barRadius: 4,
                                            decimalPlaces: 0,
                                            propsForLabels: { fontSize: 11 },
                                        }}
                                        style={{ borderRadius: 12 }}
                                    />
                                </ScrollView>
                                <Text
                                    style={[styles.webNote, { color: theme.colors.textSecondary }]}
                                >
                                    💡 For interactive maps, open this on the mobile app.
                                </Text>
                            </View>
                        )}

                        {/* ── Rankings List ────────────────────────────────── */}
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                                Venue Rankings
                            </Text>
                            {heatmapPoints.map((point, index) => (
                                <VenueRow
                                    key={`venue-${index}`}
                                    rank={index + 1}
                                    point={point}
                                    maxCount={heatmapPoints[0].count}
                                    theme={theme}
                                    styles={styles}
                                />
                            ))}
                        </View>

                        {/* ── Unmapped Locations Warning ───────────────────── */}
                        {unmappedLocations.length > 0 && (
                            <View
                                style={[
                                    styles.unmappedContainer,
                                    { backgroundColor: theme.colors.warning + '20' },
                                ]}
                            >
                                <Ionicons
                                    name="warning-outline"
                                    size={20}
                                    color={theme.colors.warning}
                                />
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={[
                                            styles.unmappedTitle,
                                            { color: theme.colors.warning },
                                        ]}
                                    >
                                        {unmappedLocations.length} location
                                        {unmappedLocations.length !== 1 ? 's' : ''} not mapped yet
                                    </Text>
                                    <Text
                                        style={[
                                            styles.unmappedSubtitle,
                                            { color: theme.colors.textSecondary },
                                        ]}
                                    >
                                        {unmappedLocations.map(u => u.locationName).join(', ')}
                                        {'\n'}Add these to campusLocations.js to include them.
                                    </Text>
                                </View>
                            </View>
                        )}
                    </>
                )}

                <View style={{ height: 80 }} />
            </ScrollView>
        </ScreenWrapper>
    );
}

// ── Venue Row Sub-component ───────────────────────────────────────────────────
function VenueRow({ rank, point, maxCount, theme, styles }) {
    const barWidth = maxCount > 0 ? (point.count / maxCount) * 100 : 0;
    const isTop3 = rank <= 3;

    const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32']; // gold, silver, bronze
    const rankColor = isTop3 ? rankColors[rank - 1] : theme.colors.textSecondary;

    return (
        <View style={[styles.venueRow, { backgroundColor: theme.colors.surface }]}>
            {/* Rank badge */}
            <View style={[styles.rankBadge, { borderColor: rankColor }]}>
                <Text style={[styles.rankText, { color: rankColor }]}>{rank}</Text>
            </View>

            {/* Info */}
            <View style={{ flex: 1 }}>
                <View style={styles.venueRowTop}>
                    <Text
                        style={[styles.venueName, { color: theme.colors.text }]}
                        numberOfLines={1}
                    >
                        {point.locationName}
                    </Text>
                    <Text style={[styles.venueCount, { color: theme.colors.primary }]}>
                        {point.count} event{point.count !== 1 ? 's' : ''}
                    </Text>
                </View>
                {/* Progress bar */}
                <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
                    <View
                        style={[
                            styles.progressFill,
                            {
                                width: `${barWidth}%`,
                                backgroundColor: theme.colors.primary,
                            },
                        ]}
                    />
                </View>
            </View>
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const getStyles = theme =>
    StyleSheet.create({
        scrollContent: {
            paddingBottom: 40,
        },
        center: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 40,
            gap: 16,
        },
        loadingText: {
            fontSize: 14,
            marginTop: 12,
        },
        errorText: {
            fontSize: 16,
            textAlign: 'center',
            marginTop: 12,
        },
        retryBtn: {
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 8,
            marginTop: 8,
        },
        retryBtnText: {
            color: '#fff',
            fontWeight: 'bold',
            fontSize: 15,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 8,
            gap: 12,
        },
        backBtn: {
            padding: 4,
        },
        title: {
            fontSize: 22,
            fontWeight: 'bold',
        },
        subtitle: {
            fontSize: 13,
            marginTop: 2,
        },
        filterRow: {
            marginVertical: 12,
        },
        filterChip: {
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 20,
            borderWidth: 1,
            marginRight: 8,
        },
        filterChipText: {
            fontSize: 13,
            fontWeight: '600',
        },
        emptyState: {
            alignItems: 'center',
            paddingVertical: 60,
            paddingHorizontal: 32,
            gap: 12,
        },
        emptyTitle: {
            fontSize: 20,
            fontWeight: 'bold',
        },
        emptySubtitle: {
            fontSize: 14,
            textAlign: 'center',
            lineHeight: 20,
        },
        mapContainer: {
            marginHorizontal: 16,
            borderRadius: 16,
            overflow: 'hidden',
            height: 320,
            marginBottom: 16,
        },
        map: {
            flex: 1,
        },
        chartContainer: {
            marginHorizontal: 16,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
        },
        webNote: {
            fontSize: 12,
            textAlign: 'center',
            marginTop: 8,
        },
        section: {
            marginHorizontal: 16,
            marginBottom: 16,
            gap: 8,
        },
        sectionTitle: {
            fontSize: 16,
            fontWeight: '700',
            marginBottom: 4,
        },
        venueRow: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 14,
            borderRadius: 12,
            gap: 12,
            marginBottom: 8,
        },
        rankBadge: {
            width: 32,
            height: 32,
            borderRadius: 16,
            borderWidth: 2,
            justifyContent: 'center',
            alignItems: 'center',
        },
        rankText: {
            fontSize: 13,
            fontWeight: 'bold',
        },
        venueRowTop: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
        },
        venueName: {
            fontSize: 14,
            fontWeight: '600',
            flex: 1,
        },
        venueCount: {
            fontSize: 13,
            fontWeight: 'bold',
            marginLeft: 8,
        },
        progressTrack: {
            height: 6,
            borderRadius: 3,
            overflow: 'hidden',
        },
        progressFill: {
            height: '100%',
            borderRadius: 3,
        },
        unmappedContainer: {
            marginHorizontal: 16,
            padding: 14,
            borderRadius: 12,
            flexDirection: 'row',
            gap: 10,
            marginBottom: 8,
        },
        unmappedTitle: {
            fontWeight: '700',
            fontSize: 14,
            marginBottom: 4,
        },
        unmappedSubtitle: {
            fontSize: 12,
            lineHeight: 18,
        },
    });
HeatmapScreen.propTypes = {
    navigation: PropTypes.object,
};
