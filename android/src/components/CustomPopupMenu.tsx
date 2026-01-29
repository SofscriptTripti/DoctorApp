import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';

type MenuItem = {
    id: string;
    label: string;
    icon: string;
    onPress: (coords?: { x: number, y: number }) => void;
    isDanger?: boolean;
};

type CustomPopupMenuProps = {
    visible: boolean;
    onClose: () => void;
    items: MenuItem[];
    anchorPositions: { x: number; y: number } | null;
};

export const CustomPopupMenu = ({ visible, onClose, items, anchorPositions }: CustomPopupMenuProps) => {
    // Fallback theme since provider was removed
    const colors = {
        surface: '#FFFFFF',
        border: '#ccc',
        danger: '#EF4444',
        textPrimary: '#000000'
    };

    if (!visible || !anchorPositions) return null;

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View
                            style={[
                                styles.menuContainer,
                                {
                                    top: anchorPositions.y + 10,
                                    right: 20, // Align to right usually
                                    backgroundColor: colors.surface,
                                    borderColor: colors.border
                                }
                            ]}
                        >
                            {items.map((item, index) => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[
                                        styles.menuItem,
                                        index < items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }
                                    ]}
                                    onPress={(e) => {
                                        const { pageX, pageY } = e.nativeEvent;
                                        item.onPress({ x: pageX, y: pageY }); // Pass generic click coords
                                        onClose();
                                    }}
                                >
                                    <Feather
                                        name={item.icon}
                                        size={18}
                                        color={item.isDanger ? colors.danger : colors.textPrimary}
                                    />
                                    <Text
                                        style={[
                                            styles.menuText,
                                            {
                                                color: item.isDanger ? colors.danger : colors.textPrimary
                                            }
                                        ]}
                                    >
                                        {item.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    menuContainer: {
        position: 'absolute',
        width: 180,
        borderRadius: 12,
        borderWidth: 1,
        elevation: 8,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        paddingVertical: 4,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    menuText: {
        fontSize: 15,
        fontWeight: '500',
        marginLeft: 12,
    },
});
