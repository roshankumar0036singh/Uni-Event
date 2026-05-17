import { Animated, ScrollView, StyleSheet, Switch, 
         Text, TouchableOpacity, View } from 'react-native';
import { useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';

// Inside component, add this:
const iconAnim = useRef(new Animated.Value(isDarkMode ? 1 : 0)).current;

const handleToggle = () => {
    toggleTheme();
    Animated.timing(iconAnim, {
        toValue: isDarkMode ? 0 : 1,
        duration: 400,
        useNativeDriver: true,
    }).start();
};

const iconRotation = iconAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
});

// Replace the Switch row with:
<View style={styles.row}>
    <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color: theme.colors.text }]}>
            Dark Mode
        </Text>
        <Text style={[styles.subLabel, { color: theme.colors.textSecondary }]}>
            Easier on the eyes in low light
        </Text>
    </View>

    {/* Animated sun/moon icon */}
    <Animated.View style={[{ marginRight: 10 }, { transform: [{ rotate: iconRotation }] }]}>
        <Ionicons
            name={isDarkMode ? 'moon' : 'sunny'}
            size={22}
            color={isDarkMode ? '#a78bfa' : '#f59e0b'}
        />
    </Animated.View>

    <Switch
        value={isDarkMode}
        onValueChange={handleToggle}
        trackColor={{ false: '#767577', true: theme.colors.primary }}
    />
</View>