import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist'
import { X, Plus, GripVertical } from 'lucide-react-native'
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, ComponentSize } from '@/src/constants'
import { CreateStepDTO } from '@/src/types/step'

type DraggableStep = CreateStepDTO & { key: string }


type Props = {
    initialSteps?: CreateStepDTO[]
    onChange: (steps: CreateStepDTO[]) => void
}

export default function StepList({ initialSteps = [], onChange }: Props) {
    const [steps, setSteps] = useState<DraggableStep[]>([])

    const notify = (newSteps: DraggableStep[]) => {
        onChange(newSteps.map((s, i) => ({ text: s.text, order: i + 1 })))
    }

    const handleAdd = () => {
        if (steps.some(s => !s.text.trim())) return
        const newSteps = [...steps, { text: '', order: steps.length + 1, key: String(Date.now()) }]
        setSteps(newSteps)
        notify(newSteps)
    }

    useEffect(() => {
        if (initialSteps.length > 0) {
            const normalized = initialSteps.map((step, index) => ({
                ...step,
                order: step.order || index + 1,
                key: `initial-step-${index}`,
            }))
            setSteps(normalized)
        }
    }, [initialSteps])

    const handleChange = (key: string, text: string) => {
        const newSteps = steps.map(s => s.key === key ? { ...s, text } : s)
        setSteps(newSteps)
        notify(newSteps)
    }

    const handleRemove = (key: string) => {
        const newSteps = steps.filter(s => s.key !== key)
        setSteps(newSteps)
        notify(newSteps)
    }

    const handleDragEnd = ({ data }: { data: DraggableStep[] }) => {
        setSteps(data)
        notify(data)
    }

    const renderItem = ({ item, drag, isActive }: RenderItemParams<DraggableStep>) => (
        <ScaleDecorator>
            <View style={[styles.stepRow, isActive && styles.stepRowActive]}>
                <TouchableOpacity onLongPress={drag} delayLongPress={100} style={styles.dragHandle}>
                    <GripVertical size={20} color={Colors.textSecondary} />
                </TouchableOpacity>

                <View style={styles.orderBadge}>
                    <Text style={styles.orderText}>{steps.indexOf(item) + 1}</Text>
                </View>

                <TextInput
                    style={styles.stepInput}
                    placeholder={`Étape...`}
                    placeholderTextColor={Colors.textSecondary}
                    multiline
                    value={item.text}
                    onChangeText={(text) => handleChange(item.key, text)}
                    onBlur={() => { if (!item.text.trim()) handleRemove(item.key) }}
                />

                <TouchableOpacity onPress={() => handleRemove(item.key)}>
                    <X size={18} color={Colors.error} />
                </TouchableOpacity>
            </View>
        </ScaleDecorator>
    )

    return (
        <View>
            <DraggableFlatList
                data={steps}
                keyExtractor={item => item.key}
                renderItem={renderItem}
                onDragEnd={handleDragEnd}
                scrollEnabled={false}
            />

            <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
                <Plus size={18} color={Colors.primary} />
                <Text style={styles.addButtonText}>Ajouter une étape</Text>
            </TouchableOpacity>
        </View>
    )
}

const styles = StyleSheet.create({
    stepRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
        padding: Spacing.xs,
        borderRadius: BorderRadius.md,
    },
    stepRowActive: {
        backgroundColor: Colors.surface,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
    },
    dragHandle: {
        paddingTop: Spacing.sm,
    },
    orderBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: Spacing.sm,
    },
    orderText: {
        color: Colors.surface,
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
    },
    stepInput: {
        flex: 1,
        minHeight: ComponentSize.inputHeight,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        fontSize: FontSize.md,
        color: Colors.textPrimary,
        textAlignVertical: 'top',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.sm,
    },
    addButtonText: {
        fontSize: FontSize.md,
        color: Colors.primary,
        fontWeight: FontWeight.medium,
    },
})