import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Modal,
    Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../components/ScreenWrapper';
import { useTheme } from '../lib/ThemeContext';
import PremiumInput from '../components/PremiumInput';
import PropTypes from 'prop-types';

export default function FormBuilderScreen({ navigation, route }) {
    const { onSave, initialSchema = [] } = route.params || {};
    const { theme } = useTheme();
    const styles = getStyles(theme);

    const [fields, setFields] = useState(initialSchema);
    const [modalVisible, setModalVisible] = useState(false);

    // New Field State
    const [newFieldLabel, setNewFieldLabel] = useState('');
    const [newFieldType, setNewFieldType] = useState('text'); // text, number, date, dropdown
    const [newFieldRequired, setNewFieldRequired] = useState(false);
    const [newFieldOptions, setNewFieldOptions] = useState(''); // Comma separated for dropdown

    const FIELD_TYPES = [
        { label: 'Text Input', value: 'text', icon: 'text-outline' },
        { label: 'Number Input', value: 'number', icon: 'calculator-outline' },
        { label: 'Date Picker', value: 'date', icon: 'calendar-outline' },
        { label: 'Dropdown', value: 'dropdown', icon: 'list-outline' },
    ];

    const PRESETS = [
        { label: 'Phone Number', type: 'number', required: true, options: '' },
        { label: 'WhatsApp No', type: 'number', required: false, options: '' },
        { label: 'T-Shirt Size', type: 'dropdown', required: true, options: 'S, M, L, XL, XXL' },
        { label: 'LinkedIn Profile', type: 'text', required: false, options: '' },
        { label: 'GitHub Profile', type: 'text', required: false, options: '' },
        { label: 'College', type: 'text', required: true, options: '' },
        { label: 'Age', type: 'number', required: true, options: '' },
        { label: 'Year of Study', type: 'dropdown', required: true, options: '1, 2, 3, 4' },
    ];

    const applyPreset = preset => {
        setNewFieldLabel(preset.label);
        setNewFieldType(preset.type);
        setNewFieldRequired(preset.required);
        setNewFieldOptions(preset.options);
    };

    const addField = () => {
        if (!newFieldLabel.trim()) {
            Alert.alert('Error', 'Please enter a field label');
            return;
        }

        if (newFieldType === 'dropdown' && !newFieldOptions.trim()) {
            Alert.alert('Error', 'Please enter options for the dropdown');
            return;
        }

        const newField = {
            id: Date.now().toString(),
            label: newFieldLabel,
            type: newFieldType,
            required: newFieldRequired,
            options:
                newFieldType === 'dropdown' ? newFieldOptions.split(',').map(o => o.trim()) : [],
        };

        setFields([...fields, newField]);
        resetModal();
        setModalVisible(false);
    };

    const removeField = id => {
        setFields(fields.filter(f => f.id !== id));
    };

    const resetModal = () => {
        setNewFieldLabel('');
        setNewFieldType('text');
        setNewFieldRequired(false);
        setNewFieldOptions('');
    };

    const handleSave = () => {
        if (onSave) {
            onSave(fields);
            navigation.goBack();
        }
    };

    const moveField = (index, direction) => {
        const newFields = [...fields];
        if (direction === 'up' && index > 0) {
            [newFields[index], newFields[index - 1]] = [newFields[index - 1], newFields[index]];
        } else if (direction === 'down' && index < newFields.length - 1) {
            [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
        }
        setFields(newFields);
    };

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Form Builder</Text>
                <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
                    <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {fields.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons
                            name="create-outline"
                            size={48}
                            color={theme.colors.textSecondary}
                        />
                        <Text style={styles.emptyText}>No fields added yet.</Text>
                        <Text style={styles.emptySubText}>
                            Tap &quot;+&quot; to add a custom field.
                        </Text>
                    </View>
                ) : (
                    fields.map((field, index) => (
                        <View key={field.id} style={styles.fieldCard}>
                            <View style={styles.fieldHeader}>
                                <View style={styles.fieldInfo}>
                                    <Text style={styles.fieldLabel}>{field.label}</Text>
                                    <View style={styles.badges}>
                                        <View style={styles.badge}>
                                            <Text style={styles.badgeText}>{field.type}</Text>
                                        </View>
                                        {field.required && (
                                            <View style={[styles.badge, styles.badgeRequired]}>
                                                <Text
                                                    style={[
                                                        styles.badgeText,
                                                        styles.badgeTextRequired,
                                                    ]}
                                                >
                                                    Required
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => removeField(field.id)}>
                                    <Ionicons name="trash-outline" size={22} color="#FF4444" />
                                </TouchableOpacity>
                            </View>

                            {field.type === 'dropdown' && (
                                <Text style={styles.optionsText}>
                                    Options: {field.options.join(', ')}
                                </Text>
                            )}

                            <View style={styles.separator} />

                            <View style={styles.controls}>
                                <TouchableOpacity
                                    onPress={() => moveField(index, 'up')}
                                    disabled={index === 0}
                                >
                                    <Ionicons
                                        name="chevron-up"
                                        size={24}
                                        color={index === 0 ? '#333' : '#666'}
                                    />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => moveField(index, 'down')}
                                    disabled={index === fields.length - 1}
                                >
                                    <Ionicons
                                        name="chevron-down"
                                        size={24}
                                        color={index === fields.length - 1 ? '#333' : '#666'}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>

            <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
                <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>

            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add New Field</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color={theme.colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={{ padding: 20 }}>
                            {/* Presets Section */}
                            <Text style={styles.label}>Quick Presets</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={{ marginBottom: 20 }}
                            >
                                {PRESETS.map((preset, idx) => (
                                    <TouchableOpacity
                                        key={idx}
                                        style={styles.presetChip}
                                        onPress={() => applyPreset(preset)}
                                    >
                                        <Ionicons
                                            name="flash-outline"
                                            size={14}
                                            color={theme.colors.primary}
                                        />
                                        <Text style={styles.presetText}>{preset.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <Text style={styles.label}>Field Type</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.typeScroll}
                            >
                                {FIELD_TYPES.map(t => (
                                    <TouchableOpacity
                                        key={t.value}
                                        style={[
                                            styles.typeChip,
                                            newFieldType === t.value && styles.typeChipActive,
                                        ]}
                                        onPress={() => setNewFieldType(t.value)}
                                    >
                                        <Ionicons
                                            name={t.icon}
                                            size={18}
                                            color={
                                                newFieldType === t.value
                                                    ? '#fff'
                                                    : theme.colors.text
                                            }
                                        />
                                        <Text
                                            style={[
                                                styles.typeText,
                                                newFieldType === t.value && styles.typeTextActive,
                                            ]}
                                        >
                                            {t.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <PremiumInput
                                label="Field Label"
                                placeholder="e.g. T-Shirt Size"
                                value={newFieldLabel}
                                onChangeText={setNewFieldLabel}
                            />

                            {newFieldType === 'dropdown' && (
                                <PremiumInput
                                    label="Options (comma separated)"
                                    placeholder="S, M, L, XL"
                                    value={newFieldOptions}
                                    onChangeText={setNewFieldOptions}
                                />
                            )}

                            <View style={styles.row}>
                                <Text style={styles.label}>Required Field?</Text>
                                <Switch
                                    value={newFieldRequired}
                                    onValueChange={setNewFieldRequired}
                                    trackColor={{
                                        false: theme.colors.border,
                                        true: theme.colors.primary,
                                    }}
                                />
                            </View>

                            <TouchableOpacity style={styles.addBtn} onPress={addField}>
                                <Text style={styles.addBtnText}>Add Field</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </ScreenWrapper>
    );
}

const getStyles = theme =>
    StyleSheet.create({
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: 10,
            justifyContent: 'space-between',
        },
        headerTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
        backBtn: { padding: 8, marginLeft: -8 },
        saveBtn: {
            backgroundColor: theme.colors.primary,
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 24,
        },
        saveBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },

        content: { padding: 20, paddingBottom: 100 },

        emptyState: { alignItems: 'center', marginTop: 100, gap: 16, opacity: 0.7 },
        emptyText: { fontSize: 20, fontWeight: 'bold', color: theme.colors.text },
        emptySubText: { color: theme.colors.textSecondary, fontSize: 16 },

        fieldCard: {
            backgroundColor: '#1A1A1A', // Hardcoded dark card as per image, or theme.colors.surface if dark mode
            borderRadius: 24,
            padding: 24,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: '#333',
        },
        fieldHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 12,
        },
        fieldInfo: { flex: 1, gap: 10 },
        fieldLabel: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

        badges: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
        badge: {
            backgroundColor: '#2A2A2A',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 8,
        },
        badgeText: {
            fontSize: 13,
            color: '#AAA',
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: 1,
        },

        badgeRequired: { backgroundColor: '#3A1515' }, // Dark Red bg
        badgeTextRequired: { color: '#FF4444' }, // Bright Red text

        optionsText: {
            color: '#888',
            fontSize: 13,
            marginTop: 16,
            fontStyle: 'italic',
            paddingLeft: 12,
            borderLeftWidth: 2,
            borderLeftColor: '#333',
        },

        separator: { height: 1, backgroundColor: '#333', marginVertical: 16 },

        controls: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: 20,
        },

        fab: {
            position: 'absolute',
            bottom: 30,
            right: 30,
            backgroundColor: '#FF9F0A',
            width: 64,
            height: 64,
            borderRadius: 32, // Orange accent
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#FF9F0A',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 8,
        },

        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
        modalContent: {
            backgroundColor: '#121212',
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            minHeight: '70%',
            paddingBottom: 40,
            borderWidth: 1,
            borderColor: '#333',
        },
        modalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 24,
            paddingBottom: 10,
        },
        modalTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },

        label: {
            fontSize: 13,
            fontWeight: '700',
            color: '#888',
            marginBottom: 12,
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        typeScroll: { marginBottom: 30 },
        typeChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 18,
            paddingVertical: 12,
            borderRadius: 16,
            backgroundColor: '#222',
            marginRight: 12,
            borderWidth: 1,
            borderColor: '#333',
        },
        typeChipActive: { backgroundColor: '#FF9F0A', borderColor: '#FF9F0A' },
        typeText: { color: '#AAA', fontWeight: '600' },
        typeTextActive: { color: '#000', fontWeight: 'bold' },

        presetChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 14,
            backgroundColor: '#222',
            marginRight: 10,
            borderWidth: 1,
            borderColor: '#333',
        },
        presetText: { color: '#EEE', fontSize: 14, fontWeight: '600' },

        row: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginVertical: 20,
        },
        addBtn: {
            backgroundColor: '#FF9F0A',
            padding: 20,
            borderRadius: 18,
            alignItems: 'center',
            marginTop: 10,
        },
        addBtnText: { color: '#000', fontWeight: '800', fontSize: 18 },
    });

FormBuilderScreen.propTypes = {
    navigation: PropTypes.object,
    route: PropTypes.object,
};
