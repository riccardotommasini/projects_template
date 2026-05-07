import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { X, Plus } from 'lucide-react-native'
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, ComponentSize } from '@/src/constants'
import { Ingredient } from '@/src/types/ingredient'
import { searchIngredients } from '@/src/services/ingredients.service'
import { normalize } from '@/src/utils/search'
import { UNITS } from '@/src/constants/units'
import { CreateRecipeIngredientDTO } from '@/src/types/recipeIngredient'
import UnitDropdown from '@/src/components/ui/UnitDropdown'

type SelectedIngredient = {
    ingredientID: number
    name: string
    quantity: number
    unitID: number
    unitType: string
    ingredient?: Ingredient
}

type StagedIngredient = {
    ingredient: Ingredient
    quantity: string
    unitIndex: number
}

type Props = {
    initialIngredients?: (CreateRecipeIngredientDTO & { name?: string; unitType?: string })[]
    onChange: (ingredients: CreateRecipeIngredientDTO[]) => void
}

export default function IngredientSearch({ initialIngredients = [], onChange }: Props) {
    const [search, setSearch] = useState('')
    const [suggestions, setSuggestions] = useState<Ingredient[]>([])
    const [staged, setStaged] = useState<StagedIngredient | null>(null)
    const [selected, setSelected] = useState<SelectedIngredient[]>([])
    const hasInitializedRef = useRef(false)
    const searchTokenRef = useRef(0)

    const normalizeUnitType = useCallback((unit?: string): string => {
        if (!unit) return 'unité'
        const cleaned = unit.trim().toLowerCase().replace(/\s+/g, ' ')
        const normalizedMap: Record<string, string> = {
            'c. à c.': 'c. à c.',
            'c.à c.': 'c. à c.',
            'c. a c.': 'c. à c.',
            'cuillère à café': 'c. à c.',
            'c. à s.': 'c. à s.',
            'c.à s.': 'c. à s.',
            'cuillère à soupe': 'c. à s.',
            'ml': 'mL',
            'millilitre': 'mL',
            'millilitres': 'mL',
            'cl': 'cL',
            'decilitre': 'cL',
            'litre': 'L',
            'litres': 'L',
            'gramme': 'g',
            'grammes': 'g',
            'kilogramme': 'kg',
            'kilogrammes': 'kg',
            'milligramme': 'mg',
            'milligrammes': 'mg',
            'piece': 'pièce',
            'tranches': 'tranches',
            'tranche': 'tranche',
            'gousse': 'gousse',
            'branche': 'branche',
            'feuille': 'feuille',
            'pincée': 'pincée',
            'poignée': 'poignée',
            'sachet': 'sachet',
            'bouquet': 'bouquet',
        }
        return normalizedMap[cleaned] || UNITS.find(u => u.type.toLowerCase() === cleaned)?.type || 'unité'
    }, [])

    const getUnitID = useCallback((unitType?: string): number => {
        const type = normalizeUnitType(unitType)
        return UNITS.find((u) => u.type === type)?.unitID || 3
    }, [normalizeUnitType])

    const notify = (items: SelectedIngredient[]) => {
        onChange(items.map(s => ({
            ingredientID: s.ingredientID,
            quantity: s.quantity,
            unitID: s.unitID,
        })))
    }

    const handleSearch = async (text: string) => {
        setSearch(text)
        if (text.length < 1) { setSuggestions([]); return }
        const token = ++searchTokenRef.current
        try {
            const results = await searchIngredients(text)
            if (token !== searchTokenRef.current) return
            const q = normalize(text)
            const filtered = results.filter(i => !selected.find(s => s.ingredientID === i.ingredientID))
            filtered.sort((a, b) => {
                const aN = normalize(a.name)
                const bN = normalize(b.name)
                const aStarts = aN.startsWith(q)
                const bStarts = bN.startsWith(q)
                if (aStarts !== bStarts) return aStarts ? -1 : 1
                if (aStarts) return a.name.length - b.name.length
                return 0
            })
            setSuggestions(filtered)
        } catch {
            if (token === searchTokenRef.current) setSuggestions([])
        }
    }

    const handleSelectSuggestion = (ingredient: Ingredient) => {
        const defaultIdx = UNITS.findIndex(u => u.type === ingredient.unitDefault)
        setStaged({
            ingredient,
            quantity: '1',
            unitIndex: defaultIdx >= 0 ? defaultIdx : 0,
        })
        setSearch('')
        setSuggestions([])
    }

    const handleConfirmStaged = () => {
        if (!staged) return
        const unit = UNITS[staged.unitIndex]
        const newSelected: SelectedIngredient[] = [
            ...selected,
            {
                ingredientID: staged.ingredient.ingredientID,
                name: staged.ingredient.name,
                ingredient: staged.ingredient,
                quantity: parseFloat(staged.quantity) || 1,
                unitID: unit.unitID,
                unitType: unit.type,
            },
        ]
        setSelected(newSelected)
        notify(newSelected)
        setStaged(null)
    }

    const handleRemove = (id: number) => {
        const newSelected = selected.filter(s => s.ingredientID !== id)
        setSelected(newSelected)
        notify(newSelected)
    }

    const handleQuantityChange = (id: number, text: string) => {
        const newSelected = selected.map(s =>
            s.ingredientID === id ? { ...s, quantity: parseFloat(text) || 0 } : s
        )
        setSelected(newSelected)
        notify(newSelected)
    }

    const handleQuantityStep = (id: number, delta: number) => {
        const newSelected = selected.map(s => {
            if (s.ingredientID !== id) return s
            const next = Math.min(9999, Math.max(0.25, parseFloat((s.quantity + delta).toFixed(2))))
            return { ...s, quantity: next }
        })
        setSelected(newSelected)
        notify(newSelected)
    }

    const handleUnitSelect = (id: number, unit: { unitID: number; type: string }) => {
        const newSelected = selected.map(s =>
            s.ingredientID === id ? { ...s, unitID: unit.unitID, unitType: unit.type } : s
        )
        setSelected(newSelected)
        notify(newSelected)
    }

    useEffect(() => {
        if (hasInitializedRef.current) return
        if (initialIngredients.length > 0) {
            const preloaded = initialIngredients.map((item, index) => ({
                ingredientID: item.ingredientID,
                name: item.name || `Ingrédient ${index + 1}`,
                quantity: item.quantity || 1,
                unitType: normalizeUnitType(item.unitType || ''),
                unitID: getUnitID(item.unitType),
            }))
            setSelected(preloaded)
            hasInitializedRef.current = true
        }
    }, [initialIngredients, getUnitID, normalizeUnitType])

    return (
        <View>
            <TextInput
                style={styles.input}
                placeholder="Ajouter un ingrédient..."
                placeholderTextColor={Colors.textSecondary}
                value={search}
                onChangeText={handleSearch}
                multiline={false}
            />

            {suggestions.length > 0 && (
                <ScrollView
                    style={styles.dropdown}
                    keyboardShouldPersistTaps="always"
                    nestedScrollEnabled
                >
                    {suggestions.map(ingredient => (
                        <TouchableOpacity
                            key={String(ingredient.ingredientID)}
                            style={styles.suggestion}
                            onPress={() => handleSelectSuggestion(ingredient)}
                        >
                            <Text style={styles.suggestionText}>{ingredient.name}</Text>
                            <Text style={styles.suggestionUnit}>{ingredient.unitDefault}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {staged && (
                <View style={styles.stagingCard}>
                    <View style={styles.stagingRow}>
                        <Text style={styles.stagingName} numberOfLines={1}>{staged.ingredient.name}</Text>
                        <TextInput
                            style={styles.qtyInput}
                            value={staged.quantity}
                            keyboardType="numeric"
                            onChangeText={(text) => setStaged(s => s ? { ...s, quantity: text } : s)}
                            onBlur={() => setStaged(s => {
                                if (!s) return s
                                const v = Math.min(9999, Math.max(0, parseFloat(s.quantity) || 0))
                                return { ...s, quantity: String(v) }
                            })}
                            selectTextOnFocus
                            maxLength={6}
                            multiline={false}
                            scrollEnabled={false}
                        />
                        <UnitDropdown
                            value={UNITS[staged.unitIndex].type}
                            selectedUnitID={UNITS[staged.unitIndex].unitID}
                            onSelect={(unit) => {
                                const idx = UNITS.findIndex(u => u.unitID === unit.unitID)
                                setStaged(s => s ? { ...s, unitIndex: idx >= 0 ? idx : 0 } : s)
                            }}
                            buttonStyle={styles.unitButton}
                            buttonActiveStyle={styles.unitButtonActive}
                            textStyle={styles.unitText}
                        />
                        <TouchableOpacity style={styles.addButton} onPress={handleConfirmStaged}>
                            <Plus size={18} color={Colors.surface} />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {selected.map((item, index) => {
                const id = item.ingredientID
                return (
                    <View key={`${id}-${index}`} style={styles.selectedItem}>
                        <View style={styles.itemRow}>
                            <Text style={styles.ingredientName} numberOfLines={1}>{item.name}</Text>
                            <View style={styles.controls}>
                                <View style={styles.stepper}>
                                    <TouchableOpacity
                                        onPress={() => handleQuantityStep(id, -0.25)}
                                        hitSlop={8}
                                        style={styles.stepBtn}
                                    >
                                        <Text style={styles.stepBtnText}>−</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.stepValue}>
                                        {item.quantity % 1 === 0 ? String(item.quantity) : item.quantity.toFixed(2).replace(/\.?0+$/, '')}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => handleQuantityStep(id, 0.25)}
                                        hitSlop={8}
                                        style={styles.stepBtn}
                                    >
                                        <Text style={styles.stepBtnText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                                <UnitDropdown
                                    value={item.unitType}
                                    selectedUnitID={item.unitID}
                                    onSelect={(unit) => handleUnitSelect(id, unit)}
                                    buttonStyle={styles.unitButton}
                                    buttonActiveStyle={styles.unitButtonActive}
                                    textStyle={styles.unitText}
                                    iconSize={11}
                                />
                                <TouchableOpacity
                                    onPress={() => handleRemove(id)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <X size={18} color={Colors.error} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )
            })}
        </View>
    )
}

const styles = StyleSheet.create({
    input: {
        height: ComponentSize.inputHeight,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.md,
        fontSize: FontSize.md,
        color: Colors.textPrimary,
    },
    dropdown: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        marginTop: Spacing.xs,
        overflow: 'hidden',
        maxHeight: 240,
    },
    suggestion: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    suggestionText: { fontSize: FontSize.md, color: Colors.textPrimary },
    suggestionUnit: { fontSize: FontSize.sm, color: Colors.textSecondary },

    stagingCard: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.primaryLight,
        marginTop: Spacing.sm,
    },
    stagingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        padding: Spacing.sm,
    },
    stagingName: {
        flex: 1,
        fontSize: FontSize.md,
        fontWeight: FontWeight.medium,
        color: Colors.textPrimary,
    },
    qtyInput: {
        width: 64,
        height: ComponentSize.inputHeight,
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.sm,
        borderWidth: 1,
        borderColor: Colors.border,
        textAlign: 'center',
        fontSize: FontSize.sm,
        color: Colors.textPrimary,
    },
    addButton: {
        width: ComponentSize.inputHeight,
        height: ComponentSize.inputHeight,
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },

    selectedItem: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        marginTop: Spacing.sm,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    ingredientName: {
        flex: 1,
        fontSize: FontSize.md,
        color: Colors.textPrimary,
        marginRight: Spacing.sm,
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.sm,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
    },
    stepBtn: {
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    stepBtnText: {
        fontSize: FontSize.md,
        color: Colors.primaryLight,
        fontWeight: FontWeight.semibold,
    },
    stepValue: {
        minWidth: 32,
        textAlign: 'center',
        fontSize: FontSize.sm,
        color: Colors.textPrimary,
        fontWeight: FontWeight.medium,
    },
    unitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.sm,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.sm,
        height: 36,
        minWidth: 52,
        justifyContent: 'center',
    },
    unitButtonActive: { borderColor: Colors.primary },
    unitText: { fontSize: FontSize.sm, color: Colors.textSecondary },
})
