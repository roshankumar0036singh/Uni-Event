import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';

/**
 * Button component for exporting event to calendar
 * Supports Google Calendar, Apple Calendar, and ICS download
 */
const CalendarExportButton = ({ eventId, eventTitle, eventStartTime, eventEndTime, eventLocation }) => {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleDownloadICS = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `https://uni-event.app/api/calendar/export?eventId=${eventId}`
      );

      if (!response.ok) {
        throw new Error('Failed to generate calendar file');
      }

      const fileContent = await response.text();
      const fileName = `${eventTitle.replace(/\s+/g, '_')}.ics`;
      const fileUri = FileSystem.documentDirectory + fileName;

      // Write ICS file
      await FileSystem.writeAsStringAsync(fileUri, fileContent);

      // Share or open file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/calendar',
          dialogTitle: `Share "${eventTitle}" Event`,
        });
      } else {
        Alert.alert('Success', `Calendar file saved: ${fileName}`);
      }

      setShowModal(false);
    } catch (error) {
      console.error('Error downloading ICS:', error);
      Alert.alert('Error', 'Failed to export calendar file');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCalendar = () => {
    try {
      const startTime = new Date(eventStartTime).toISOString();
      const endTime = new Date(eventEndTime).toISOString();

      const googleCalendarUrl =
        `https://calendar.google.com/calendar/render?action=TEMPLATE` +
        `&text=${encodeURIComponent(eventTitle)}` +
        `&dates=${startTime.replace(/[-:]/g, '').replace(/\.\d{3}/, '')}/${endTime.replace(/[-:]/g, '').replace(/\.\d{3}/, '')}` +
        `&location=${encodeURIComponent(eventLocation)}`;

      Linking.openURL(googleCalendarUrl);
      setShowModal(false);
    } catch (error) {
      console.error('Error opening Google Calendar:', error);
      Alert.alert('Error', 'Failed to open Google Calendar');
    }
  };

  const handleAppleCalendar = async () => {
    try {
      setLoading(true);
      await handleDownloadICS();
      setShowModal(false);
    } catch (error) {
      console.error('Error exporting to Apple Calendar:', error);
      Alert.alert('Error', 'Failed to export to Apple Calendar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setShowModal(true)}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Add to Calendar</Text>
        )}
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add to Calendar</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.eventTitle}>{eventTitle}</Text>
              <Text style={styles.eventMeta}>
                {new Date(eventStartTime).toLocaleString()}
              </Text>
              <Text style={styles.eventMeta}>{eventLocation}</Text>

              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={styles.option}
                  onPress={handleGoogleCalendar}
                  disabled={loading}
                >
                  <Text style={styles.optionIcon}>📅</Text>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>Google Calendar</Text>
                    <Text style={styles.optionDesc}>Add to your Google Calendar</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.option}
                  onPress={handleAppleCalendar}
                  disabled={loading}
                >
                  <Text style={styles.optionIcon}>🍎</Text>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>Apple Calendar</Text>
                    <Text style={styles.optionDesc}>Download ICS file for Apple Calendar</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.option}
                  onPress={handleDownloadICS}
                  disabled={loading}
                >
                  <Text style={styles.optionIcon}>⬇️</Text>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>Download ICS File</Text>
                    <Text style={styles.optionDesc}>Save as .ics file for any calendar app</Text>
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>What happens next?</Text>
                <Text style={styles.infoText}>
                  • You'll be taken to your calendar app{'\n'}
                  • The event details will be pre-filled{'\n'}
                  • You can add notes or make adjustments{'\n'}
                  • Save the event to your calendar
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
  },
  modalBody: {
    padding: 20,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  eventMeta: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  optionsContainer: {
    marginVertical: 20,
  },
  option: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  optionIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: 13,
    color: '#666',
  },
  infoBox: {
    backgroundColor: '#f0f8ff',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
  },
});

export default CalendarExportButton;
