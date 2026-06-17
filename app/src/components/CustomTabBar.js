import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import PropTypes from 'prop-types';

const TAB_ICONS = {
    Home: { focused: 'home', unfocused: 'home-outline' },
    Profile: { focused: 'person', unfocused: 'person-outline' },
    Admin: { focused: 'settings', unfocused: 'settings-outline' },
    Reminders: { focused: 'alarm', unfocused: 'alarm-outline' },
    MyEvents: { focused: 'calendar', unfocused: 'calendar-outline' },
    MyEventsTab: { focused: 'calendar', unfocused: 'calendar-outline' },
    Leaderboard: { focused: 'trophy', unfocused: 'trophy-outline' },
};

const getTabIcon = (routeName, isFocused) => {
    const icon = TAB_ICONS[routeName];
    if (!icon) {
        return 'ellipse-outline';
    }
    return isFocused ? icon.focused : icon.unfocused;
};

export default function CustomTabBar({ state, descriptors, navigation }) {
    const { theme, isDarkMode } = useTheme();

    return (
        <View style={styles.container}>
            <BlurView
                intensity={80}
                tint={isDarkMode ? 'dark' : 'light'}
                style={[styles.blurContainer, { borderColor: theme.colors.border }]}
            >
                <View
                    style={[
                        styles.content,
                        {
                            backgroundColor:
                                Platform.OS === 'android'
                                    ? isDarkMode
                                        ? 'rgba(30,30,30,0.85)'
                                        : 'rgba(255,255,255,0.85)'
                                    : 'transparent',
                        },
                    ]}
                >
                    {state.routes.map((route, index) => {
                        const { options } = descriptors[route.key];

                        const isFocused = state.index === index;

                        const onPress = () => {
                            const event = navigation.emit({
                                type: 'tabPress',
                                target: route.key,
                                canPreventDefault: true,
                            });

                            if (!isFocused && !event.defaultPrevented) {
                                navigation.navigate(route.name);
                            }
                        };

                        const iconName = getTabIcon(route.name, isFocused);

                        const color = isFocused ? theme.colors.primary : theme.colors.textSecondary;

                        return (
                            <TouchableOpacity
                                key={route.key}
                                accessible={true}
                                accessibilityRole="button"
                                accessibilityState={isFocused ? { selected: true } : {}}
                                accessibilityLabel={
                                    options.tabBarAccessibilityLabel || `${route.name} tab`
                                }
                                testID={options.tabBarTestID}
                                onPress={onPress}
                                style={styles.tabItem}
                            >
                                <Ionicons name={iconName} size={22} color={color} />
                                {isFocused && (
                                    <View
                                        style={[
                                            styles.activeDot,
                                            { backgroundColor: theme.colors.primary },
                                        ]}
                                    />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </BlurView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 12,
        left: 20,
        right: 20,
        alignItems: 'center',
    },
    blurContainer: {
        flexDirection: 'row',
        width: '100%',
        maxWidth: 500,
        borderRadius: 25,
        overflow: 'hidden',
        borderWidth: 1,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 5 },
            android: { elevation: 4 },
        }),
    },
    content: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: 10,
        width: '100%',
    },
    tabItem: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 36,
        width: 36,
    },
    activeDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        marginTop: 2,
    },
});

CustomTabBar.propTypes = {
    state: PropTypes.any,
    descriptors: PropTypes.any,
    navigation: PropTypes.object,
};
