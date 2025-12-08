// src/FormTypeScreen.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
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
  const patientIP: number | undefined = route.params?.patientIP;

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
      formKey: form.key,
      storageKey,
      patientIP, // pass forward if needed
      patientId,
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
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('PatientScreen')}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Form Types</Text>
        </View>

        <TouchableOpacity
          style={styles.hmisButton}
          onPress={() =>
            navigation.navigate('HMISFormType', {
              patientName,
              patientId,
              patientIP,
            })
          }
          activeOpacity={0.8}
        >
          <Text style={styles.hmisButtonText}>HMIS Report</Text>
        </TouchableOpacity>
      </View>

      {/* MAIN CONTENT */}
      <View style={styles.contentWrapper}>
        <View style={styles.sectionHeader}>
          {/* Colored Patient + IP info card */}
          <View style={styles.patientInfoCard}>
            <View style={styles.patientInfoCol}>
              <Text style={styles.patientValue} numberOfLines={1}>
                {patientName} / {patientIP}
              </Text>
            </View>

            {/* {patientIP != null && (
              <View style={styles.patientInfoColRight}>
                <Text style={styles.patientLabel}>IP No</Text>
                <Text style={styles.patientValue} numberOfLines={1}>
                  {patientIP}
                </Text>
              </View>
            )} */}
          </View>

          <View style={styles.searchWrapperContent}>
            <Icon
              name="search"
              size={18}
              color="#94A3B8"
              style={{ marginRight: 8 }}
            />

            <TextInput
              multiline={false}
              placeholder="Search Forms"
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

        {/* LIST */}
        <FlatList
          data={filteredForms}
          keyExtractor={(item, idx) => `${idx}-${item.key}`}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: 24,
            paddingHorizontal: 16,
            paddingTop: 10,
          }}
          ListEmptyComponent={() => (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8' }}>No forms match your search.</Text>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

/* ===================== STYLES ======================= */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },

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

  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },

  /* HMIS BUTTON */
  hmisButton: {
    backgroundColor: '#0EA5A4',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    borderColor: 'white',
    borderWidth: 2,
  },

  hmisButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },

  contentWrapper: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },

  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: '#F1F5F9',
  },

  /* Colored Patient + IP card */
  patientInfoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#2c9999ff', // colored card
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },

  patientInfoCol: {
    flex: 1,
    paddingRight: 8,
  },

  patientInfoColRight: {
    flexShrink: 0,
    alignItems: 'flex-end',
    paddingLeft: 8,
  },

  patientLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)', // soft white
    textTransform: 'uppercase',
    marginBottom: 3,
    fontWeight: '500',
  },

  patientValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF', // bright white
  },
searchWrapperContent: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#FFFFFF',
  paddingHorizontal: 10,
  // paddingVertical: 8,        // ❌ remove this
  borderRadius: 10,
  shadowColor: '#000',
  shadowOpacity: 0.03,
  shadowRadius: 4,
  elevation: 1,
  marginBottom: 10,
  minHeight: 40,               // ✅ optional: keeps nice height
},

searchInputContent: {
  flex: 1,
  height: 36,
  paddingVertical: 0,          // ✅ important on Android
  color: '#0F172A',
  fontSize: 14,
  textAlignVertical: 'center', // ✅ Android: centers text without scroll
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
