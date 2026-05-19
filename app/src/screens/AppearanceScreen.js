import {
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
    Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ScreenWrapper from '../components/ScreenWrapper';
import { useTheme } from '../lib/ThemeContext';
import { useAnimatedTextColor, useAnimatedBackgroundColor } from '../lib/useAnimatedThemeColor';

export default function AppearanceScreen() {
    const {
        theme,
        isDarkMode,
        toggleTheme,
        textScale,
        updateTextScale,
        isHighContrast,
        toggleHighContrast,
        themeAnimationProgress,
    } = useTheme();

    // Animated colors for smooth transitions
    const headerTextColor = useAnimatedTextColor('#121212', '#FFFFFF');
    const sectionBgColor = useAnimatedBackgroundColor('#FFFFFF', '#1E1E1E');
    const sectionTitleColor = useAnimatedTextColor('#121212', '#FFFFFF');
    const labelColor = useAnimatedTextColor('#121212', '#FFFFFF');
    const subLabelColor = useAnimatedTextColor('#555555', '#B0B0B0');

    // Icon rotation animation (sun/moon rotation)
    const iconRotation = themeAnimationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
    });

    // Icon scale animation (subtle pop effect)
    const iconScale = themeAnimationProgress.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [1, 0.8, 1],
    });

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={styles.container}>
                <Animated.Text style={[styles.header, headerTextColor]}>
                    Appearance & Accessibility
                </Animated.Text>

                {/* Theme Section */}
                <Animated.View style={[styles.section, sectionBgColor]}>
                    <Animated.Text style={[styles.sectionTitle, sectionTitleColor]}>
                        Theme
                    </Animated.Text>
                    <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                            <Animated.Text style={[styles.label, labelColor]}>
                                Dark Mode
                            </Animated.Text>
                            <Animated.Text style={[styles.subLabel, subLabelColor]}>
                                Easier on the eyes in low light
                            </Animated.Text>
                        </View>
                        <View style={styles.themeToggleContainer}>
                            <Animated.View
                                style={[
                                    styles.iconContainer,
                                    {
                                        transform: [{ rotate: iconRotation }, { scale: iconScale }],
                                    },
                                ]}
                            >
                                <MaterialCommunityIcons
                                    name={
                                        isDarkMode ? 'moon-waning-crescent' : 'white-balance-sunny'
                                    }
                                    size={24}
                                    color={theme.colors.primary}
                                />
                            </Animated.View>
                            <Switch
                                value={isDarkMode}
                                onValueChange={toggleTheme}
                                trackColor={{ false: '#767577', true: theme.colors.primary }}
                            />
                        </View>
                    </View>
                </Animated.View>

                {/* Text Size Section */}
                <Animated.View style={[styles.section, sectionBgColor]}>
                    <Animated.Text style={[styles.sectionTitle, sectionTitleColor]}>
                        Text Size
                    </Animated.Text>
                    <Animated.Text style={[styles.subLabel, subLabelColor, { marginBottom: 15 }]}>
                        Adjust the reading size of the app
                    </Animated.Text>

                    <View style={styles.scaleContainer}>
                        <TouchableOpacity
                            onPress={() => updateTextScale(0.85)}
                            style={[
                                styles.scaleBtn,
                                textScale === 0.85 && { backgroundColor: theme.colors.primary },
                                {
                                    borderColor: isDarkMode ? '#444' : '#ccc',
                                },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.scaleTextSmall,
                                    { color: textScale === 0.85 ? '#fff' : theme.colors.text },
                                ]}
                            >
                                A
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => updateTextScale(1)}
                            style={[
                                styles.scaleBtn,
                                textScale === 1 && { backgroundColor: theme.colors.primary },
                                {
                                    borderColor: isDarkMode ? '#444' : '#ccc',
                                },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.scaleTextMedium,
                                    { color: textScale === 1 ? '#fff' : theme.colors.text },
                                ]}
                            >
                                A
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => updateTextScale(1.15)}
                            style={[
                                styles.scaleBtn,
                                textScale === 1.15 && { backgroundColor: theme.colors.primary },
                                {
                                    borderColor: isDarkMode ? '#444' : '#ccc',
                                },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.scaleTextLarge,
                                    { color: textScale === 1.15 ? '#fff' : theme.colors.text },
                                ]}
                            >
                                A
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <Animated.Text
                        style={[styles.preview, labelColor, { fontSize: 16 * textScale }]}
                    >
                        Preview: This is how your event details will look.
                    </Animated.Text>
                </Animated.View>

                {/* Accessibility Section */}
                <Animated.View style={[styles.section, sectionBgColor]}>
                    <Animated.Text style={[styles.sectionTitle, sectionTitleColor]}>
                        Accessibility
                    </Animated.Text>
                    <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                            <Animated.Text style={[styles.label, labelColor]}>
                                High Contrast
                            </Animated.Text>
                            <Animated.Text style={[styles.subLabel, subLabelColor]}>
                                Increase color contrast for better visibility
                            </Animated.Text>
                        </View>
                        <Switch
                            value={isHighContrast}
                            onValueChange={toggleHighContrast}
                            trackColor={{ false: '#767577', true: theme.colors.primary }}
                        />
                    </View>
                </Animated.View>
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: { padding: 20 },
    header: { fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
    section: { borderRadius: 12, padding: 20, marginBottom: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    label: { fontSize: 16, fontWeight: '600' },
    subLabel: { fontSize: 14, marginTop: 4 },

    themeToggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconContainer: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },

    scaleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        paddingHorizontal: 10,
    },
    scaleBtn: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scaleTextSmall: { fontSize: 14, fontWeight: 'bold' },
    scaleTextMedium: { fontSize: 18, fontWeight: 'bold' },
    scaleTextLarge: { fontSize: 24, fontWeight: 'bold' },
    preview: { marginTop: 10, fontStyle: 'italic' },
});
