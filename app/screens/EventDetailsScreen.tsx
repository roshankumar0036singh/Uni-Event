import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { hasScheduleOverlap, ClassSchedule } from '../utils/schedule';

interface Event {
    title: string;
    startAt: Date;
    endAt: Date;
}

interface EventDetailsScreenProps {
    event: Event;
    userSchedule: ClassSchedule[];
}

export const EventDetailsScreen: React.FC<EventDetailsScreenProps> = ({ event, userSchedule }) => {
    const isOverlapping = hasScheduleOverlap(event.startAt, event.endAt, userSchedule);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{event.title}</Text>

            {isOverlapping && (
                <View
                    style={styles.warningContainer}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="assertive"
                >
                    <Text style={styles.warningText}>
                        Warning: This event overlaps with your class schedule!
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    warningContainer: {
        marginTop: 10,
        padding: 10,
        backgroundColor: '#ffe6e6',
        borderLeftWidth: 4,
        borderLeftColor: 'red',
    },
    warningText: {
        color: 'red',
        fontWeight: 'bold',
    },
});

export default EventDetailsScreen;
