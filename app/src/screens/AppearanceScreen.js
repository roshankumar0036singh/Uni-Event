import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import ScreenWrapper from '../components/ScreenWrapper';
import { useTheme } from '../lib/ThemeContext';

export default function AppearanceScreen() {
    const {
        theme,
        isDarkMode,
        toggleTheme,
        textScale,
        updateTextScale,
        isHighContrast,
        toggleHighContrast,
    } = useTheme();

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={[styles.header, { color: theme.colors.text }]}>
                    Appearance & Accessibility
                </Text>

                {/* Theme Section */}
                <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Theme</Text>
                    <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.label, { color: theme.colors.text }]}>
                                Dark Mode
                            </Text>
                            <Text style={[styles.subLabel, { color: theme.colors.textSecondary }]}>
                                Easier on the eyes in low light
                            </Text>
                        </View>
                        <Switch
                            value={isDarkMode}
                            onValueChange={toggleTheme}
                            trackColor={{ false: '#767577', true: theme.colors.primary }}
                        />
                    </View>
                </View>

                {/* Text Size Section */}
                <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                        Text Size
                    </Text>
                    <Text
                        style={[
                            styles.subLabel,
                            { color: theme.colors.textSecondary, marginBottom: 15 },
                        ]}
                    >
                        Adjust the reading size of the app
                    </Text>

                    <View style={styles.scaleContainer}>
                        <TouchableOpacity
                            onPress={() => updateTextScale(0.85)}
                            style={[
                                styles.scaleBtn,
                                textScale === 0.85 && { backgroundColor: theme.colors.primary },
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

                    <Text
                        style={[
                            styles.preview,
                            { color: theme.colors.text, fontSize: 16 * textScale },
                        ]}
                    >
                        Preview: This is how your event details will look.
                    </Text>
                </View>

                {/* Accessibility Section */}
                <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                        Accessibility
                    </Text>
                    <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.label, { color: theme.colors.text }]}>
                                High Contrast
                            </Text>
                            <Text style={[styles.subLabel, { color: theme.colors.textSecondary }]}>
                                Increase color contrast for better visibility
                            </Text>
                        </View>
                        <Switch
                            value={isHighContrast}
                            onValueChange={toggleHighContrast}
                            trackColor={{ false: '#767577', true: theme.colors.primary }}
                        />
                    </View>
                </View>
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
        borderColor: '#ccc',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scaleTextSmall: { fontSize: 14, fontWeight: 'bold' },
    scaleTextMedium: { fontSize: 18, fontWeight: 'bold' },
    scaleTextLarge: { fontSize: 24, fontWeight: 'bold' },
    preview: { marginTop: 10, fontStyle: 'italic' },
});
