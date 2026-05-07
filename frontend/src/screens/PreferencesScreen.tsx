import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/src/constants/colors';
import { Spacing, ComponentSize } from '@/src/constants';
import PrimaryButton from '@/src/components/ui/PrimaryButton';
import { getTags, saveUserPreferences } from '@/src/services/users.service';
import { router } from 'expo-router';

type Tag = { tagID: number; name: string };

export default function PreferencesScreen() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTags();
  }, []);

  async function loadTags() {
    try {
      const data = await getTags();
      setTags(data);
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible de charger les tags');
    }
  }

  function toggle(tagID: number) {
    setSelected(prev => ({ ...prev, [tagID]: !prev[tagID] }));
  }

  async function handleSave() {
    const chosen = tags.filter(t => selected[t.tagID]).map(t => t.name);
    if (chosen.length === 0) {
      Alert.alert('Sélection requise', 'Choisissez au moins un tag');
      return;
    }

    try {
      setLoading(true);
      await saveUserPreferences(chosen);
      setLoading(false);
      router.replace('/');
    } catch (e: any) {
      setLoading(false);
      Alert.alert('Erreur', e.message || 'Impossible de sauvegarder');
    }
  }

  const renderItem = ({ item }: { item: Tag }) => {
    const checked = !!selected[item.tagID];
    return (
      <Pressable
        onPress={() => toggle(item.tagID)}
        style={[styles.chip, checked ? styles.chipSelected : undefined]}
      >
        <Text style={[styles.chipText, checked ? styles.chipTextSelected : undefined]}>{item.name}</Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Choisis tes préférences</Text>
        <Text style={styles.subtitle}>Sélectionne les tags qui t&apos;intéressent (recettes recommandées)</Text>

        <FlatList
          data={tags}
          keyExtractor={(i) => String(i.tagID)}
          renderItem={renderItem}
          numColumns={2}
          contentContainerStyle={styles.list}
        />

        <PrimaryButton title={loading ? 'Enregistrement...' : 'Enregistrer'} onPress={handleSave} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, padding: Spacing.xl, justifyContent: 'space-between' },
  title: { fontSize: 22, fontWeight: '600', color: Colors.textPrimary, marginBottom: 6 },
  subtitle: { color: Colors.textSecondary, marginBottom: 12 },
  list: { gap: 10, paddingBottom: 20 },
  chip: {
    flex: 1,
    margin: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  chipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textPrimary, textTransform: 'capitalize' },
  chipTextSelected: { color: Colors.surface },
});
