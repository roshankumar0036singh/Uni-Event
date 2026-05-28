import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebaseConfig';
import logger from './logger';

const EARTH_RADIUS_KM = 6371;

const toRad = deg => (deg * Math.PI) / 180;

const haversineDistance = (p1, p2) => {
    const dLat = toRad(p2.latitude - p1.latitude);
    const dLng = toRad(p2.longitude - p1.longitude);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(p1.latitude)) * Math.cos(toRad(p2.latitude)) * Math.sin(dLng / 2) ** 2;
    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const DEFAULT_CLUSTER_RADIUS_KM = 0.3;

export const clusterPoints = (points, radiusKm = DEFAULT_CLUSTER_RADIUS_KM) => {
    if (!points || points.length === 0) return [];

    const clusters = [];
    const assigned = new Set();

    for (let i = 0; i < points.length; i++) {
        if (assigned.has(i)) continue;

        const group = { latitude: points[i].latitude, longitude: points[i].longitude, events: [] };

        for (let j = i; j < points.length; j++) {
            if (assigned.has(j)) continue;
            const dist = haversineDistance(points[i], points[j]);
            if (dist <= radiusKm) {
                group.events.push(points[j]);
                assigned.add(j);
            }
        }

        const avgLat = group.events.reduce((s, e) => s + e.latitude, 0) / group.events.length;
        const avgLng = group.events.reduce((s, e) => s + e.longitude, 0) / group.events.length;

        clusters.push({
            latitude: avgLat,
            longitude: avgLng,
            weight: group.events.length,
            events: group.events,
        });
    }

    return clusters.sort((a, b) => b.weight - a.weight);
};

export const fetchHeatmapData = async () => {
    try {
        const eventsRef = collection(db, 'events');
        const q = query(eventsRef, where('coordinates', '!=', null));
        const snapshot = await getDocs(q);
        const points = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            const coords = data.coordinates;
            if (
                coords &&
                typeof coords === 'object' &&
                Number.isFinite(coords.latitude) &&
                Number.isFinite(coords.longitude)
            ) {
                points.push({
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    title: data.title || 'Untitled',
                    category: data.category || 'General',
                    location: data.location || '',
                    eventId: doc.id,
                });
            }
        });

        const clusters = clusterPoints(points);
        const maxWeight = clusters.length > 0 ? Math.max(...clusters.map(c => c.weight)) : 1;

        return { points, clusters, maxWeight, total: points.length };
    } catch (error) {
        logger.error('Failed to fetch heatmap data:', error);
        return { points: [], clusters: [], maxWeight: 1, total: 0 };
    }
};

export const getDensityColor = (weight, maxWeight) => {
    const ratio = maxWeight > 0 ? weight / maxWeight : 0;
    if (ratio >= 0.7) return '#dc2626';
    if (ratio >= 0.4) return '#ea580c';
    if (ratio >= 0.2) return '#ca8a04';
    return '#16a34a';
};

export const getDensityOpacity = (weight, maxWeight) => {
    const ratio = maxWeight > 0 ? weight / maxWeight : 0;
    return Math.max(0.15, Math.min(0.5, ratio));
};
