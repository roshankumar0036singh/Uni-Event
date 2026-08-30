import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import QRCode from 'qrcode.react';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

/**
 * Component for displaying and managing QR code check-in
 * Organizers can view and share the QR code for event check-in
 */
const QRCheckInButton = ({ eventId, eventTitle, qrToken, onCheckInPress }) => {
  const [showQR, setShowQR] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);

  const checkInUrl = `https://uni-event.app/events/${eventId}/checkin?token=${qrToken}`;

  useEffect(() => {
    if (showQR && !qrDataUrl) {
      generateQRCode();
    }
  }, [showQR]);

  const generateQRCode = async () => {
    try {
      setLoading(true);
      // Generate QR code data URL
      const canvas = document.createElement('canvas');
      const qr = new QRCode({
        content: checkInUrl,
        element: canvas,
        errorCorrection: 'H',
        type: 'image/png',
      });

      const dataUrl = canvas.toDataURL('image/png');
      setQrDataUrl(dataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
      Alert.alert('Error', 'Failed to generate QR code');
    } finally {
      setLoading(false);
    }
  };

  const handleShareQR = async () => {
    try {
      setLoading(true);

      // Save QR code to temporary file
      const fileName = `${eventId}-qr-${Date.now()}.png`;
      const fileUri = FileSystem.documentDirectory + fileName;

      if (qrDataUrl) {
        // Extract base64 from data URL
        const base64 = qrDataUrl.split(',')[1];
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Share the file
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'image/png',
            dialogTitle: `Share QR Code for ${eventTitle}`,
          });
        } else {
          Alert.alert('Sharing not available', 'Your device does not support sharing');
        }
      }
    } catch (error) {
      console.error('Error sharing QR code:', error);
      Alert.alert('Error', 'Failed to share QR code');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCheckInLink = async () => {
    try {
      await navigator.clipboard.writeText(checkInUrl);
      Alert.alert('Success', 'Check-in link copied to clipboard');
    } catch (error) {
      console.error('Error copying link:', error);
      Alert.alert('Error', 'Failed to copy check-in link');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setShowQR(!showQR)}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {showQR ? 'Hide' : 'Show'} Check-in QR Code
          </Text>
        )}
      </TouchableOpacity>

      {showQR && (
        <View style={styles.qrContainer}>
          <Text style={styles.qrTitle}>Event Check-in QR Code</Text>
          <Text style={styles.qrSubtitle}>{eventTitle}</Text>

          <View style={styles.qrCodeBox}>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Check-in QR Code"
                style={styles.qrImage}
              />
            ) : (
              <ActivityIndicator size="large" color="#007AFF" />
            )}
          </View>

          <Text style={styles.qrInfo}>
            Scan this code to check in to the event
          </Text>

          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.actionButton, styles.shareButton]}
              onPress={handleShareQR}
              disabled={loading || !qrDataUrl}
            >
              <Text style={styles.actionButtonText}>Share QR Code</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.copyButton]}
              onPress={handleCopyCheckInLink}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>Copy Link</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.instructionsBox}>
            <Text style={styles.instructionsTitle}>Instructions:</Text>
            <Text style={styles.instructionText}>
              1. Display this QR code at the event venue
            </Text>
            <Text style={styles.instructionText}>
              2. Attendees can scan to check in
            </Text>
            <Text style={styles.instructionText}>
              3. Check-in closes after event end time
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginVertical: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  qrContainer: {
    marginTop: 16,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  qrSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  qrCodeBox: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  qrImage: {
    width: 280,
    height: 280,
  },
  qrInfo: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  shareButton: {
    backgroundColor: '#34C759',
  },
  copyButton: {
    backgroundColor: '#FF9500',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  instructionsBox: {
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  instructionsTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    color: '#007AFF',
  },
  instructionText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 4,
  },
});

export default QRCheckInButton;
