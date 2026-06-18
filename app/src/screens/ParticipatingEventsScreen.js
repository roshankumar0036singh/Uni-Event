import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useState, useCallback } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import EventCard from '../components/EventCard';
import ScreenWrapper from '../components/ScreenWrapper';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebaseConfig';
import { theme as staticTheme } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';
import PropTypes from 'prop-types';

export default function ParticipatingEventsScreen({ navigation }) {
    const { user } = useAuth();
    const { theme } = useTheme();
    const isFocused = useIsFocused();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            setEvents([]);
            return;
        }
        if (!isFocused) return;

        // 1. Listen to 'participating' subcollection while screen is focused
        const q = collection(db, 'users', user.uid, 'participating');

        const unsubscribe = onSnapshot(q, async snapshot => {
            const eventIds = snapshot.docs.map(d => d.id);

            if (eventIds.length === 0) {
                setEvents([]);
                setLoading(false);
                return;
            }

            try {
                const eventPromises = eventIds.map(id => getDoc(doc(db, 'events', id)));
                const eventDocs = await Promise.all(eventPromises);

                const list = eventDocs
                    .filter(d => d.exists())
                    .map(d => ({ id: d.id, ...d.data() }));

                // Sort by date (Upcoming first)
                list.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));

                setEvents(list);
            } catch (e) {
                console.error('Error fetching participating events', e);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [user, isFocused]);

    // 🚀 Task 3: Wrap list item component renderer with useCallback to completely optimize list recycling renders
    const renderItem = useCallback(
        ({ item }) => (
            <EventCard
                event={item}
                isRegistered={true} // By definition
                onLike={() => {}}
                onShare={() => {}}
            />
        ),
        [],
    );

    if (loading)
        return (
            <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
                <ActivityIndicator color={theme.colors.primary} />
            </View>
        );

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[theme.typography.h2, { color: theme.colors.text }]}>Going</Text>
            </View>

            {/* 🚀 Task 1: Replaced old legacy standard FlatList with Shopify optimized recycling FlashList engine layout view */}
            <FlashList
                data={events}
                keyExtractor={item => item.id}
                estimatedItemSize={160} // 🔥 Performance size optimization parameter allows smooth 60fps item rendering
                contentContainerStyle={{ padding: staticTheme.spacing.m }}
                ListEmptyComponent={
                    <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
                        You haven&apos;t joined any events yet.
                    </Text>
                }
                renderItem={renderItem}
            />
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: staticTheme.spacing.s,
        marginBottom: staticTheme.spacing.m,
        gap: 10,
    },
    empty: { textAlign: 'center', marginTop: 50 },
});

ParticipatingEventsScreen.propTypes = {
    navigation: PropTypes.object,
};
