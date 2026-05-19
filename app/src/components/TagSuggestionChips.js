import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchTagSuggestions } from '../lib/tagSuggestionService';
import { normalizeTags }        from '../lib/tagDictionary';
import { useTheme }             from '../lib/ThemeContext';

const DEBOUNCE_MS      = 800; 
const MIN_DESC_LENGTH  = 30;  

export default function TagSuggestionChips({ description, selectedTags, onTagsChange, apiKey }) {
  const { theme }                         = useTheme();
  const [suggestions, setSuggestions]     = useState([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);
  const debounceTimer                     = useRef(null);

  useEffect(() => {
  
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!description || description.length < MIN_DESC_LENGTH) {
      setSuggestions([]);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const raw        = await fetchTagSuggestions(description, apiKey);
        const normalized = normalizeTags(raw);
        
        setSuggestions(normalized.filter(t => !selectedTags.includes(t)));
      } catch (e) {
        console.warn('[TagSuggestionChips] API error:', e.message);
        setError('Could not load suggestions.');
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [description]); 

  const addTag = (tag) => {
    onTagsChange([...selectedTags, tag]);
    setSuggestions(prev => prev.filter(t => t !== tag));
  };

  const removeTag = (tag) => {
    onTagsChange(selectedTags.filter(t => t !== tag));
  };

  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
    
      {selectedTags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
          {selectedTags.map(tag => (
            <TouchableOpacity key={tag} style={styles.selectedChip} onPress={() => removeTag(tag)}>
              <Text style={styles.selectedChipText}>#{tag}</Text>
              <Ionicons name="close-circle" size={14} color="#fff" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Suggesting tags…</Text>
        </View>
      )}

      {!loading && error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {!loading && suggestions.length > 0 && (
        <View>
          <Text style={styles.suggestLabel}>Suggested tags — tap to add:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
            {suggestions.map(tag => (
              <TouchableOpacity key={tag} style={styles.suggestChip} onPress={() => addTag(tag)}>
                <Ionicons name="add" size={14} color={theme.colors.primary} />
                <Text style={styles.suggestChipText}>#{tag}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container:       { marginTop: 8 },
  row:             { flexDirection: 'row', marginBottom: 8 },
  loadingRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  loadingText:     { fontSize: 12, color: theme.colors.textSecondary },
  errorText:       { fontSize: 12, color: theme.colors.error ?? '#e53e3e', marginBottom: 6 },
  suggestLabel:    { fontSize: 12, color: theme.colors.textSecondary, marginBottom: 4 },

  selectedChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    marginRight: 8,
  },
  selectedChipText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  suggestChip: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: theme.colors.primary,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    marginRight: 8, backgroundColor: theme.colors.surface,
  },
  suggestChipText: { color: theme.colors.primary, fontSize: 13, marginLeft: 3 },
});