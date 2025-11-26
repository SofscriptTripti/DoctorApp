// src/FormTypeScreen.tsx
import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const FORM_TYPES = [
  'Admission Form',
  'Discharge Summary',
  'Consent Form',
  'Follow-up Sheet',
  'Investigation Form',
];

function makeStorageKey(patientName: string, formType: string) {
  // normalize to safe key (no spaces, etc.)
  const safePatient = patientName.replace(/\s+/g, '_');
  const safeForm = formType.replace(/\s+/g, '_');
  return `DoctorApp:${safePatient}:${safeForm}:pagesBitmaps:v1`;
}

export default function FormTypeScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const patientName: string = route.params?.patientName ?? 'Unknown Patient';
  const patientId: string | undefined = route.params?.patientId;

  const handlePress = (formType: string) => {
    const storageKey = makeStorageKey(patientName, formType);

    navigation.navigate('FormImageScreen', {
      patientName,
      formName: formType,
      storageKey, // 🔑 UNIQUE per patient + form type
    });
  };

  const renderItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => handlePress(item)}
    >
      <View style={styles.cardRow}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>
            {item.split(' ')[0].charAt(0)}
          </Text>
        </View>

        <View style={styles.cardTextBlock}>
          <Text style={styles.formName}>{item}</Text>
          <Text style={styles.formSub}>
            Tap to open {item.toLowerCase()} templates
          </Text>
        </View>

        <View style={styles.chevronWrap}>
          <Text style={styles.chevron}>{'›'}</Text>
        </View>
      </View>

      {/* <View style={styles.chipRow}>
        <View style={styles.chip}>
          <View style={styles.chipDot} />
          <Text style={styles.chipText}>Linked to image editor</Text>
        </View>
      </View> */}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      style={[
        styles.container,
        { paddingTop: insets.top },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerLabel}>Selected patient</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {patientName}
          </Text>
          {patientId ? (
            <Text style={styles.headerSub}>ID: {patientId}</Text>
          ) : (
            <Text style={styles.headerSub}>Choose a form to continue</Text>
          )}
        </View>

        <View style={styles.headerRightBadge}>
          <Text style={styles.headerRightText}>
            {FORM_TYPES.length} forms
          </Text>
        </View>
      </View>

      {/* Content area */}
      <View style={styles.contentWrapper}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Form Types</Text>
          <Text style={styles.sectionSub}>
            Pick a form to fill / annotate
          </Text>
        </View>

        <FlatList
          data={FORM_TYPES}
          keyExtractor={(item, idx) => `${idx}-${item}`}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0EA5A4' },

  header: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: '#0EA5A4',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLabel: {
    fontSize: 12,
    color: '#CFFAFE',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  headerSub: {
    color: '#E0FFFC',
    fontSize: 13,
    marginTop: 2,
  },
  headerRightBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginLeft: 10,
  },
  headerRightText: {
    color: '#E0FFFC',
    fontSize: 12,
    fontWeight: '600',
  },

  contentWrapper: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },

  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
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
  formSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  chevronWrap: {
    marginLeft: 8,
  },
  chevron: {
    fontSize: 22,
    color: '#94A3B8',
    fontWeight: '600',
  },

  chipRow: {
    marginTop: 10,
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F97316',
    marginRight: 4,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#C05621',
  },
});
