import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  CheckBox,
} from 'react-native';
import * as firebaseService from '../services/firebaseService';

/**
 * Screen for event organizers to configure reminder settings
 */
const EventReminderSettingsScreen = ({ route, navigation }) => {
  const { eventId } = route.params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [reminderTimes, setReminderTimes] = useState({
    oneDay: false,
    twentyFourHours: true,
    oneHour: true,
    thirtyMinutes: false,
  });

  const reminderOptions = [
    { id: 'twentyFourHours', label: '24 hours before', minutes: 1440 },
    { id: 'oneHour', label: '1 hour before', minutes: 60 },
    { id: 'thirtyMinutes', label: '30 minutes before', minutes: 30 },
    { id: 'oneDay', label: '1 day before', minutes: 1440 },
  ];

  useEffect(() => {
    loadReminderConfig();
  }, [eventId]);

  const loadReminderConfig = async () => {
    try {
      setLoading(true);
      const config = await firebaseService.getReminderConfig(eventId);

      if (config) {
        setRemindersEnabled(config.enabled);
        setCustomMessage(config.customMessage || '');

        // Set selected reminder times
        const newReminderTimes = {};
        reminderOptions.forEach((option) => {
          newReminderTimes[option.id] = config.reminderTimes?.includes(option.minutes) || false;
        });
        setReminderTimes(newReminderTimes);
      }
    } catch (error) {
      console.error('Error loading reminder config:', error);
      Alert.alert('Error', 'Failed to load reminder settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);

      const selectedTimes = reminderOptions
        .filter((option) => reminderTimes[option.id])
        .map((option) => option.minutes);

      if (remindersEnabled && selectedTimes.length === 0) {
        Alert.alert('Error', 'Please select at least one reminder time');
        setSaving(false);
        return;
      }

      await firebaseService.updateReminderConfig(eventId, {
        enabled: remindersEnabled,
        reminderTimes: selectedTimes,
        customMessage: customMessage.trim() || undefined,
      });

      Alert.alert('Success', 'Reminder settings saved successfully');
      navigation.goBack();
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save reminder settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleReminderTime = (id) => {
    setReminderTimes((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Email Reminders</Text>
          <Switch
            value={remindersEnabled}
            onValueChange={setRemindersEnabled}
            trackColor={{ false: '#767577', true: '#81c784' }}
            thumbColor={remindersEnabled ? '#007AFF' : '#f4f3f4'}
          />
        </View>

        {remindersEnabled && (
          <>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                ✓ Registered attendees will receive email reminders at selected times
              </Text>
            </View>

            <View style={styles.subsection}>
              <Text style={styles.subsectionTitle}>When to send reminders</Text>

              {reminderOptions.map((option) => (
                <View key={option.id} style={styles.checkboxRow}>
                  <CheckBox
                    value={reminderTimes[option.id]}
                    onValueChange={() => toggleReminderTime(option.id)}
                    tintColor="#007AFF"
                  />
                  <Text style={styles.checkboxLabel}>{option.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.subsection}>
              <Text style={styles.subsectionTitle}>Custom message (optional)</Text>
              <Text style={styles.helperText}>
                Leave empty to use default reminder message
              </Text>
              <TextInput
                style={styles.messageInput}
                placeholder="Enter custom reminder message"
                value={customMessage}
                onChangeText={setCustomMessage}
                multiline
                numberOfLines={4}
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.gdprBox}>
              <Text style={styles.gdprTitle}>GDPR Compliance</Text>
              <Text style={styles.gdprText}>
                ✓ Attendees can unsubscribe from reminders with one click
              </Text>
              <Text style={styles.gdprText}>
                ✓ Only registered attendees receive reminders
              </Text>
              <Text style={styles.gdprText}>
                ✓ No marketing emails, only event-related reminders
              </Text>
            </View>
          </>
        )}

        {!remindersEnabled && (
          <View style={styles.disabledBox}>
            <Text style={styles.disabledText}>
              Reminders are disabled. Enable to send email reminders to attendees.
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSaveSettings}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save Settings</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#d4edda',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
  },
  infoText: {
    color: '#155724',
    fontSize: 14,
  },
  subsection: {
    marginBottom: 20,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    marginLeft: 12,
    color: '#333',
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 100,
  },
  gdprBox: {
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  gdprTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
  },
  gdprText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 6,
  },
  disabledBox: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 6,
  },
  disabledText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EventReminderSettingsScreen;
