import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { resolveCoordinate } from './campusLocations';

/**
 * Aggregate events from Firestore into heatmap data points.
 *
 * @param {Object} options
 * @param {Date|null} options.startDate - Filter events after this date (null = no filter)
 * @param {Date|null} options.endDate   - Filter events before this date (null = no filter)
 * @returns {Promise<Array<{lat:number, lng:number, weight:number, locationName:string, count:number}>>}
 */
export async function getHeatmapData({ startDate = null, endDate = null } = {}) {
    try {
        // ── 1. Fetch events ──────────────────────────────────────────────────
        const eventsRef = collection(db, 'events');

        // Build query — date filters are optional
        let eventsQuery = eventsRef;
        if (startDate && endDate) {
            eventsQuery = query(
                eventsRef,
                where('startAt', '>=', startDate.toISOString()),
                where('startAt', '<=', endDate.toISOString()),
                orderBy('startAt', 'asc'),
            );
        } else if (startDate) {
            eventsQuery = query(
                eventsRef,
                where('startAt', '>=', startDate.toISOString()),
                orderBy('startAt', 'asc'),
            );
        }

        const snapshot = await getDocs(eventsQuery);

        // ── 2. Group by location string ──────────────────────────────────────
        // locationCounts: { "Auditorium": 12, "Lab 3": 5, ... }
        const locationCounts = {};

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            // Skip online events (no physical location)
            if (data.eventMode === 'online') return;

            const loc = data.location;
            if (!loc || typeof loc !== 'string' || loc.trim() === '') return;

            const key = loc.trim();
            locationCounts[key] = (locationCounts[key] || 0) + 1;
        });

        // ── 3. Resolve coordinates ───────────────────────────────────────────
        const heatmapPoints = [];
        const unmappedLocations = [];

        Object.entries(locationCounts).forEach(([locationName, count]) => {
            const coords = resolveCoordinate(locationName);

            if (!coords) {
                // Track unmapped locations so admin can add them later
                unmappedLocations.push({ locationName, count });
                return;
            }

            heatmapPoints.push({
                lat: coords.lat,
                lng: coords.lng,
                weight: count, // used by heatmap library
                locationName,
                count,
            });
        });

        if (unmappedLocations.length > 0) {
            console.warn(
                '[HeatmapService] Unmapped locations (add to campusLocations.js):',
                unmappedLocations,
            );
        }

        // ── 4. Sort by count descending (most popular first) ─────────────────
        heatmapPoints.sort((a, b) => b.count - a.count);

        return {
            points: heatmapPoints,
            unmapped: unmappedLocations,
            totalEvents: snapshot.size,
        };
    } catch (error) {
        console.error('[HeatmapService] Error fetching heatmap data:', error);
        throw error;
    }
}

/**
 * Calculate a bounded region that fits all heatmap points,
 * with optional padding. Returns a region object compatible
 * with react-native-maps MapView's `region` prop.
 *
 * Falls back to a default campus center if no points exist.
 *
 * @param {Array} points - Array of { lat, lng } objects
 * @param {number} paddingFactor - Extra space around the bounds (default 0.3)
 * @returns {{ latitude, longitude, latitudeDelta, longitudeDelta }}
 */
export function calculateRegion(points, paddingFactor = 0.3) {
    // Default campus center — update these to your actual campus center
    const DEFAULT_REGION = {
        latitude: 23.5504,
        longitude: 87.2933,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
    };

    if (!points || points.length === 0) return DEFAULT_REGION;

    const lats = points.map(p => p.lat);
    const lngs = points.map(p => p.lng);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latDelta = maxLat - minLat + paddingFactor * (maxLat - minLat || 0.005);
    const lngDelta = maxLng - minLng + paddingFactor * (maxLng - minLng || 0.005);

    return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max(latDelta, 0.005),
        longitudeDelta: Math.max(lngDelta, 0.005),
    };
}
