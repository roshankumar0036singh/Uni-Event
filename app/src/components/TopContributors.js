import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';

const PAGE_SIZE = 5;

const TopContributors = () => {
  const { theme } = useTheme();
  const [contributors, setContributors] = useState([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopContributors();
  }, []);

  const fetchTopContributors = async () => {
  try {
    const leaderboardRef = doc(db, 'leaderboards', 'topContributors');
    const leaderboardSnapshot = await getDoc(leaderboardRef);

    if (!leaderboardSnapshot.exists()) {
      setContributors([]);
      return;
    }

    const leaderboardData = leaderboardSnapshot.data();
    setContributors(leaderboardData.contributors || []);
  } catch (error) {
    console.log('Error fetching top contributors:', error);
    setContributors([]);
  } finally {
    setLoading(false);
  }
};

  const getRankIcon = (index) => {
    if (index === 0) return 'trophy';
    if (index === 1) return 'medal';
    if (index === 2) return 'ribbon';
    return null;
  };

  const getRankColor = (index) => {
    if (index === 0) return '#f59e0b';
    if (index === 1) return '#9ca3af';
    if (index === 2) return '#b45309';
    return theme?.colors?.text || '#111827';
  };

  const getContributorName = (item) => {
    return (
      item.name ||
      item.fullName ||
      item.displayName ||
      item.email ||
      'Unknown Student'
    );
  };

  const getReputationPoints = (item) => {
    return item.reputationPoints || item.points || item.score || 0;
  };

  const visibleContributors = contributors.slice(0, visibleCount);

  const renderContributor = ({ item, index }) => {
    const iconName = getRankIcon(index);

    return (
      <View
        style={[
          styles.card,
          {
            borderBottomColor: theme?.colors?.border || '#e5e7eb',
          },
        ]}
      >
        <View style={styles.rankContainer}>
          {iconName ? (
            <Ionicons
              name={iconName}
              size={24}
              color={getRankColor(index)}
            />
          ) : (
            <Text
              style={[
                styles.rankText,
                { color: theme?.colors?.text || '#111827' },
              ]}
            >
              {index + 1}
            </Text>
          )}
        </View>

        <View style={styles.userInfo}>
          <Text
            style={[
              styles.name,
              { color: theme?.colors?.text || '#111827' },
            ]}
          >
            {getContributorName(item)}
          </Text>
          <Text
  style={[
    styles.points,
    { color: theme?.colors?.muted || '#6b7280' },
  ]}
>
  {getReputationPoints(item)} reputation points
</Text>

{item.department ? (
  <Text
    style={[
      styles.department,
      { color: theme?.colors?.muted || '#6b7280' },
    ]}
  >
    {item.department}
  </Text>
) : null}
        </View>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme?.colors?.card || '#ffffff',
          borderColor: theme?.colors?.border || '#e5e7eb',
        },
      ]}
    >
      <View style={styles.header}>
        <Ionicons
          name="podium"
          size={22}
          color={theme?.colors?.primary || '#2563eb'}
        />
        <View style={styles.headerText}>
          <Text
            style={[
              styles.title,
              { color: theme?.colors?.text || '#111827' },
            ]}
          >
            Top Contributors
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: theme?.colors?.muted || '#6b7280' },
            ]}
          >
            Campus-wide reputation leaderboard
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator
          size="small"
          style={styles.loader}
          color={theme?.colors?.primary || '#2563eb'}
        />
      ) : contributors.length === 0 ? (
        <Text
          style={[
            styles.emptyText,
            { color: theme?.colors?.muted || '#6b7280' },
          ]}
        >
          No contributors found yet.
        </Text>
      ) : (
        <>
          <FlatList
            data={visibleContributors}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={renderContributor}
          />

          {visibleCount < contributors.length && (
            <TouchableOpacity
              style={[
                styles.loadMoreButton,
                { backgroundColor: theme?.colors?.primary || '#2563eb' },
              ]}
              onPress={() =>
                setVisibleCount((currentCount) => currentCount + PAGE_SIZE)
              }
            >
              <Text style={styles.loadMoreText}>Load More</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
};

export default TopContributors;

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerText: {
    marginLeft: 10,
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
  },
  loader: {
    marginTop: 12,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rankContainer: {
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 17,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  points: {
    marginTop: 2,
    fontSize: 13,
  },
  department: {
  marginTop: 2,
  fontSize: 12,
},
  loadMoreButton: {
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  loadMoreText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});