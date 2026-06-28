import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getUserTitle, getPointsToNextTitle } from '../utils/points';

// Example: replace this with real user points from your app state/Firebase
const userPoints = 450;

export default function ProfileScreen() {
  const { title, color } = getUserTitle(userPoints);
  const pointsLeft = getPointsToNextTitle(userPoints);

  return (
    <View style={styles.container}>
      <Text style={styles.name}>Your Profile</Text>

      <View style={styles.titleBadge}>
        <Text style={[styles.titleText, { color }]}>🏅 {title}</Text>
      </View>

      <Text style={styles.pointsText}>{userPoints} points</Text>

      {pointsLeft !== null && (
        <Text style={styles.progressText}>
          {pointsLeft} points to next rank
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  titleBadge: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  titleText: {
    fontSize: 14,
    fontWeight: '700',
  },
  pointsText: {
    fontSize: 16,
    marginTop: 10,
    color: '#333',
  },
  progressText: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
});