import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getUserTitle, getPointsToNextTitle } from '../utils/points';

export default function ProfileScreen() {
  const [userPoints, setUserPoints] = useState<number | null>(null);

  useEffect(() => {
    const fetchPoints = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

      const db = getFirestore();
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        setUserPoints(userDoc.data().points ?? 0);
      }
    };
    fetchPoints();
  }, []);

  if (userPoints === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

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