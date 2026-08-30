import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  StyleSheet,
  ScrollView,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import * as firebaseService from '../services/firebaseService';

/**
 * Screen for attendees to check in to an event
 * Handles QR code scanning and manual check-in via token
 */
const CheckInScreen = ({ route }) => {
  const { eventId, token } = route.params;
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [event, setEvent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [userCheckedIn, setUserCheckedIn] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadEventData();
  }, [eventId]);

  const loadEventData = async () => {
    try {
      setLoading(true);
      const eventDoc = await firebaseService.getEventDetails(eventId);

      if (eventDoc) {
        setEvent(eventDoc);
        // Load attendees for this event
        const attendeesList = await firebaseService.getEventAttendees(eventId);
        setAttendees(attendeesList);
      } else {
        Alert.alert('Error', 'Event not found');
      }
    } catch (error) {
      console.error('Error loading event:', error);
      Alert.alert('Error', 'Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      setChecking(true);

      const userId = await firebaseService.getCurrentUserId();

      // Check if already checked in
      const alreadyCheckedIn = await firebaseService.isUserCheckedIn(
        eventId,
        userId
      );

      if (alreadyCheckedIn) {
        Alert.alert('Already Checked In', 'You have already checked in to this event');
        setUserCheckedIn(true);
        return;
      }

      // Perform check-in
      const response = await firebaseService.checkInToEvent({
        eventId,
        userId,
        token,
      });

      if (response.success) {
        setUserCheckedIn(true);
        Alert.alert('Success', 'You have successfully checked in!');
        // Reload attendees to show updated count
        await onRefresh();
      } else {
        Alert.alert('Check-in Failed', response.message || 'Unable to check in');
      }
    } catch (error) {
      console.error('Error during check-in:', error);
      Alert.alert('Error', 'Failed to complete check-in');
    } finally {
      setChecking(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const attendeesList = await firebaseService.getEventAttendees(eventId);
      setAttendees(attendeesList);
    } catch (error) {
      console.error('Error refreshing attendees:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading event...</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Event not found</Text>
      </View>
    );
  }

  const isEventEnded = new Date() > new Date(event.endTime);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.headerCard}>
        <Text style={styles.eventTitle}>{event.title}</Text>
        <Text style={styles.eventDate}>
          {new Date(event.startTime).toLocaleDateString()} at{' '}
          {new Date(event.startTime).toLocaleTimeString()}
        </Text>
        <Text style={styles.eventLocation}>{event.location}</Text>
      </View>

      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{attendees.length}</Text>
          <Text style={styles.statLabel}>Checked In</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{event.capacity}</Text>
          <Text style={styles.statLabel}>Capacity</Text>
        </View>
      </View>

      {!userCheckedIn && !isEventEnded && (
        <TouchableOpacity
          style={[styles.checkInButton, checking && styles.checkInButtonDisabled]}
          onPress={handleCheckIn}
          disabled={checking}
        >
          {checking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.checkInButtonText}>Check In Now</Text>
          )}
        </TouchableOpacity>
      )}

      {userCheckedIn && (
        <View style={styles.successBanner}>
          <Text style={styles.successBannerText}>✓ You are checked in!</Text>
        </View>
      )}

      {isEventEnded && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningBannerText}>Event has ended</Text>
        </View>
      )}

      <View style={styles.attendeesSection}>
        <Text style={styles.sectionTitle}>Checked In Attendees</Text>
        {attendees.length > 0 ? (
          <FlatList
            data={attendees}
            scrollEnabled={false}
            keyExtractor={(item) => item.userId}
            renderItem={({ item }) => (
              <View style={styles.attendeeItem}>
                <Text style={styles.attendeeName}>{item.userName}</Text>
                <Text style={styles.attendeeTime}>
                  {new Date(item.checkedInAt).toLocaleTimeString()}
                </Text>
              </View>
            )}
          />
        ) : (
          <Text style={styles.noAttendeesText}>
            No one has checked in yet
          </Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
  },
  headerCard: {
    backgroundColor: '#fff',
    padding: 16,
    margin: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eventTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  eventDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  eventLocation: {
    fontSize: 14,
    color: '#888',
  },
  statsCard: {
    backgroundColor: '#fff',
    margin: 12,
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 16,
  },
  checkInButton: {
    backgroundColor: '#34C759',
    margin: 12,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  checkInButtonDisabled: {
    opacity: 0.6,
  },
  checkInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  successBanner: {
    backgroundColor: '#d4edda',
    margin: 12,
    padding: 12,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
  },
  successBannerText: {
    color: '#155724',
    fontWeight: '600',
  },
  warningBanner: {
    backgroundColor: '#fff3cd',
    margin: 12,
    padding: 12,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  warningBannerText: {
    color: '#856404',
    fontWeight: '600',
  },
  attendeesSection: {
    margin: 12,
    paddingHorizontal: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  attendeeItem: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendeeName: {
    fontSize: 14,
    fontWeight: '500',
  },
  attendeeTime: {
    fontSize: 12,
    color: '#888',
  },
  noAttendeesText: {
    textAlign: 'center',
    color: '#999',
    paddingVertical: 24,
    fontSize: 14,
  },
});

export default CheckInScreen;
