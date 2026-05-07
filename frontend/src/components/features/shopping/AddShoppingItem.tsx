import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { Plus } from 'lucide-react-native'
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, ComponentSize } from '@/src/constants'
import { ShoppingItem } from '@/src/types/shoppingList'
import { Ingredient } from '@/src/types/ingredient'
import { searchIngredients } from '@/src/services/ingredients.service'
import { normalize } from '@/src/utils/search'
import { UNITS } from '@/src/constants/units'
import UnitDropdown from '@/src/components/ui/UnitDropdown'

type Props = {
    listID: number
    onAdd: (item: Omit<ShoppingItem, 'itemID'>) => void
}

export default function AddShoppingItem({ listID, onAdd }: Props) {
    const [name, setName] = useState('')
    const [quantity, setQuantity] = useState('')
    const [unitIndex, setUnitIndex] = useState(0)
    const [selectedIngredientID, setSelectedIngredientID] = useState<number | undefined>()
    const [suggestions, setSuggestions] = useState<Ingredient[]>([])

    const currentUnit = UNITS[unitIndex]

    const handleSearch = async (text: string) => {
        setName(text)
        setSelectedIngredientID(undefined)
        if (text.length < 1) { setSuggestions([]); return }
        try {
            const results = await searchIngredients(text)
            const q = normalize(text)
            results.sort((a, b) => {
                const aStarts = normalize(a.name).startsWith(q)
                const bStarts = normalize(b.name).startsWith(q)
                return aStarts === bStarts ? 0 : aStarts ? -1 : 1
            })
            setSuggestions(results.slice(0, 6))
        } catch {
            setSuggestions([])
        }
    }

    const handleSelectIngredient = (ingredient: Ingredient) => {
        const idx = UNITS.findIndex(u => u.type === ingredient.unitDefault)
        if (idx >= 0) setUnitIndex(idx)
        setSelectedIngredientID(ingredient.ingredientID)
        setName(ingredient.name)
        setSuggestions([])
    }

    const handleAdd = () => {
        if (!name.trim()) return
        onAdd({
            name: name.trim(),
            quantity: quantity ? parseFloat(quantity) : undefined,
            checked: false,
            listID,
            ingredientID: selectedIngredientID,
            unitID: quantity ? currentUnit.unitID : undefined,
        })
        setName('')
        setQuantity('')
        setSelectedIngredientID(undefined)
        setSuggestions([])
    }

    return (
        <View>
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
                            onPress={() => handleSelectIngredient(ingredient)}
                        >
                            <Text style={styles.suggestionText}>{ingredient.name}</Text>
                            <Text style={styles.suggestionUnit}>{ingredient.unitDefault}</Text>
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={styles.suggestion} onPress={handleAdd}>
                        <Text style={styles.addFreeText}>Ajouter "{name}" manuellement</Text>
                    </TouchableOpacity>
                </ScrollView>
            )}

            <View style={styles.row}>
                <TextInput
                    style={styles.input}
                    placeholder="Article..."
                    placeholderTextColor={Colors.textSecondary}
                    value={name}
                    onChangeText={handleSearch}
                    onSubmitEditing={handleAdd}
                    returnKeyType="done"
                    maxLength={50}
                    multiline={false}
                    numberOfLines={1}
                />
                <TextInput
                    style={styles.qtyInput}
                    placeholder="Qté"
                    placeholderTextColor={Colors.textSecondary}
                    value={quantity}
                    onChangeText={setQuantity}
                    onBlur={() => {
                        const v = parseFloat(quantity)
                        if (!isNaN(v)) setQuantity(String(Math.min(9999, Math.max(0, v))))
                    }}
                    keyboardType="numeric"
                    maxLength={7}
                    multiline={false}
                />
                <UnitDropdown
                    value={currentUnit.type}
                    selectedUnitID={currentUnit.unitID}
                    onSelect={(unit) => {
                        const idx = UNITS.findIndex(u => u.unitID === unit.unitID)
                        setUnitIndex(idx >= 0 ? idx : 0)
                    }}
                    buttonStyle={styles.unitButton}
                    buttonActiveStyle={styles.unitButtonActive}
                    textStyle={styles.unitText}
                />
                <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
                    <Plus size={20} color={Colors.surface} />
                </TouchableOpacity>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    dropdown: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: Spacing.sm,
        overflow: 'hidden',
        maxHeight: 220,
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
    addFreeText: { fontSize: FontSize.sm, color: Colors.primaryLight, fontWeight: FontWeight.medium },
    row: { flexDirection: 'row', gap: Spacing.sm },
    input: {
        flex: 1,
        height: ComponentSize.inputHeight,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.md,
        fontSize: FontSize.md,
        color: Colors.textPrimary,
    },
    qtyInput: {
        width: 52,
        height: ComponentSize.inputHeight,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.xs,
        fontSize: FontSize.md,
        color: Colors.textPrimary,
        textAlign: 'center',
    },
    unitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        height: ComponentSize.inputHeight,
        paddingHorizontal: Spacing.sm,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        minWidth: 46,
        justifyContent: 'center',
    },
    unitButtonActive: { borderColor: Colors.primary },
    unitText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
    addButton: {
        width: ComponentSize.inputHeight,
        height: ComponentSize.inputHeight,
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
})
