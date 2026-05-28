import { clusterPoints, getDensityColor, getDensityOpacity } from '../eventHeatmapData';

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    getDocs: jest.fn(),
}));

jest.mock('../firebaseConfig', () => ({
    db: {},
}));

jest.mock('../logger', () => ({
    error: jest.fn(),
}));

describe('clusterPoints', () => {
    it('returns empty array for no points', () => {
        expect(clusterPoints([])).toEqual([]);
    });

    it('returns empty array for null input', () => {
        expect(clusterPoints(null)).toEqual([]);
    });

    it('clusters nearby points together', () => {
        const points = [
            { latitude: 28.7041, longitude: 77.1025 },
            { latitude: 28.7042, longitude: 77.1026 },
            { latitude: 28.7043, longitude: 77.1024 },
            { latitude: 28.71, longitude: 77.11 },
        ];
        const clusters = clusterPoints(points, 0.5);
        expect(clusters.length).toBe(2);
        const larger = clusters.find(c => c.weight === 3);
        const smaller = clusters.find(c => c.weight === 1);
        expect(larger).toBeDefined();
        expect(smaller).toBeDefined();
    });

    it('returns each point as its own cluster when far apart', () => {
        const points = [
            { latitude: 28.7041, longitude: 77.1025 },
            { latitude: 19.076, longitude: 72.8777 },
        ];
        const clusters = clusterPoints(points, 0.3);
        expect(clusters.length).toBe(2);
        expect(clusters[0].weight).toBe(1);
        expect(clusters[1].weight).toBe(1);
    });

    it('sorts clusters by weight descending', () => {
        const points = [
            { latitude: 28.7041, longitude: 77.1025 },
            { latitude: 28.7042, longitude: 77.1026 },
            { latitude: 19.076, longitude: 72.8777 },
        ];
        const clusters = clusterPoints(points, 0.5);
        expect(clusters[0].weight).toBe(2);
        expect(clusters[1].weight).toBe(1);
    });

    it('preserves event data in clusters', () => {
        const points = [
            { latitude: 28.7041, longitude: 77.1025, title: 'Event A' },
            { latitude: 28.7042, longitude: 77.1026, title: 'Event B' },
        ];
        const clusters = clusterPoints(points, 0.5);
        expect(clusters[0].events.length).toBe(2);
        expect(clusters[0].events[0].title).toBe('Event A');
        expect(clusters[0].events[1].title).toBe('Event B');
    });

    it('calculates average coordinates for cluster center', () => {
        const points = [
            { latitude: 28.7041, longitude: 77.1025 },
            { latitude: 28.7043, longitude: 77.1027 },
        ];
        const clusters = clusterPoints(points, 0.5);
        expect(clusters[0].latitude).toBeCloseTo(28.7042, 4);
        expect(clusters[0].longitude).toBeCloseTo(77.1026, 4);
    });
});

describe('getDensityColor', () => {
    it('returns red for high density', () => {
        expect(getDensityColor(7, 10)).toBe('#dc2626');
        expect(getDensityColor(10, 10)).toBe('#dc2626');
    });

    it('returns orange for medium-high density', () => {
        expect(getDensityColor(5, 10)).toBe('#ea580c');
        expect(getDensityColor(4, 10)).toBe('#ea580c');
    });

    it('returns yellow for medium density', () => {
        expect(getDensityColor(3, 10)).toBe('#ca8a04');
        expect(getDensityColor(2, 10)).toBe('#ca8a04');
    });

    it('returns green for low density', () => {
        expect(getDensityColor(1, 10)).toBe('#16a34a');
        expect(getDensityColor(0, 10)).toBe('#16a34a');
    });

    it('handles maxWeight of zero', () => {
        expect(getDensityColor(0, 0)).toBe('#16a34a');
    });
});

describe('getDensityOpacity', () => {
    it('returns opacity between 0.15 and 0.5', () => {
        expect(getDensityOpacity(0, 10)).toBe(0.15);
        expect(getDensityOpacity(3, 10)).toBe(0.3);
        expect(getDensityOpacity(5, 10)).toBe(0.5);
        expect(getDensityOpacity(10, 10)).toBe(0.5);
    });

    it('returns 0.15 when maxWeight is zero', () => {
        expect(getDensityOpacity(0, 0)).toBe(0.15);
    });
});
