import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import LiquidPullToRefresh from '../components/LiquidPullToRefresh';
import ScreenWrapper from '../components/ScreenWrapper';
import usePullToRefresh from '../hooks/usePullToRefresh';
import { useTheme } from '../lib/ThemeContext';
import { fetchHeatmapData, getDensityColor, getDensityOpacity } from '../lib/eventHeatmapData';

let MapView = null;
let Circle = null;
if (Platform.OS !== 'web') {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Circle = Maps.Circle;
}

const DENSITY_LABELS = [
    { label: 'Highest', minRatio: 0.7 },
    { label: 'High', minRatio: 0.4 },
    { label: 'Medium', minRatio: 0.2 },
    { label: 'Low', minRatio: 0 },
];

export default function LocationHeatmapScreen() {
    const { theme } = useTheme();
    const styles = useStyles(theme);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [heatmapData, setHeatmapData] = useState({
        points: [],
        clusters: [],
        maxWeight: 1,
        total: 0,
    });
    const showMap = Platform.OS !== 'web';

    const loadData = useCallback(async () => {
        const data = await fetchHeatmapData();
        setHeatmapData(data);
        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const { pullDistance, handleScroll, handleScrollEndDrag } = usePullToRefresh(refreshing, () => {
        setRefreshing(true);
        loadData();
    });

    const { clusters, maxWeight, total } = heatmapData;

    const renderClusterItem = ({ item, index }) => {
        const color = getDensityColor(item.weight, maxWeight);
        return (
            <View style={styles.venueCard}>
                <View style={[styles.rankBadge, { backgroundColor: color }]}>
                    <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <View style={styles.venueInfo}>
                    <Text style={styles.venueTitle}>
                        {item.events[0]?.location || `Cluster ${index + 1}`}
                    </Text>
                    <Text style={styles.venueSubtitle}>
                        {item.weight} event{item.weight === 1 ? '' : 's'} ·{' '}
                        {new Set(item.events.map(e => e.category).filter(Boolean)).size} categories
                    </Text>
                    <View style={styles.categoryRow}>
                        {[...new Set(item.events.map(e => e.category).filter(Boolean))]
                            .slice(0, 3)
                            .map(cat => (
                                <View key={cat} style={[styles.miniChip, { borderColor: color }]}>
                                    <Text style={[styles.miniChipText, { color }]}>{cat}</Text>
                                </View>
                            ))}
                    </View>
                </View>
                <View style={styles.densityBar}>
                    <View
                        style={[
                            styles.densityFill,
                            {
                                backgroundColor: color,
                                width: `${(item.weight / maxWeight) * 100}%`,
                            },
                        ]}
                    />
                </View>
            </View>
        );
    };

    const renderMap = () => {
        if (!MapView || !Circle || clusters.length === 0) return null;

        const centerLat = clusters.reduce((s, c) => s + c.latitude, 0) / clusters.length;
        const centerLng = clusters.reduce((s, c) => s + c.longitude, 0) / clusters.length;

        return (
            <View style={styles.mapContainer}>
                <MapView
                    style={styles.map}
                    initialRegion={{
                        latitude: centerLat || 28.7041,
                        longitude: centerLng || 77.1025,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                    }}
                >
                    {clusters.map(cluster => {
                        const color = getDensityColor(cluster.weight, maxWeight);
                        const opacity = getDensityOpacity(cluster.weight, maxWeight);
                        const radius = Math.max(
                            200,
                            Math.min(800, 200 + (cluster.weight / maxWeight) * 600),
                        );
                        return (
                            <Circle
                                key={`${cluster.latitude},${cluster.longitude}`}
                                center={{
                                    latitude: cluster.latitude,
                                    longitude: cluster.longitude,
                                }}
                                radius={radius}
                                strokeWidth={0}
                                fillColor={
                                    color +
                                    Math.round(opacity * 255)
                                        .toString(16)
                                        .padStart(2, '0')
                                }
                            />
                        );
                    })}
                </MapView>
                <View style={styles.mapLegend}>
                    {DENSITY_LABELS.map(d => (
                        <View key={d.label} style={styles.legendRow}>
                            <View
                                style={[
                                    styles.legendDot,
                                    { backgroundColor: getDensityColor(d.minRatio + 0.1, 1) },
                                ]}
                            />
                            <Text style={styles.legendText}>{d.label}</Text>
                        </View>
                    ))}
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <ScreenWrapper>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={styles.loadingText}>Loading heatmap data...</Text>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                onScroll={handleScroll}
                onScrollEndDrag={handleScrollEndDrag}
                scrollEventThrottle={16}
            >
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Event Location Heatmap</Text>
                    <Text style={styles.headerSubtitle}>
                        {total} event{total === 1 ? '' : 's'} at {clusters.length} location
                        {clusters.length === 1 ? '' : 's'}
                    </Text>
                </View>

                {MapView && Circle && clusters.length > 0 && showMap && renderMap()}

                {(!MapView || !showMap) && (
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryRow}>
                            <Ionicons name="location" size={20} color={theme.colors.primary} />
                            <Text style={styles.summaryText}>
                                {total} events mapped across {clusters.length} venue clusters
                            </Text>
                        </View>
                        <View style={styles.legendRow}>
                            {DENSITY_LABELS.map(d => (
                                <View key={d.label} style={styles.legendItem}>
                                    <View
                                        style={[
                                            styles.legendSwatch,
                                            {
                                                backgroundColor: getDensityColor(
                                                    d.minRatio + 0.1,
                                                    1,
                                                ),
                                            },
                                        ]}
                                    />
                                    <Text style={styles.legendLabel}>{d.label}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {clusters.length > 0 ? (
                    <View style={styles.venueList}>
                        <Text style={styles.sectionTitle}>Top Venues</Text>
                        {clusters.map((cluster, idx) =>
                            renderClusterItem({ item: cluster, index: idx }),
                        )}
                    </View>
                ) : (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="map-outline" size={64} color={theme.colors.textSecondary} />
                        <Text style={styles.emptyText}>
                            No events with location coordinates found.
                        </Text>
                        <Text style={styles.emptySubtext}>
                            Events need a pinned map location to appear on the heatmap.
                        </Text>
                    </View>
                )}
            </ScrollView>
            <LiquidPullToRefresh
                pullDistance={pullDistance}
                isRefreshing={refreshing}
                color={theme.colors.primary}
            />
        </ScreenWrapper>
    );
}

const useStyles = theme =>
    StyleSheet.create({
        scrollContent: { paddingBottom: 40 },
        centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
        loadingText: { marginTop: 12, fontSize: 14, color: theme.colors.textSecondary },
        header: { padding: 20, paddingBottom: 12 },
        headerTitle: { fontSize: 24, fontWeight: '800', color: theme.colors.text },
        headerSubtitle: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
        summaryCard: {
            marginHorizontal: 20,
            backgroundColor: theme.colors.surface,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
        },
        summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
        summaryText: { fontSize: 14, color: theme.colors.text, flex: 1 },
        legendRow: { flexDirection: 'row', gap: 16 },
        legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
        legendSwatch: { width: 12, height: 12, borderRadius: 3 },
        legendLabel: { fontSize: 11, color: theme.colors.textSecondary },
        mapContainer: {
            marginHorizontal: 20,
            borderRadius: 16,
            overflow: 'hidden',
            marginBottom: 16,
        },
        map: { height: 300 },
        mapLegend: {
            position: 'absolute',
            bottom: 12,
            right: 12,
            backgroundColor: 'rgba(0,0,0,0.7)',
            borderRadius: 8,
            padding: 8,
            gap: 4,
        },
        legendDot: { width: 10, height: 10, borderRadius: 5 },
        legendText: { color: '#fff', fontSize: 10, marginLeft: 4 },
        venueList: { paddingHorizontal: 20 },
        sectionTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: 12,
        },
        venueCard: {
            backgroundColor: theme.colors.surface,
            borderRadius: 14,
            padding: 14,
            marginBottom: 12,
        },
        rankBadge: {
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
        },
        rankText: { color: '#fff', fontWeight: '800', fontSize: 13 },
        venueInfo: { marginBottom: 8 },
        venueTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
        venueSubtitle: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
        categoryRow: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
        miniChip: {
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 8,
            borderWidth: 1,
        },
        miniChipText: { fontSize: 10, fontWeight: '600' },
        densityBar: {
            height: 4,
            backgroundColor: theme.colors.border,
            borderRadius: 2,
            overflow: 'hidden',
        },
        densityFill: { height: '100%', borderRadius: 2 },
        emptyContainer: { alignItems: 'center', marginTop: 60, padding: 20 },
        emptyText: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.colors.textSecondary,
            marginTop: 16,
        },
        emptySubtext: {
            fontSize: 13,
            color: theme.colors.textSecondary,
            marginTop: 8,
            textAlign: 'center',
        },
    });
