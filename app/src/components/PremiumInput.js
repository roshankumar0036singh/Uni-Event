import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../lib/ThemeContext';

export default function PremiumInput({
    label,
    value,
    onChangeText,
    placeholder,
    secureTextEntry,
    icon,
    error,
    keyboardType = 'default',
    autoCapitalize = 'none',
    style,
}) {
    const { theme } = useTheme();
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    return (
        <View style={[styles.container, style]}>
            {label && (
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text>
            )}

            <View
                style={[
                    styles.inputWrapper,
                    {
                        backgroundColor: theme.colors.surface,
                        borderColor: error
                            ? theme.colors.error
                            : isFocused
                              ? theme.colors.primary
                              : 'transparent',
                        borderWidth: isFocused || error ? 1.5 : 0,
                    },
                ]}
            >
                {icon && <View style={styles.iconContainer}>{icon}</View>}

                <TextInput
                    style={[
                        styles.input,
                        { color: theme.colors.text },
                        Platform.select({ web: { outlineStyle: 'none' } }), // REMOVE WEB OUTLINE
                    ]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={theme.colors.textSecondary}
                    secureTextEntry={secureTextEntry && !isPasswordVisible}
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                />

                {secureTextEntry && (
                    <TouchableOpacity
                        onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                        style={styles.eyeIcon}
                    >
                        <Ionicons
                            name={isPasswordVisible ? 'eye-off' : 'eye'}
                            size={20}
                            color={theme.colors.textSecondary}
                        />
                    </TouchableOpacity>
                )}
            </View>

            {error && (
                <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        marginBottom: 8,
        fontWeight: '600',
        marginLeft: 4,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        borderRadius: 14,
        height: 56,
    },
    iconContainer: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        height: '100%',
    },
    eyeIcon: {
        padding: 8,
    },
    errorText: {
        fontSize: 12,
        marginTop: 4,
        marginLeft: 4,
    },
});
