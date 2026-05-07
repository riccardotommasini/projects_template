import { useState, useRef } from 'react'
import {
    View, Text, TouchableOpacity, Modal, ScrollView,
    StyleSheet, Dimensions, TouchableWithoutFeedback,
    StyleProp, ViewStyle, TextStyle,
} from 'react-native'
import { ChevronDown } from 'lucide-react-native'
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/src/constants'
import { UNITS } from '@/src/constants/units'

export type Unit = { unitID: number; type: string }
type Layout = { x: number; y: number; w: number; h: number }

const MAX_H = 200

type Props = {
    value: string
    selectedUnitID: number
    onSelect: (unit: Unit) => void
    buttonStyle?: StyleProp<ViewStyle>
    buttonActiveStyle?: StyleProp<ViewStyle>
    textStyle?: StyleProp<TextStyle>
    iconSize?: number
}

export default function UnitDropdown({
    value,
    selectedUnitID,
    onSelect,
    buttonStyle,
    buttonActiveStyle,
    textStyle,
    iconSize = 10,
}: Props) {
    const [open, setOpen] = useState(false)
    const [layout, setLayout] = useState<Layout | null>(null)
    const ref = useRef<View>(null)

    const handleOpen = () => {
        ref.current?.measure((_fx, _fy, w, h, px, py) => {
            setLayout({ x: px, y: py, w, h })
            setOpen(true)
        })
    }

    const { width: SW, height: SH } = Dimensions.get('window')
    const openUpward = layout ? layout.y + layout.h + MAX_H > SH : false

    return (
        <>
            <View ref={ref}>
                <TouchableOpacity
                    style={[buttonStyle, open && buttonActiveStyle]}
                    onPress={open ? () => setOpen(false) : handleOpen}
                >
                    <Text style={textStyle}>{value}</Text>
                    <ChevronDown size={iconSize} color={Colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {open && layout && (
                <Modal transparent animationType="none" onRequestClose={() => setOpen(false)}>
                    <TouchableWithoutFeedback onPress={() => setOpen(false)}>
                        <View style={StyleSheet.absoluteFill} />
                    </TouchableWithoutFeedback>
                    <View style={[
                        styles.dropdown,
                        openUpward
                            ? { bottom: SH - layout.y + 4, right: SW - layout.x - layout.w }
                            : { top: layout.y + layout.h + 4, right: SW - layout.x - layout.w },
                    ]}>
                        <ScrollView bounces={false}>
                            {UNITS.map(unit => (
                                <TouchableOpacity
                                    key={unit.unitID}
                                    style={[styles.option, unit.unitID === selectedUnitID && styles.optionActive]}
                                    onPress={() => { onSelect(unit); setOpen(false) }}
                                >
                                    <Text style={[styles.optionText, unit.unitID === selectedUnitID && styles.optionTextActive]}>
                                        {unit.type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </Modal>
            )}
        </>
    )
}

const styles = StyleSheet.create({
    dropdown: {
        position: 'absolute',
        width: 140,
        maxHeight: MAX_H,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
    option: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    optionActive: { backgroundColor: Colors.primaryButton },
    optionText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        fontWeight: FontWeight.medium,
    },
    optionTextActive: { color: Colors.primary, fontWeight: FontWeight.bold },
})
