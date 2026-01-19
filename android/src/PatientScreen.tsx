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
import { getAdmittedPatients } from './api/admissionsApi';
import AsyncStorage from '@react-native-async-storage/async-storage';


type Patient = {
  id: string;
  patientId: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  room: string;
  diagnosis: string;
  doctorName: string;
  doctorCode: string;
  admitDate: string;
};


type FilterKey = 'name' | 'ward' | 'doctor' | 'ip';
/* ✅ NEW: Person tab type */
type PersonTab = 'IN' | 'OUT';

const ALL_FILTER_KEYS: FilterKey[] = ['name', 'ward', 'doctor', 'ip'];
const STORAGE_KEYS = {
  admissionNo: 'admissionNo',
  patientId: 'patientId',
  doctorCode: 'doctorCode',
};

const savePatientSession = async (
  admissionNo: string,
  patientId: string,
  doctorCode: string
) => {
  try {
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.admissionNo, admissionNo],
      [STORAGE_KEYS.patientId, patientId],
      [STORAGE_KEYS.doctorCode, doctorCode],
    ]);

    console.log('✅ Patient session saved', {
      admissionNo,
      patientId,
      doctorCode,
    });
  } catch (e) {
    console.error('❌ Failed to save patient session', e);
  }
};

const clearPatientSession = async () => {
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.admissionNo,
    STORAGE_KEYS.patientId,
    STORAGE_KEYS.doctorCode,
  ]);
};





export default function PatientScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();


  const [searchText, setSearchText] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  // const [personTab, setPersonTab] = useState<PersonTab>('IN');
  const [personTab, setPersonTab] = useState<PersonTab>('OUT');
  // NEW: filter modal + selected filters
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<FilterKey[]>([
    'name',
    'ward',
    'doctor',
    'doctor',
    'ip',
  ]);
  const [confirmLogoutVisible, setConfirmLogoutVisible] = useState(false); // NEW

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
  const [vitalsData, setVitalsData] = useState({
    temperature: '99.9 °F',
    spo2: '98 %',
    bp: '120/80 mmHg',
    respiration: '16 /min',
    heartRate: '72 bpm',
    weight: '65 kg',      // Weight in kg
    height: '170 cm',     // Height in cm
    bmi: '22.5',          // Will be auto-calculated
  });

  const [editingVital, setEditingVital] = useState<keyof typeof vitalsData | null>(null);



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
      onMoveShouldSetPanResponder: (_, gesture) => {
        // 🔥 Disable swipe when editing vitals
        if (editingVital !== null) return false;

        return Math.abs(gesture.dx) > 15 && Math.abs(gesture.dy) < 30;
      },

      onPanResponderRelease: (_, gesture) => {
        if (editingVital !== null) return;

        if (gesture.dx < -60) setPersonTab('OUT');
        else if (gesture.dx > 60) setPersonTab('IN');
      },
    })
  ).current;
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);


  // Whether filters are in a "custom" state (not all, not none)
  const filtersActive =
    selectedFilters.length > 0 &&
    selectedFilters.length < ALL_FILTER_KEYS.length;
  const filteredPatients = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return patients;

    return patients.filter((p) => {
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
      // if (activeFilters.includes('ip')) {
      //   fields.push(String(p.IP));
      // }

      fields.push(p.id.toLowerCase());

      return fields.some((f) => f.includes(q));
    });
  }, [searchText, selectedFilters, patients]);



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
  const isEditingAnyVital = editingVital !== null;

  /* ✅ UPDATED: Show confirmation instead of immediate logout */
  const handleLogout = () => {
    setConfirmLogoutVisible(true);
  };

  /* ✅ NEW: Perform actual logout */
  const performLogout = async () => {
    setConfirmLogoutVisible(false);
    await clearPatientSession();

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
    const loadPatients = async () => {
      try {
        setLoadingPatients(true);

        const res = await getAdmittedPatients({
          page: 1,
          pageSize: 50,
        });

        console.log('ADMITTED PATIENTS API 👉', res);

        // ✅ res itself is the array
        const apiPatients = Array.isArray(res) ? res : [];


        const mappedPatients = apiPatients.map(mapApiPatientToUiPatient);

        setPatients(mappedPatients);
      } catch (error) {
        console.error('Failed to load patients', error);
        setPatients([]);
      } finally {
        setLoadingPatients(false);
      }
    };

    loadPatients();
  }, []);


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

  const openPatientModal = async (patient: Patient) => {
    setSelectedPatient(patient);

    await savePatientSession(
      patient.id,            // admissionNo
      patient.patientId,     // UHID
      patient.doctorCode     // ✅ CORRECT doctorCode
    );


    setModalVisible(true);

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
      admissionNo: p.id,        // ✅ MDR001
      patientId: p.patientId,   // ✅ UH001
      patientName: p.name,
    });
    console.log('Navigating to FormType with admissionNo:', p.id);
  };

  const toggleFilter = (key: FilterKey) => {
    setSelectedFilters((prev) => {
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  };
  const calculateBMI = () => {
    const weightStr = vitalsData.weight;
    const heightStr = vitalsData.height;

    // Extract numeric values
    const weightMatch = weightStr.match(/^([\d.]+)/);
    const heightMatch = heightStr.match(/^([\d.]+)/);

    if (weightMatch && heightMatch) {
      const weightKg = parseFloat(weightMatch[1]);
      const heightCm = parseFloat(heightMatch[1]);

      if (weightKg > 0 && heightCm > 0) {
        const heightM = heightCm / 100; // Convert cm to meters
        const bmi = weightKg / (heightM * heightM);
        const roundedBMI = bmi.toFixed(1);

        setVitalsData(prev => ({
          ...prev,
          bmi: roundedBMI
        }));
      }
    }
  };

  const handleClearFilters = () => {
    setSelectedFilters([]);
  };
  const clearVital = (key: keyof typeof vitalsData) => {
    const currentValue = vitalsData[key];
    const unitMatch = currentValue.match(/\s*([^\d./]+)$/); // Extract unit from the end

    if (unitMatch) {
      // Keep only the unit, clear the number part
      setVitalsData(prev => ({ ...prev, [key]: unitMatch[1].trim() }));
    } else {
      // No unit, clear everything
      setVitalsData(prev => ({ ...prev, [key]: '' }));
    }

    setEditingVital(key);
  };

  const updateVital = (key: keyof typeof vitalsData, value: string) => {
    setVitalsData(prev => ({ ...prev, [key]: value }));

    // If updating weight or height, recalculate BMI
    if (key === 'weight' || key === 'height') {
      // Use setTimeout to ensure state update happens first
      setTimeout(() => {
        calculateBMI();
      }, 0);
    }
  };
  const saveVital = () => {
    setEditingVital(null);
  };
  const VitalTile = ({
    label,
    value,
    vitalKey,
  }: {
    label: string;
    value: string;
    vitalKey: keyof typeof vitalsData;
  }) => {
    // Enhanced function to separate number and unit
    const separateNumberAndUnit = (val: string) => {
      if (!val || val === '--') return { number: '', unit: '' };

      // Extract unit (anything after numbers, decimal points, and slashes)
      const match = val.match(/^([\d./]+)?\s*(.*)$/);

      if (match) {
        return {
          number: match[1] ? match[1].trim() : '',
          unit: match[2] ? match[2].trim() : ''
        };
      }

      return { number: '', unit: val.trim() };
    };

    const { number: displayNumber, unit } = separateNumberAndUnit(value);
    const [editingNumber, setEditingNumber] = useState(displayNumber);
    const [editingUnit] = useState(unit); // Unit is read-only for editing

    useEffect(() => {
      if (editingVital !== vitalKey) {
        const { number } = separateNumberAndUnit(value);
        setEditingNumber(number);
      }
    }, [value, editingVital, vitalKey]);

    const handleStartEdit = () => {
      if (vitalKey === 'bmi') return;
      setEditingVital(vitalKey);
    };

    const handleSave = () => {
      // Combine number with existing unit
      const savedValue = (editingNumber || '') + (unit ? ` ${unit}` : '');
      updateVital(vitalKey, savedValue);
      setEditingVital(null);
    };

    const handleClear = () => {
      // Clear the input field
      setEditingNumber('');
    };

    const handleClearAll = () => {
      // When not editing, clear number but keep unit
      updateVital(vitalKey, unit ? unit : '');
    };

    const currentIsEditing = editingVital === vitalKey;
    const isEditable = vitalKey !== 'bmi';

    return (
      <View style={styles.vitalTile}>
        {/* Header row: Label + Edit icon */}
        <View style={styles.vitalHeaderRow}>
          <Text style={styles.vitalLabel}>{label}</Text>

          {isEditable && (
            <TouchableOpacity
              onPress={() =>
                currentIsEditing ? handleSave() : handleStartEdit()
              }
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Feather
                name={currentIsEditing ? 'check' : 'edit-2'}
                size={14}
                color="#0EA5A4"
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Value row */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {currentIsEditing ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <TextInput
                placeholder="Enter value"
                style={[styles.vitalInput, { flex: 1 }]}
                value={editingNumber}
                onChangeText={setEditingNumber}
                keyboardType={
                  vitalKey === 'bp'
                    ? 'numbers-and-punctuation'
                    : vitalKey === 'weight' ||
                      vitalKey === 'height' ||
                      vitalKey === 'temperature' ||
                      vitalKey === 'spo2'
                      ? 'decimal-pad'
                      : 'numeric'
                }
                autoFocus
                onSubmitEditing={handleSave}
              />
              {unit && <Text style={styles.vitalUnit}>{unit}</Text>}
            </View>
          ) : (
            <Text style={styles.vitalValue}>
              {displayNumber || '--'}
              {unit && <Text style={styles.vitalUnit}> {unit}</Text>}
            </Text>
          )}
        </View>
      </View>
    );

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
                <Text style={styles.metaText}>UHID: {item.patientId}</Text>

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
  const goToRxNotes = () => {
    if (!selectedPatient) return;

    const patient = selectedPatient;

    // ✅ Close modal FIRST
    closePatientModal();

    // ⏱️ Small delay so close animation finishes
    setTimeout(() => {
      navigation.navigate('RxNotes', {
        patient,
        vitals: vitalsData,
      });
    }, 200);
  };


  const getVitalsForPatient = (p: Patient | null) => {
    return {
      temperature: '99.9 °F',
      spo2: '98 %',
      bp: '120/80 mmHg',
      respiration: '16 /min',
      heartRate: '72 bpm',
      weight: '65 kg',
      height: '170 cm',
      bmi: '22.5',
    };
  };
  const vitals = getVitalsForPatient(selectedPatient);
  const [modalLayout, setModalLayout] = useState<{
    y: number;
    height: number;
  } | null>(null);

  const [vitalsLayout, setVitalsLayout] = useState<{
    height: number;
  } | null>(null);


  const mapApiPatientToUiPatient = (apiPatient: any): Patient => {
    return {
      id: String(apiPatient?.admissionNo ?? ''),
      patientId: String(apiPatient?.patientId ?? ''),
      name: apiPatient?.patientName ?? 'Unknown',
      age: Number(apiPatient?.age ?? 0),
      gender: apiPatient?.gender ?? 'Other',
      room: `${apiPatient?.wardName ?? ''} - ${apiPatient?.bedNo ?? ''}`,
      diagnosis: apiPatient?.admissionStatus ?? 'Admitted',
      doctorName: apiPatient?.currentDoctorName ?? '—',
      doctorCode: apiPatient?.currentDoctorCode ?? '', // ✅ ADD THIS
      admitDate: apiPatient?.admissionDtTm ?? new Date().toISOString(),
    };
  };






  // modal shift value when vitals are visible — you can tune this number
  // const modalExtraShiftWhenVitals = vitalsVisible ? 50 : 24;

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
      <View {...(!editingVital ? panResponder.panHandlers : {})}>

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


        </View>
      </View>

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


        {loadingPatients ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: '#0F172A' }}>Loading patients...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredPatients}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}

      </View>


      <Modal
        transparent
        visible={modalVisible}
        animationType="none"
        onRequestClose={closePatientModal}
      >

        <View
          style={styles.modalBackdrop}
          onStartShouldSetResponderCapture={() => false}
          onMoveShouldSetResponderCapture={() => false}
        >

          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            disabled={isEditingAnyVital}
            onPress={closePatientModal}
          />

          {vitalsVisible && selectedPatient && (
            <Animated.View
              pointerEvents="box-none"
              style={[
                styles.vitalsCard,
                {
                  opacity: vitalsOpacity,
                  transform: [{ scale: vitalsScale }],
                },
              ]}
            >

              <TouchableOpacity
                onPress={toggleVitals}
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
                {/* Row 1 */}
                <View style={styles.vitalRowContainer}>
                  <VitalTile label="Temperature" vitalKey="temperature" value={vitalsData.temperature} />
                  <VitalTile label="SPO₂" vitalKey="spo2" value={vitalsData.spo2} />
                  <VitalTile label="Blood Pressure" vitalKey="bp" value={vitalsData.bp} />
                </View>

                {/* Row 2 */}
                <View style={styles.vitalRowContainer}>
                  <VitalTile label="Respiration" vitalKey="respiration" value={vitalsData.respiration} />
                  <VitalTile label="Heart Rate" vitalKey="heartRate" value={vitalsData.heartRate} />
                  <VitalTile label="Weight" vitalKey="weight" value={vitalsData.weight} />
                </View>

                {/* Row 3 */}
                <View style={styles.vitalRowContainer}>
                  <VitalTile label="Height" vitalKey="height" value={vitalsData.height} />
                  <VitalTile label="BMI" vitalKey="bmi" value={vitalsData.bmi} />
                  {/* Empty space for alignment */}
                  <View style={styles.emptyVitalTile} />
                </View>
              </View>

            </Animated.View>
          )}

          <Animated.View
            pointerEvents="box-none"
            style={[

              styles.modalCard,
              {
                opacity: opacityAnim,
                transform: [
                  { scale: scaleAnim },
                  { translateY: translateYAnim },
                  // { translateY: modalExtraShiftWhenVitals },
                  { translateY: translateYAnim },
                ],
              },
            ]}
          >
            <View style={styles.modalAccentStrip} />

            <Animated.View
              style={[
                styles.modalHeroCircle,
                { transform: [{ scale: heroPulse }] },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  toggleVitals();
                }}
                style={styles.modalHeroInnerTouchable}
              >
                <View style={styles.modalHeroInnerCircle}>
                  <FA5 name="heartbeat" size={42} color="#0EA5A4" />
                </View>
              </TouchableOpacity>
            </Animated.View>

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
                keyboardShouldPersistTaps="handled"
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
                          {/* {personTab === 'OUT' ? 'Visit No:' : 'IP:'} {selectedPatient.IP} */}
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

                  <View style={[styles.infoTile, styles.rxNotesButtonContainer]}>
                    <TouchableOpacity
                      style={styles.rxNotesButton}
                      activeOpacity={0.8}
                      onPress={goToRxNotes}


                    >
                      <Icon name="document-text-outline" size={14} color="#0EA5A4" style={{ marginRight: 4 }} />
                      <Text style={styles.rxNotesText}>RxNotes</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            )}
          </Animated.View>
        </View>
      </Modal>

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


      {/* ✅ NEW: Logout Confirmation Modal */}
      < Modal
        visible={confirmLogoutVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmLogoutVisible(false)
        }
      >
        <View style={styles.confirmModalBackdrop}>
          <View style={styles.confirmModalCard}>
            <Text style={styles.confirmModalMessage}>Are you sure you want to logout?</Text>
            <View style={styles.confirmModalButtonsRow}>
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.confirmModalCancel]}
                onPress={() => setConfirmLogoutVisible(false)}
              >
                <Text style={[styles.confirmModalButtonText, styles.confirmModalCancelText]}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.confirmModalConfirm]}
                onPress={performLogout}
              >
                <Text style={[styles.confirmModalButtonText, styles.confirmModalConfirmText]}>Yes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal >

    </SafeAreaView >
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

  logo: {
    width: 60,
    height: 45,
    marginRight: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  vitalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  rxNotesButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',  // Changed from '#0EA5A4' to white
    borderColor: '#0EA5A4',     // Changed from '#fff' to teal
    borderWidth: 2,
    width: "15%",
    height: "20%",
    borderRadius: 15,
    marginLeft: 4,
  },

  rxNotesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    width: '100%',
  },

  rxNotesText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0EA5A4',  // Changed from '#fff' to teal
  },
  vitalClearBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderColor: "4d4848ff",
    borderWidth: 1,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },

  vitalInput: {
    borderBottomWidth: 1,
    borderColor: '#CBD5F5',
    fontSize: 14,
    paddingVertical: 8, // Increased padding
    paddingHorizontal: 0,
    width: '100%',
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  vitalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 4,
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
    height: '31%',
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
    width: '50%',
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
    top: '10%',
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

  vitalUnit: {
    fontSize: 12,
    fontWeight: '400',
    color: '#64748B',
    marginLeft: 2,
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
  vitalsGrid: {
    width: '100%',
  },

  vitalRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  vitalTile: {
    width: '31%', // 3 per row with small gaps
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'flex-start',
  },

  emptyVitalTile: {
    width: '31%',
    // Invisible placeholder for alignment
  },
  // Add ONLY these 3 new styles:
  modalsContainer: {
    width: '94%',
    alignItems: 'center',
    maxHeight: '85%',
  },

  modalsContainerWithVitals: {
    // Keep this empty for now
  },

  vitalsCloseButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 6,
    zIndex: 20,
  },

  // ✅ NEW: Confirmation Modal Styles (Matched with FormImageEditor)
  confirmModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)', // dim background
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  confirmModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 10,
  },
  confirmModalMessage: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 24,
  },
  confirmModalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  confirmModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  confirmModalCancel: {
    backgroundColor: '#F3F4F6', // light gray
  },
  confirmModalConfirm: {
    backgroundColor: '#0EA5A4', // teal
  },
  confirmModalButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmModalCancelText: {
    color: '#374151',
  },
  confirmModalConfirmText: {
    color: '#ffffff',
  },
});
