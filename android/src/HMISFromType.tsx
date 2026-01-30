// src/HMISFormType.tsx
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
import { useTheme } from './theme/ThemeContext';

// 🔹 Total page count for each report
const FORM_TOTAL_PAGES: Record<string, number> = {
  initial_nursing_assessment: 3, // LIS Report
  emergency_nursing_assessment: 1, // Discharge Summary
  neonatal_initial_nursing: 0, // Medical Report disabled
  doctors_handover_isbar: 0, // MRD Report disabled
};

// 🔹 Reports
const FORM_TYPES = [
  { title: 'LIS Report', key: 'initial_nursing_assessment' },
  { title: 'Discharge Summary', key: 'emergency_nursing_assessment' },
  { title: 'Medical Report', key: 'neonatal_initial_nursing' },
  { title: 'Other MRD Report', key: 'doctors_handover_isbar' },
];

function makeStorageKey(patientName: string, formType: string) {
  const safePatient = patientName.replace(/\s+/g, '_');
  const safeForm = formType.replace(/\s+/g, '_');
  return `DoctorApp:${safePatient}:${safeForm}:pagesBitmaps:v1`;
}

export default function HMISFormType() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const { isDark, colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  // 🔹 Robust parameter extraction — FIXED
  const params = route.params ?? {};

  const patientName: string =
    params.patientName ??
    params.name ??
    params.patient ??
    'Unknown Patient';

  const patientIP: string =
    params.patientIP !== undefined && params.patientIP !== null
      ? String(params.patientIP)
      : params.ip !== undefined
        ? String(params.ip)
        : '';

  const patientId: string | undefined =
    params.patientId ?? params.id ?? params.patient_id;

  const filteredForms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return FORM_TYPES;
    return FORM_TYPES.filter((f) => f.title.toLowerCase().includes(q));
  }, [searchQuery]);

  const handlePress = (form: { title: string; key: string }) => {
    if (form.title === 'Medical Report' || form.title === 'Other MRD Report') return;

    if (form.title === 'LIS Report') {
      navigation.navigate('NoOFReport', {
        patientName,
        patientId,
        patientIP,
        formTitle: form.title,
        formKey: form.key,
        storageKey: makeStorageKey(patientName, form.title),
      });
      return;
    }

    if (form.title === 'Discharge Summary') {
      navigation.navigate('PdfViewer', {
        title: 'Discharge Summary',
        pdfFileName: 'NST003.pdf',
        patientName,
        patientId,
        patientIP,
      });
      return;
    }
  };

  const renderItem = ({ item }: { item: { title: string; key: string } }) => {
    const isDisabled =
      item.title === 'Medical Report' || item.title === 'Other MRD Report';

    const totalPages = FORM_TOTAL_PAGES[item.key] ?? 0;

    return (
      <TouchableOpacity
        style={[styles.card, isDark && { backgroundColor: colors.surface, elevation: 0 }]}
        activeOpacity={isDisabled ? 1 : 0.9}
        onPress={() => !isDisabled && handlePress(item)}
        disabled={isDisabled}
      >
        <View style={styles.cardRow}>
          <View style={[styles.iconCircle, isDark && { backgroundColor: colors.surfaceHighlight }]}>
            <Text style={styles.iconText}>{item.title.charAt(0)}</Text>
          </View>

          <View style={styles.cardTextBlock}>
            <Text style={[styles.formName, isDark && { color: colors.textPrimary }]}>{item.title}</Text>
          </View>

          {/* 🔹 Page Count */}
          <View style={styles.pageInfoWrap}>
            <Text style={styles.pageInfoText}>0/{totalPages}</Text>
          </View>

          <View style={styles.chevronWrap}>
            <Text style={[styles.chevron, isDark && { color: colors.textMuted }]}>›</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: isDark ? colors.background : '#F1F5F9' }]}>
      {/* HEADER */}
      <View style={[
        styles.header,
        isDark && { backgroundColor: colors.surface, elevation: 0 }
      ]}>
        <TouchableOpacity
          style={[styles.backButton, isDark && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#0EA5A4' }]}
          onPress={() =>
            navigation.navigate('FormType', {
              patientName,
              patientId,
              patientIP,
            })
          }
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={22} color={isDark ? '#0EA5A4' : '#fff'} />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Reports</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.backButton,
            { marginRight: 0, marginLeft: 0 },
            isDark && { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#0EA5A4' }
          ]}
          onPress={() => navigation.navigate('PatientScreen')}
        >
          <Icon name="home" size={22} color={isDark ? '#0EA5A4' : '#fff'} />
        </TouchableOpacity>
      </View>

      {/* CONTENT */}
      <View style={styles.contentWrapper}>
        <View style={styles.sectionHeader}>
          {/* 🔹 Patient Display — FIXED */}
          <View style={styles.patientInfoCard}>
            <Text style={styles.patientValue} numberOfLines={1}>
              {patientName} {patientIP ? ` / ${patientIP}` : 'null'}
            </Text>
          </View>

          {/* SEARCH */}
          <View style={[styles.searchWrapperContent, isDark && { backgroundColor: colors.surfaceHighlight, elevation: 0 }]}>
            <Icon
              name="search"
              size={18}
              color={isDark ? colors.textMuted : "#94A3B8"}
              style={{ marginRight: 8 }}
            />

            <TextInput
              placeholder="Search Reports"
              placeholderTextColor={isDark ? colors.textMuted : "#64748B"}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInputContent, isDark && { color: colors.textPrimary }]}
              returnKeyType="search"
            />

            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="close-circle" size={18} color={isDark ? colors.textMuted : "#94A3B8"} />
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
              <Text style={{ color: isDark ? colors.textMuted : '#94A3B8' }}>No reports match your search.</Text>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

/* ---------- STYLES ---------- */

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

  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },

  contentWrapper: { flex: 1 },

  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  patientInfoCard: {
    backgroundColor: '#0EA5A4',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },

  patientValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },

  searchWrapperContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: 10,
    minHeight: 40,
  },

  searchInputContent: {
    flex: 1,
    height: 36,
    paddingVertical: 0,
    color: '#0F172A',
    fontSize: 14,
    textAlignVertical: 'center',
  },

  card: {
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

  cardRow: { flexDirection: 'row', alignItems: 'center' },

  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  iconText: { fontSize: 17, fontWeight: '700', color: '#0EA5A4' },

  cardTextBlock: { flex: 1 },

  formName: { fontSize: 16, fontWeight: '600', color: '#0F172A' },

  pageInfoWrap: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  pageInfoText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0EA5A4',
  },

  chevronWrap: { marginLeft: 8 },

  chevron: { fontSize: 22, color: '#94A3B8' },
});
