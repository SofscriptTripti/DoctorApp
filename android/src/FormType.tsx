
import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// Use the local uploaded image path as default imageUri when navigating.
const LOCAL_IMAGE_URI = 'file:///mnt/data/49e6fed6-e019-4f53-a7ac-e0fc4066e7a4.png';

const FORMS = [
  { name: 'Admission Form', imageUri: LOCAL_IMAGE_URI },
  { name: 'Consent Form', imageUri: LOCAL_IMAGE_URI },
  { name: 'Discharge Summary', imageUri: LOCAL_IMAGE_URI },
  { name: 'Lab Request', imageUri: LOCAL_IMAGE_URI },
  { name: 'Radiology Request', imageUri: LOCAL_IMAGE_URI },
  { name: 'Prescription', imageUri: LOCAL_IMAGE_URI },
  { name: 'Surgical Checklist', imageUri: LOCAL_IMAGE_URI },
  { name: 'Patient History', imageUri: LOCAL_IMAGE_URI },
  { name: 'Insurance Form', imageUri: LOCAL_IMAGE_URI },
  { name: 'Referral Letter', imageUri: LOCAL_IMAGE_URI },
];

export default function FormType() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('FormImageScreen', { imageUri: item.imageUri, formName: item.name })}
    >
      <Text style={styles.formName}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Available Form Types</Text>
        <Text style={styles.headerSub}>Tap any form to view & edit</Text>
      </View>

      <FlatList
        data={FORMS}
        keyExtractor={(item, idx) => `${idx}-${item.name}`}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FAFD' },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: '#0EA5A4',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerSub: { color: '#E6FFFE', fontSize: 13, marginTop: 6 },
  listContent: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 28 },
  card: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2,
  },
  formName: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
});
