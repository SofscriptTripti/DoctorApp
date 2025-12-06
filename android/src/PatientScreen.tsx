// src/PatientScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';  // ← BACK ICON / search icon

type Patient = {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  room: string;
  diagnosis: string;
  doctorName: string;
  admitDate: string; // ISO date string or human friendly string
};

const PATIENTS: Patient[] = [
  {
    id: 'P-001',
    name: 'Aarav Malhotra',
    age: 28,
    gender: 'Male',
    room: 'Ward 3B - Bed 12',
    diagnosis: 'Post-op observation',
    doctorName: 'Dr. Sandeep Rao',
    admitDate: '2025-12-03',
  },
  {
    id: 'P-002',
    name: 'Ishita Kulkarni',
    age: 34,
    gender: 'Female',
    room: 'Ward 2A - Bed 05',
    diagnosis: 'Diabetes follow-up',
    doctorName: 'Dr. Meera Joshi',
    admitDate: '2025-12-02',
  },
  {
    id: 'P-003',
    name: 'Kabir Narang',
    age: 19,
    gender: 'Male',
    room: 'OPD - 07',
    diagnosis: 'Sports injury (knee)',
    doctorName: 'Dr. Aman Verma',
    admitDate: '2025-12-05',
  },
  {
    id: 'P-004',
    name: "Myra D’Souza",
    age: 25,
    gender: 'Female',
    room: 'Ward 1C - Bed 02',
    diagnosis: 'Anemia workup',
    doctorName: 'Dr. Lata Fernandes',
    admitDate: '2025-11-30',
  },
  {
    id: 'P-005',
    name: 'Vihaan Suri',
    age: 42,
    gender: 'Male',
    room: 'ICU - Bed 04',
    diagnosis: 'Chest pain evaluation',
    doctorName: 'Dr. Rohit Bedi',
    admitDate: '2025-12-01',
  },
  {
    id: 'P-006',
    name: 'Anaya Bansal',
    age: 31,
    gender: 'Female',
    room: 'Ward 4A - Bed 09',
    diagnosis: 'High-risk pregnancy',
    doctorName: 'Dr. Nisha Kapoor',
    admitDate: '2025-12-04',
  },
  {
    id: 'P-007',
    name: 'Reyansh Chawla',
    age: 37,
    gender: 'Male',
    room: 'OPD - 03',
    diagnosis: 'Migraine follow-up',
    doctorName: 'Dr. Arjun Mal',
    admitDate: '2025-12-05',
  },
  {
    id: 'P-008',
    name: 'Siya Khurana',
    age: 22,
    gender: 'Female',
    room: 'Day Care - 02',
    diagnosis: 'IV iron therapy',
    doctorName: 'Dr. Meera Joshi',
    admitDate: '2025-12-04',
  },
  {
    id: 'P-009',
    name: 'Advait Reddy',
    age: 55,
    gender: 'Male',
    room: 'Ward 5D - Bed 11',
    diagnosis: 'Hypertension management',
    doctorName: 'Dr. Kavita Rao',
    admitDate: '2025-11-28',
  },
  {
    id: 'P-010',
    name: 'Kiara Oberoi',
    age: 29,
    gender: 'Female',
    room: 'Ward 2B - Bed 01',
    diagnosis: 'Pre-op assessment',
    doctorName: 'Dr. Sandeep Rao',
    admitDate: '2025-12-05',
  },
];

export default function PatientScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [searchText, setSearchText] = useState('');

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (
      parts[0].charAt(0).toUpperCase() +
      parts[parts.length - 1].charAt(0).toUpperCase()
    );
  };

  const filteredPatients = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return PATIENTS;
    return PATIENTS.filter((p) => {
      return (
        p.name.toLowerCase().includes(q) ||
        p.room.toLowerCase().includes(q) ||
        p.doctorName.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      );
    });
  }, [searchText]);

  const formatDate = (isoOrString: string) => {
    try {
      const d = new Date(isoOrString);
      if (isNaN(d.getTime())) return isoOrString;
      return d.toLocaleDateString();
    } catch (e) {
      return isoOrString;
    }
  };

  const renderItem = ({ item }: { item: Patient }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.88}
      onPress={() =>
        navigation.navigate('FormType', {
          patientName: item.name,
          patientId: item.id,
        })
      }
    >
      {/* Top row */}
      <View style={styles.cardTopRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
        </View>

        <View style={styles.nameBlock}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.name}</Text>
            {/* <Text style={styles.idText}>{item.id}</Text> */}
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

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {item.gender} • {item.age} yrs
            </Text>

          </View>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.bottomRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.labelText}>Room / Location</Text>
          <Text style={styles.roomText}>{item.room}</Text>

          <Text style={[styles.labelText, { marginTop: 8 }]}>Admit date</Text>
          <Text style={styles.smallText}>{formatDate(item.admitDate)}</Text>
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

          <Text style={[styles.labelText, { marginTop: 8 }]}>Doctor</Text>
          <Text style={styles.smallText}>{item.doctorName}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      style={[styles.container, { paddingTop: insets.top }]}
    >
      {/* Header with Back Icon + Title + Circular Logo   */}
      <View style={styles.header}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        {/* Center Title */}
        <View style={{ flex: 1 ,justifyContent: 'center', alignItems: 'center'}}>
          <Text style={styles.headerTitle}>Patients List</Text>
        </View>

        {/* Circular Logo */}
        <Image
          source={{
            uri: 'https://pbs.twimg.com/profile_images/1245651839262965761/vZcdH3RR_400x400.jpg',
          }}
          style={styles.logo}
        />
      </View>

      {/* Content */}
      <View style={styles.contentWrapper}>
        {/* SEARCH moved here (replaces the previous section header placement)
            Search is now shown at the top of the content area above the list */}
        <View style={styles.sectionHeader}>
          <View style={styles.searchWrapperContent}> 
            <Icon name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search by name, ward, doctor or id"
              placeholderTextColor="#64748B"
              value={searchText}
              onChangeText={setSearchText}
              style={styles.searchInputContent}
              returnKeyType="search"
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <Icon name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

        </View>

        <FlatList
          data={filteredPatients}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={() => (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8' }}>No patients match your search.</Text>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
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
  borderRadius: 22.5,   // perfect circle
  marginLeft: 10,
  backgroundColor: '#fff',
},


  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSub: { color: '#E0FFFC', fontSize: 12, marginTop: 2 },

  /* Container for the main content area (was missing) */
  contentWrapper: {
    flex: 1,
    // backgroundColor: '#F1F5F9',
  },

  /* NEW: search inside content area */
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    // paddingBottom: 8,
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

  // Card styles unchanged...
  card: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: '#ffffff',
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    elevation: 3,
  },

  cardTopRow: { flexDirection: 'row', alignItems: 'center' },

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

  nameBlock: { flex: 1 },

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

  idText: { fontSize: 12, color: '#64748B', fontWeight: '600' },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    alignItems: 'center',
  },

  metaText: { fontSize: 13, color: '#475569' },

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
  badgeText: { fontSize: 11, color: '#166534', fontWeight: '600' },

  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 10 },

  bottomRow: { flexDirection: 'row' },

  labelText: {
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 2,
  },

  roomText: { fontSize: 13, color: '#0369A1', fontWeight: '500' },

  diagnosisText: { fontSize: 13, color: '#1E293B' },

  smallText: { fontSize: 13, color: '#0F172A', fontWeight: '600' },
});