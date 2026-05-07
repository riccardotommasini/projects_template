import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { Check } from 'lucide-react-native'
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/src/constants'
import { getTags } from '@/src/services/users.service'

interface Tag {
  tagID: number
  name: string
}

interface TagSelectorProps {
  selectedTagIDs: number[]
  onChange: (tagIDs: number[]) => void
}

export default function TagSelector({ selectedTagIDs, onChange }: TagSelectorProps) {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTags()
  }, [])

  const loadTags = async () => {
    try {
      const data = await getTags()
      setTags(data)
    } catch (error) {
      console.error('Erreur chargement tags:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleTag = (tagID: number) => {
    if (selectedTagIDs.includes(tagID)) {
      onChange(selectedTagIDs.filter(id => id !== tagID))
    } else {
      onChange([...selectedTagIDs, tagID])
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={Colors.primaryLight} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tags.map((tag) => (
          <Pressable
            key={tag.tagID}
            style={[
              styles.tag,
              selectedTagIDs.includes(tag.tagID) && styles.tagSelected,
            ]}
            onPress={() => toggleTag(tag.tagID)}
          >
            <Text
              style={[
                styles.tagText,
                selectedTagIDs.includes(tag.tagID) && styles.tagTextSelected,
              ]}
            >
              {tag.name}
            </Text>
            {selectedTagIDs.includes(tag.tagID) && (
              <Check size={16} color={Colors.primaryButton} style={styles.checkIcon} />
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.md,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
    backgroundColor: Colors.background,
    gap: Spacing.xs,
  },
  tagSelected: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primaryButton,
  },
  tagText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.primaryLight,
  },
  tagTextSelected: {
    color: Colors.primaryButton,
  },
  checkIcon: {
    marginLeft: Spacing.xs,
  },
})
