import { LinearGradient } from 'expo-linear-gradient';
import {
    Dimensions,
    ImageBackground,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { FeaturedCarouselSkeleton } from './SkeletonLoader';
import PropTypes from 'prop-types';

const width = Dimensions.get('window').width;

export default function FeaturedCarousel({ data = [], onEventPress, isLoading = false }) {
    const { theme } = useTheme();

    if (isLoading) return <FeaturedCarouselSkeleton />;
    if (data.length === 0) return null;

    return (
        <View style={styles.container}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Featured Events</Text>
            <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={width - 40}
                contentContainerStyle={{ paddingHorizontal: 20 }}
            >
                {data.map((item, index) => (
                    <TouchableOpacity
                        key={item.id || index}
                        style={styles.card}
                        onPress={() => onEventPress && onEventPress(item)}
                        activeOpacity={0.9}
                    >
                        <ImageBackground
                            source={{ uri: item.image || 'https://via.placeholder.com/600x300' }}
                            style={styles.imageBackground}
                            imageStyle={{ borderRadius: 12 }}
                        >
                            <LinearGradient
                                colors={['transparent', 'rgba(0,0,0,0.8)']}
                                style={styles.gradient}
                            >
                                <View style={styles.textContainer}>
                                    <Text style={styles.cardTitle} numberOfLines={1}>
                                        {item.title}
                                    </Text>
                                    <Text style={styles.cardSubtitle} numberOfLines={1}>
                                        {new Date(item.startAt).toDateString()} • {item.location}
                                    </Text>
                                </View>
                            </LinearGradient>
                        </ImageBackground>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 20,
        marginBottom: 10,
    },
    card: {
        width: width - 60,
        height: (width - 60) / 1.8,
        borderRadius: 12,
        overflow: 'hidden',
        marginRight: 15,
    },
    imageBackground: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    gradient: {
        padding: 15,
        height: '50%',
        justifyContent: 'flex-end',
        borderRadius: 12,
    },
    textContainer: {
        gap: 4,
    },
    cardTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    cardSubtitle: {
        color: '#eee',
        fontSize: 12,
    },
});

FeaturedCarousel.propTypes = {
    data: PropTypes.any,
    onEventPress: PropTypes.any,
    isLoading: PropTypes.bool,
};
