// src/PatientScreen.tsx
import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Modal,
  Animated,
  Easing,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import FA5 from 'react-native-vector-icons/FontAwesome5';
import Feather from "react-native-vector-icons/Feather";
import { PanResponder } from 'react-native';



type Patient = {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  IP: number;
  room: string;
  diagnosis: string;
  doctorName: string;
  admitDate: string;
};

type FilterKey = 'name' | 'ward' | 'doctor' | 'ip';
/* ✅ NEW: Person tab type */
type PersonTab = 'IN' | 'OUT';

const ALL_FILTER_KEYS: FilterKey[] = ['name', 'ward', 'doctor', 'ip'];

// (patients list unchanged — omitted here to keep snippet short in explanation; include it in the file)
const PATIENTS: Patient[] = [
  {
    id: 'P-001',
    name: 'Aarav Malhotra',
    age: 28,
    gender: 'Male',
    IP: 2005481,
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
    IP: 2005482,
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
    IP: 2005483,
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
    IP: 2005484,
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
    IP: 2005485,
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
    IP: 2005486,
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
    IP: 2005487,
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
    IP: 2005488,
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
    IP: 2005489,
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
    IP: 2005490,
    room: 'Ward 2B - Bed 01',
    diagnosis: 'Pre-op assessment',
    doctorName: 'Dr. Sandeep Rao',
    admitDate: '2025-12-05',
  },
];
const OUT_PATIENTS: Patient[] = [
  {
    id: 'OP-101',
    name: 'Riya Mehta',
    age: 26,
    gender: 'Female',
    IP: 3001001,
    room: 'OPD - 01',
    diagnosis: 'Skin allergy',
    doctorName: 'Dr. Anil Shah',
    admitDate: '2025-12-05',
  },
  {
    id: 'OP-102',
    name: 'Kunal Patel',
    age: 33,
    gender: 'Male',
    IP: 3001002,
    room: 'OPD - 02',
    diagnosis: 'Back pain',
    doctorName: 'Dr. Neha Jain',
    admitDate: '2025-12-05',
  },
  {
    id: 'OP-103',
    name: 'Sneha Iyer',
    age: 41,
    gender: 'Female',
    IP: 3001003,
    room: 'OPD - 05',
    diagnosis: 'Thyroid follow-up',
    doctorName: 'Dr. Kavita Rao',
    admitDate: '2025-12-04',
  },
  {
    id: 'OP-104',
    name: 'Amit Kulkarni',
    age: 50,
    gender: 'Male',
    IP: 3001004,
    room: 'OPD - 08',
    diagnosis: 'Blood pressure check',
    doctorName: 'Dr. Sandeep Rao',
    admitDate: '2025-12-03',
  },
  {
    id: 'OP-105',
    name: 'Tripti Tripathi',
    age: 26,
    gender: 'Female',
    IP: 3001004,
    room: 'OPD - 08',
    diagnosis: 'Blood pressure check',
    doctorName: 'Dr.  Shirish',
    admitDate: '2025-12-10',
  },

  {
    id: 'OP-106',
    name: 'Mayur Khulabkar',
    age: 50,
    gender: 'Male',
    IP: 3001004,
    room: 'OPD - 08',
    diagnosis: 'Blood pressure check',
    doctorName: 'Dr. Baji Rao',
    admitDate: '2025-12-11',
  },
];




export default function PatientScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();


  const [searchText, setSearchText] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [personTab, setPersonTab] = useState<PersonTab>('IN');
  // NEW: filter modal + selected filters
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<FilterKey[]>([
    'name',
    'ward',
    'doctor',
    'ip',
  ]);

  // vitals mini-card visibility (toggled by clicking the Beat icon)
  const [vitalsVisible, setVitalsVisible] = useState(false);

  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(16)).current;
  const heroPulse = useRef(new Animated.Value(1)).current;
  const activeCardScale = useRef(new Animated.Value(1)).current;

  // small animation for vitals card
  const vitalsScale = useRef(new Animated.Value(0.96)).current;
  const vitalsOpacity = useRef(new Animated.Value(0)).current;

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (
      parts[0].charAt(0).toUpperCase() +
      parts[parts.length - 1].charAt(0).toUpperCase()
    );
  };
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 15 && Math.abs(gesture.dy) < 30,

      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < -60) {
          // Swipe LEFT → OUT Patient
          setPersonTab('OUT');
        } else if (gesture.dx > 60) {
          // Swipe RIGHT → IN Patient
          setPersonTab('IN');
        }
      },
    })
  ).current;


  // Whether filters are in a "custom" state (not all, not none)
  const filtersActive =
    selectedFilters.length > 0 &&
    selectedFilters.length < ALL_FILTER_KEYS.length;

  const filteredPatients = useMemo(() => {
    const SOURCE =
      personTab === 'IN' ? PATIENTS : OUT_PATIENTS;

    const q = searchText.trim().toLowerCase();
    if (!q) return SOURCE;

    return SOURCE.filter((p) => {
      const fields: string[] = [];

      const activeFilters =
        selectedFilters.length === 0
          ? ALL_FILTER_KEYS
          : selectedFilters;

      if (activeFilters.includes('name')) {
        fields.push(p.name.toLowerCase());
      }
      if (activeFilters.includes('ward')) {
        fields.push(p.room.toLowerCase());
      }
      if (activeFilters.includes('doctor')) {
        fields.push(p.doctorName.toLowerCase());
      }
      if (activeFilters.includes('ip')) {
        fields.push(String(p.IP).toLowerCase());
      }

      // always allow ID search
      fields.push(p.id.toLowerCase());

      return fields.some((f) => f.includes(q));
    });
  }, [searchText, selectedFilters, personTab]);


  const formatDate = (isoOrString: string) => {
    try {
      const d = new Date(isoOrString);
      if (isNaN(d.getTime())) return isoOrString;
      return d.toLocaleDateString();
    } catch (e) {
      return isoOrString;
    }
  };

  const getAdmissionType = (patient: Patient) => {
    if (/day care/i.test(patient.room)) return 'Day Care';
    if (/opd/i.test(patient.room)) return 'Outpatient visit';
    if (/icu/i.test(patient.room)) return 'ICU Inpatient';
    return 'Inpatient admission';
  };

  const getAdmissionDay = (patient: Patient) => {
    const admit = new Date(patient.admitDate);
    if (isNaN(admit.getTime())) return '';
    const today = new Date();
    const diffMs = today.getTime() - admit.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const dayNum = diffDays >= 0 ? diffDays + 1 : 1;
    return `Day ${dayNum} of admission`;
  };

  const handleLogout = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'CareScribeLogin' }],
    });
  };

  const startHeroPulse = () => {
    heroPulse.setValue(1);
    Animated.loop(
      Animated.sequence([
        Animated.timing(heroPulse, {
          toValue: 1.08,
          duration: 450,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(heroPulse, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
          easing: Easing.in(Easing.ease),
        }),
      ])
    ).start();
  };

  useEffect(() => {
    if (modalVisible) {
      startHeroPulse();
      Animated.timing(activeCardScale, {
        toValue: 0.96,
        duration: 180,
        useNativeDriver: true,
      }).start();
    } else {
      heroPulse.stopAnimation();
      heroPulse.setValue(1);
      Animated.timing(activeCardScale, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    }
  }, [modalVisible]);

  // Animations specifically for vitals show/hide
  const showVitals = () => {
    setVitalsVisible(true);
    vitalsScale.setValue(0.96);
    vitalsOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(vitalsScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 70,
      }),
      Animated.timing(vitalsOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
    ]).start();
  };

  const hideVitals = (cb?: () => void) => {
    Animated.parallel([
      Animated.timing(vitalsScale, {
        toValue: 0.96,
        duration: 140,
        useNativeDriver: true,
        easing: Easing.in(Easing.ease),
      }),
      Animated.timing(vitalsOpacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVitalsVisible(false);
      if (cb) cb();
    });
  };

  // Toggle vitals — called when user clicks the Beat icon
  const toggleVitals = () => {
    if (vitalsVisible) {
      hideVitals();
    } else {
      showVitals();
    }
  };

  const openPatientModal = (patient: Patient) => {
    setSelectedPatient(patient);

    // Do NOT auto-show vitals on open anymore — user must click Beat to toggle
    setModalVisible(true);

    // patient detail anim
    scaleAnim.setValue(0.96);
    opacityAnim.setValue(0);
    translateYAnim.setValue(16);

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 7,
        tension: 70,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(translateYAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
    ]).start();
  };

  const closePatientModal = () => {
    // Hide vitals first (if visible) then hide modal
    const finish = () => {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.96,
          duration: 160,
          useNativeDriver: true,
          easing: Easing.in(Easing.ease),
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 16,
          duration: 150,
          useNativeDriver: true,
          easing: Easing.in(Easing.ease),
        }),
      ]).start(() => {
        setModalVisible(false);
        setSelectedPatient(null);
      });
    };

    if (vitalsVisible) {
      hideVitals(finish);
    } else {
      finish();
    }
  };

  const goToFormType = () => {
    if (!selectedPatient) return;
    const p = selectedPatient;
    closePatientModal();
    navigation.navigate('FormType', {
      patientName: p.name,
      patientId: p.id,
      patientIP: p.IP,
    });
  };

  // ───── Filter logic handlers ─────
  const toggleFilter = (key: FilterKey) => {
    setSelectedFilters((prev) => {
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  };

  const handleClearFilters = () => {
    // Clear all selections (search will behave as "all fields" since we handle empty separately)
    setSelectedFilters([]);
  };

  const renderItem = ({ item }: { item: Patient }) => {
    const isActive = selectedPatient?.id === item.id;

    return (
      <Animated.View
        style={[
          isActive && {
            transform: [{ scale: activeCardScale }],
            opacity: 0.93,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.card,
            isActive && { borderColor: '#0EA5A4', borderWidth: 1 },
          ]}
          activeOpacity={0.9}
          onPress={() => openPatientModal(item)}
        >
          {/* Top row */}
          <View style={styles.cardTopRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
            </View>

            <View style={styles.nameBlock}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{item.name}</Text>
                <View style={styles.badge}>
                  <View style={styles.badgeDot} />
                  <Text style={styles.badgeText}>
                    {personTab === 'OUT' ? 'OutPatient' : 'InPatient'}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>UHID: {item.IP}</Text>
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

              <Text style={[styles.labelText, { marginTop: 8 }]}>
                {personTab === 'OUT' ? 'Visit Date' : 'Admit Date'}
              </Text>
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
      </Animated.View>
    );
  };

  // Simple static vitals for now (replace with live values later)
  const getVitalsForPatient = (p: Patient | null) => {
    // using static values provided by user
    return {
      temperature: '99.9 °F',
      spo2: '98 %',
      bp: '160 / 90 mmHg',
      respiration: '35 /min',
      heartRate: '67 bpm',
    };
  };

  const vitals = getVitalsForPatient(selectedPatient);

  // modal shift value when vitals are visible — you can tune this number
  const modalExtraShiftWhenVitals = vitalsVisible ? 50 : 24;

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header with Logo + Title + Logout */}
      <View style={styles.header}>
        <Image
          source={require('./Images/Sofscript.png')}
          style={styles.logo}
        />

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Patients List</Text>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.7}
          onPress={handleLogout}
        >
          <Icon name="log-out-outline" size={20} color="#0EA5A4" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
      <View style={{}} {...panResponder.panHandlers}>
        <View style={styles.personTabWrapper}>
          <TouchableOpacity
            onPress={() => setPersonTab('OUT')}
            style={[
              styles.personTab,
              personTab === 'OUT' && styles.personTabActive,
            ]}
          >
            <Text
              style={[
                styles.personTabText,
                personTab === 'OUT' && styles.personTabTextActive,
              ]}
            >
              Out Patient
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setPersonTab('IN')}
            style={[
              styles.personTab,
              personTab === 'IN' && styles.personTabActive,
            ]}
          >
            <Text
              style={[
                styles.personTabText,
                personTab === 'IN' && styles.personTabTextActive,
              ]}
            >
              In Patient
            </Text>
          </TouchableOpacity>


        </View></View>

      {/* Content */}
      <View style={styles.contentWrapper}>
        <View style={styles.sectionHeader}>
          <View style={styles.searchRow}>
            {/* Search box */}
            <View style={styles.searchWrapperContent}>
              <Icon
                name="search"
                size={18}
                color="#94A3B8"
                style={{ marginRight: 8 }}
              />
              <TextInput
                multiline={false}
                placeholder="Search by Name, Ward, Doctor or Patient No"
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

            {/* Filter icon on same row */}
            <TouchableOpacity
              style={[
                styles.filterButton,
                filtersActive && styles.filterButtonActive,
              ]}
              activeOpacity={0.8}
              onPress={() => setFilterModalVisible(true)}
            >
              <Icon
                name="filter"
                size={18}
                color={filtersActive ? '#0EA5A4' : '#64748B'}
              />
            </TouchableOpacity>
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
              <Text style={{ color: 'white' }}>
                No patients match your search.
              </Text>
            </View>
          )}
        />
      </View>




      {/* Stylish popup / modal (Patient details) */}
      <Modal
        transparent
        visible={modalVisible}
        animationType="none"
        onRequestClose={closePatientModal}
      >
        <View style={styles.modalBackdrop}>
          {/* Click outside to close */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closePatientModal}
          />

          {/* Vitals mini-card (shows only when vitalsVisible true) */}
          {vitalsVisible && selectedPatient && (
            <Animated.View
              style={[
                styles.vitalsCard,
                {
                  opacity: vitalsOpacity,
                  transform: [{ scale: vitalsScale }],
                },
              ]}
            >
              <TouchableOpacity
                onPress={toggleVitals}   // <-- your open/close function
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  padding: 6,
                  zIndex: 20,
                }}
              >
                <Feather name="x" size={22} color="#444" />
              </TouchableOpacity>
              <View style={styles.vitalsHeaderRow}>
                <FA5 name="stethoscope" size={18} color="#0EA5A4" />
                <Text style={styles.vitalsHeaderText}>Recent Vitals</Text>
              </View>

              <View style={styles.vitalsGrid}>
                <View style={styles.vitalTile}>
                  <Text style={styles.vitalLabel}>Temperature</Text>
                  <Text style={styles.vitalValue}>{vitals.temperature}</Text>
                </View>

                <View style={styles.vitalTile}>
                  <Text style={styles.vitalLabel}>SPO₂</Text>
                  <Text style={styles.vitalValue}>{vitals.spo2}</Text>
                </View>

                <View style={styles.vitalTile}>
                  <Text style={styles.vitalLabel}>Blood Pressure</Text>
                  <Text style={styles.vitalValue}>{vitals.bp}</Text>
                </View>

                <View style={styles.vitalTile}>
                  <Text style={styles.vitalLabel}>Respiration</Text>
                  <Text style={styles.vitalValue}>{vitals.respiration}</Text>
                </View>

                {/* Last tile full-width */}
                <View style={[styles.vitalTile, { width: '100%', marginTop: 6 }]}>
                  <Text style={styles.vitalLabel}>Heart Rate</Text>
                  <Text style={styles.vitalValue}>{vitals.heartRate}</Text>
                </View>
              </View>
            </Animated.View>
          )}

          <Animated.View
            style={[
              styles.modalCard,
              {
                opacity: opacityAnim,
                transform: [
                  { scale: scaleAnim },
                  { translateY: translateYAnim },
                  // extra numeric translate to push patient details down when vitals are visible
                  { translateY: modalExtraShiftWhenVitals },
                ],
              },
            ]}
          >
            {/* Accent strip on left */}
            <View style={styles.modalAccentStrip} />

            {/* Hero circular icon (half inside, half outside) */}
            <Animated.View
              style={[
                styles.modalHeroCircle,
                { transform: [{ scale: heroPulse }] },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  // Toggle vitals only when user taps the heartbeat icon (Beat)
                  toggleVitals();
                }}
                style={styles.modalHeroInnerTouchable}
              >
                <View style={styles.modalHeroInnerCircle}>
                  <FA5 name="heartbeat" size={42} color="#0EA5A4" />
                </View>
              </TouchableOpacity>
            </Animated.View>

            {/* Floating arrow with border (60% in, 40% out) */}
            <TouchableOpacity
              onPress={goToFormType}
              style={styles.modalArrowOuter}
              activeOpacity={0.9}
            >
              <View style={styles.modalArrowButton}>
                <Icon name="arrow-forward" size={22} color="#ffffff" />
              </View>
            </TouchableOpacity>

            {selectedPatient && (
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Top row: avatar + name + tags */}
                <View style={[styles.modalTopRow, { marginTop: 18 }]}>
                  <View style={styles.modalAvatar}>
                    <Text style={styles.modalAvatarText}>
                      {getInitials(selectedPatient.name)}
                    </Text>
                  </View>

                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.modalName}>{selectedPatient.name}</Text>

                    <View style={styles.modalChipsRow}>
                      <View style={styles.chip}>
                        <Icon
                          name={
                            selectedPatient.gender === 'Male'
                              ? 'male'
                              : selectedPatient.gender === 'Female'
                                ? 'female'
                                : 'person'
                          }
                          size={14}
                          color="#0EA5A4"
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.chipText}>
                          {selectedPatient.gender} • {selectedPatient.age} yrs
                        </Text>
                      </View>

                      <View style={[styles.chip, { marginLeft: 6 }]}>
                        <Icon
                          name="barcode-outline"
                          size={14}
                          color="#0EA5A4"
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.chipText}>
                          {personTab === 'OUT' ? 'Visit No:' : 'IP:'} {selectedPatient.IP}
                        </Text>

                      </View>
                    </View>

                    <View style={[styles.modalChipsRow, { marginTop: 6 }]}>
                      <View style={[styles.chipSoft]}>
                        <Icon
                          name="bed-outline"
                          size={13}
                          color="#0EA5A4"
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.chipSoftText}>
                          {getAdmissionType(selectedPatient)}
                        </Text>
                      </View>

                      {!/opd|day care/i.test(selectedPatient.room) && (
                        <View style={[styles.chipSoft, { marginLeft: 6 }]}>
                          <Icon
                            name="time-outline"
                            size={13}
                            color="#0EA5A4"
                            style={{ marginRight: 4 }}
                          />
                          <Text style={styles.chipSoftText}>
                            {getAdmissionDay(selectedPatient)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Rectangular info grid */}
                <View style={styles.infoGrid}>
                  <View style={styles.infoTile}>
                    <Text style={styles.infoLabel}>Room / Location</Text>
                    <Text style={styles.infoValue}>{selectedPatient.room}</Text>
                  </View>
                  <View style={styles.infoTile}>
                    <Text style={styles.infoLabel}>Admit Date</Text>

                    <Text style={styles.infoValue}>
                      {formatDate(selectedPatient.admitDate)}
                    </Text>
                  </View>
                  <View style={styles.infoTile}>
                    <Text style={styles.infoLabel}>Primary Concern</Text>
                    <Text
                      style={styles.infoValue}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {selectedPatient.diagnosis}
                    </Text>
                  </View>
                  <View style={styles.infoTile}>
                    <Text style={styles.infoLabel}>Doctor</Text>
                    <Text style={styles.infoValue}>
                      {selectedPatient.doctorName}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}
          </Animated.View>
        </View>
      </Modal>

      {/* NEW: Filter modal */}
      <Modal
        transparent
        visible={filterModalVisible}
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.filterModalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setFilterModalVisible(false)}
          />
          <View style={styles.filterModalCard}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterTitle}>Search Filters</Text>
              <TouchableOpacity onPress={handleClearFilters}>
                <Icon name="trash-outline" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterOptionsWrapper}>
              {[
                { key: 'name' as FilterKey, label: 'Name' },
                { key: 'ward' as FilterKey, label: 'Ward' },
                { key: 'doctor' as FilterKey, label: 'Doctor' },
                { key: 'ip' as FilterKey, label: 'IP No' },
              ].map((opt) => {
                const isSelected = selectedFilters.includes(opt.key);
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.filterOptionRow,
                      isSelected && styles.filterOptionRowActive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => toggleFilter(opt.key)}
                  >
                    <Icon
                      name={
                        isSelected ? 'checkbox-outline' : 'square-outline'
                      }
                      size={20}
                      color={isSelected ? '#0EA5A4' : '#94A3B8'}
                      style={{ marginRight: 10 }}
                    />
                    <Text style={styles.filterOptionLabel}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.filterFooter}>
              <TouchableOpacity
                style={styles.filterDoneButton}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.filterDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  logo: {
    width: 60,
    height: 45,
    marginRight: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
  },

  headerCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },

  contentWrapper: {
    flex: 1,
  },

  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: '#F1F5F9',
  },

  // NEW: row containing search + filter icon
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  searchWrapperContent: {
    flex: 1,
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

  // NEW: filter icon button
  filterButton: {
    marginLeft: 8,
    marginBottom: 10,
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5F0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  filterButtonActive: {
    borderColor: '#0EA5A4',
    backgroundColor: '#ECFEFF',
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

  metaRow: {
    marginTop: 4,
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

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  logoutText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#0EA5A4',
  },

  // ───────── Modal styles (Patient) ─────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },

  modalCard: {
    width: '94%', // almost full width
    borderRadius: 24, // nicer round corners
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 44, // space for hero circle
    paddingBottom: 16,
    elevation: 16,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    position: 'relative',
    overflow: 'visible', // allow icons to be half outside
    height: '25%',
    borderColor: '#0EA5A4',
    borderWidth: 5,
    zIndex: 20,
  },

  modalAccentStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    // backgroundColor: '#0EA5A4',
  },

  modalHeroCircle: {
    position: 'absolute',
    top: -32,
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0EA5A433',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalHeroInnerTouchable: {
    // Provide a touchable hit area for the heartbeat "Beat" icon
    width: 54,
    height: 54,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalHeroInnerCircle: {
    width: 54,
    height: 54,
    borderRadius: 28,
    backgroundColor: '#e9f0f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },

  modalArrowOuter: {
    position: 'absolute',
    top: '20%',
    right: 15,
    marginTop: -24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },

  modalArrowButton: {
    width: 36,
    height: 36,
    borderRadius: 20,
    backgroundColor: '#0EA5A4',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalScroll: {
    flex: 1,
  },

  modalScrollContent: {
    paddingBottom: 10,
  },

  modalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  modalAvatar: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#0EA5A41A',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalAvatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0EA5A4',
  },

  modalName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  personTabActive: {
    backgroundColor: '#fff',
    elevation: 2,
  },

  personTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },

  personTabTextActive: {
    color: '#0EA5A4',
  },

  modalChipsRow: {
    flexDirection: 'row',
    marginTop: 6,
    flexWrap: 'wrap',
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },

  chipText: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '500',
  },

  chipSoft: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#ECFEFF',
  },

  chipSoftText: {
    fontSize: 11,
    color: '#0F172A',
    fontWeight: '500',
  },

  // Rectangular info grid
  infoGrid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  infoTile: {
    width: '48%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    backgroundColor: '#F8FAFC',
  },

  infoLabel: {
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  infoValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
  },

  personTabWrapper: {
    flexDirection: 'row',
    backgroundColor: '#cdd3dbff',
    borderRadius: 20,
    padding: 3,
    marginBottom: 10,
    marginHorizontal: 20,
  },

  personTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
  },

  // ───────── Vitals card styles ─────────
  vitalsCard: {
    position: 'absolute',
    // moved vitals a bit higher so it sits clearly above the patient modal
    top: '18%',
    width: '86%',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FFFFFF',
    elevation: 22,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    alignItems: 'center',
    zIndex: 30,
  },

  vitalsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 8,
    justifyContent: "center"
  },

  vitalsHeaderText: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },

  vitalsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  vitalTile: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'flex-start',
  },

  vitalLabel: {
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'uppercase',
  },

  vitalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
  },

  // ───────── Filter modal styles ─────────
  filterModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  filterModalCard: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    elevation: 8,
  },

  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  filterTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },

  filterOptionsWrapper: {
    marginTop: 6,
  },

  filterOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },

  filterOptionRowActive: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 6,
  },

  filterOptionLabel: {
    fontSize: 14,
    color: '#0F172A',
  },

  filterFooter: {
    marginTop: 8,
    alignItems: 'flex-end',
  },

  filterDoneButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#0EA5A4',
  },

  filterDoneText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
