// src/PatientScreen.tsx
import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Patient = {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  room: string;
  diagnosis: string;
};

const PATIENTS: Patient[] = [
  {
    id: 'P-001',
    name: 'Aarav Malhotra',
    age: 28,
    gender: 'Male',
    room: 'Ward 3B - Bed 12',
    diagnosis: 'Post-op observation',
  },
  {
    id: 'P-002',
    name: 'Ishita Kulkarni',
    age: 34,
    gender: 'Female',
    room: 'Ward 2A - Bed 05',
    diagnosis: 'Diabetes follow-up',
  },
  {
    id: 'P-003',
    name: 'Kabir Narang',
    age: 19,
    gender: 'Male',
    room: 'OPD - 07',
    diagnosis: 'Sports injury (knee)',
  },
  {
    id: 'P-004',
    name: 'Myra D’Souza',
    age: 25,
    gender: 'Female',
    room: 'Ward 1C - Bed 02',
    diagnosis: 'Anemia workup',
  },
  {
    id: 'P-005',
    name: 'Vihaan Suri',
    age: 42,
    gender: 'Male',
    room: 'ICU - Bed 04',
    diagnosis: 'Chest pain evaluation',
  },
  {
    id: 'P-006',
    name: 'Anaya Bansal',
    age: 31,
    gender: 'Female',
    room: 'Ward 4A - Bed 09',
    diagnosis: 'High-risk pregnancy',
  },
  {
    id: 'P-007',
    name: 'Reyansh Chawla',
    age: 37,
    gender: 'Male',
    room: 'OPD - 03',
    diagnosis: 'Migraine follow-up',
  },
  {
    id: 'P-008',
    name: 'Siya Khurana',
    age: 22,
    gender: 'Female',
    room: 'Day Care - 02',
    diagnosis: 'IV iron therapy',
  },
  {
    id: 'P-009',
    name: 'Advait Reddy',
    age: 55,
    gender: 'Male',
    room: 'Ward 5D - Bed 11',
    diagnosis: 'Hypertension management',
  },
  {
    id: 'P-010',
    name: 'Kiara Oberoi',
    age: 29,
    gender: 'Female',
    room: 'Ward 2B - Bed 01',
    diagnosis: 'Pre-op assessment',
  },
];

export default function PatientScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const handlePress = (patient: Patient) => {
    navigation.navigate('FormType', {
      patientName: patient.name,
      patientId: patient.id,
    });
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (
      parts[0].charAt(0).toUpperCase() +
      parts[parts.length - 1].charAt(0).toUpperCase()
    );
  };

  const renderItem = ({ item }: { item: Patient }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.88}
      onPress={() => handlePress(item)}
    >
      {/* Top row: avatar + name/id */}
      <View style={styles.cardTopRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
        </View>

        <View style={styles.nameBlock}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.idText}>{item.id}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {item.gender} • {item.age} yrs
            </Text>
            <View style={styles.badge}>
              <View style={styles.badgeDot} />
              <Text style={styles.badgeText}>
                {item.room.startsWith('OPD')
                  ? 'OPD'
                  : item.room.startsWith('ICU')
                  ? 'Critical'
                  : 'Inpatient'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Bottom: room + diagnosis */}
      <View style={styles.bottomRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.labelText}>Room / Location</Text>
          <Text style={styles.roomText}>{item.room}</Text>
        </View>

        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.labelText}>Primary concern</Text>
          <Text
            style={styles.diagnosisText}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {item.diagnosis}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      style={[
        styles.container,
        { paddingTop: insets.top },
      ]}
    >
      {/* Colored header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Patients</Text>
          <Text style={styles.headerSub}>
            Tap a patient to select form type
          </Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>
            {PATIENTS.length} active
          </Text>
        </View>
      </View>

      {/* Light background section */}
      <View style={styles.contentWrapper}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today&apos;s Patients</Text>
          <Text style={styles.sectionSub}>Recently admitted & OPD</Text>
        </View>

        <FlatList
          data={PATIENTS}
          keyExtractor={(item) => item.id}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 6,
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerSub: { color: '#E0FFFC', fontSize: 13, marginTop: 4 },
  headerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  headerBadgeText: {
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

  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0EA5A418',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0EA5A4',
  },
  nameBlock: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
    paddingRight: 8,
  },
  idText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    alignItems: 'center',
  },
  metaText: {
    fontSize: 13,
    color: '#475569',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
    marginRight: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#166534',
  },

  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
  },

  bottomRow: {
    flexDirection: 'row',
  },
  labelText: {
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  roomText: {
    fontSize: 13,
    color: '#0369A1',
    fontWeight: '500',
  },
  diagnosisText: {
    fontSize: 13,
    color: '#1E293B',
  },
});
