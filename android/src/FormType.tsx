// src/FormTypeScreen.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

// NOTE: each item has title and key. key maps to a folder in ./Images
const FORM_TYPES = [
  { title: 'Initial Nursing Assessment - ADULTS', key: 'initial_nursing_assessment' },
  { title: 'Neonatal Initial Nursing Assessment Form', key: 'neonatal_initial_nursing' },
  { title: 'Emergency Nursing Assessment', key: 'emergency_nursing_assessment' },
  { title: 'Doctors Handover Format ISBAR', key: 'doctors_handover_isbar' },
];

function makeStorageKey(patientName: string, formType: string) {
  const safePatient = patientName.replace(/\s+/g, '_');
  const safeForm = formType.replace(/\s+/g, '_');
  return `DoctorApp:${safePatient}:${safeForm}:pagesBitmaps:v1`;
}

export default function FormTypeScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');

  const patientName: string = route.params?.patientName ?? 'Unknown Patient';
  const patientId: string | undefined = route.params?.patientId;

  // Live search filter (search inside content area like PatientScreen)
  const filteredForms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return FORM_TYPES;
    return FORM_TYPES.filter((f) => f.title.toLowerCase().includes(q));
  }, [searchQuery]);

  const handlePress = (form: { title: string; key: string }) => {
    const storageKey = makeStorageKey(patientName, form.title);

    navigation.navigate('FormImageScreen', {
      patientName,
      formName: form.title,
      formKey: form.key, // pass the key that maps to the Images folder
      storageKey,
    });
  };

  const renderItem = ({ item }: { item: { title: string; key: string } }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => handlePress(item)}
    >
      <View style={styles.cardRow}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>{item.title.charAt(0)}</Text>
        </View>

        <View style={styles.cardTextBlock}>
          <Text style={styles.formName}>{item.title}</Text>
        </View>

        <View style={styles.chevronWrap}>
          <Text style={styles.chevron}>{'›'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('PatientScreen')}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Form Types</Text>
        </View>

        <Image
          source={{
            uri: 'https://pbs.twimg.com/profile_images/1245651839262965761/vZcdH3RR_400x400.jpg',
          }}
          style={styles.logo}
        />
      </View>

      <View style={styles.contentWrapper}>
        <View style={styles.sectionHeader}>
          <View style={styles.searchWrapperContent}>
            <Icon name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search forms..."
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInputContent}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 }}>
          <FlatList
            data={filteredForms}
            keyExtractor={(item, idx) => `${idx}-${item.key}`}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
            ListEmptyComponent={() => (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ color: '#94A3B8' }}>No forms match your search.</Text>
              </View>
            )}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0EA5A4' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0EA5A4',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    elevation: 6,
  },

  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginRight: 12,
  },

  logo: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    marginLeft: 10,
    backgroundColor: '#fff',
  },

  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },

  contentWrapper: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },

  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: '#F1F5F9',
  },

  searchWrapperContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: 10,
  },

  searchInputContent: {
    flex: 1,
    height: 36,
    color: '#0F172A',
    fontSize: 14,
  },

  card: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: '#ffffff',
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },

  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  iconText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0EA5A4',
  },

  cardTextBlock: {
    flex: 1,
  },

  formName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },

  chevronWrap: { marginLeft: 8 },

  chevron: {
    fontSize: 22,
    color: '#94A3B8',
    fontWeight: '600',
  },
});
