// src/RxNotes.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';

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

type Vitals = {
  temperature: string;
  spo2: string;
  bp: string;
  respiration: string;
  heartRate: string;
  weight: string;
  height: string;
  bmi: string;
};

const SEVERITY_OPTIONS = ['Mild', 'Moderate', 'Severe'] as const;

export default function RxNotes() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const { patient, vitals: incomingVitals } = route.params as {
    patient: Patient;
    vitals: Vitals;
  };

  const [vitals, setVitals] = useState<Vitals>({ ...incomingVitals });
  const [editingVital, setEditingVital] = useState<keyof Vitals | null>(null);

  const [symptomSince, setSymptomSince] = useState('');
//   const [severity, setSeverity] =
//     useState<(typeof SEVERITY_OPTIONS)[number]>('Mild');
  const [notes, setNotes] = useState('');

  /* ───────── Helpers ───────── */

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map(p => p[0])
      .join('')
      .toUpperCase();

  const extractNumber = (v: string) =>
    v?.match(/[\d.]+/)?.[0] ?? '';

  const updateVitalNumber = (key: keyof Vitals, number: string) => {
    const units: Record<keyof Vitals, string> = {
      temperature: '°F',
      spo2: '%',
      bp: '',
      respiration: '/min',
      heartRate: 'bpm',
      weight: 'kg',
      height: 'cm',
      bmi: '',
    };

    const newValue = number ? `${number} ${units[key]}`.trim() : '';
    setVitals(prev => ({ ...prev, [key]: newValue }));
  };

  /* BMI auto-calc */
  useEffect(() => {
    const w = parseFloat(extractNumber(vitals.weight));
    const h = parseFloat(extractNumber(vitals.height));

    if (w > 0 && h > 0) {
      const bmi = (w / Math.pow(h / 100, 2)).toFixed(1);
      setVitals(prev => ({ ...prev, bmi }));
    }
  }, [vitals.weight, vitals.height]);
  const handleSaveSymptoms = () => {
    // 🔴 VALIDATION
    if (!complaints.trim()) {
      Alert.alert('Error', 'Please enter complaints');
      return;
    }
  
    if (!symptomSince.trim()) {
      Alert.alert('Error', 'Please enter since duration');
      return;
    }
  
    if (!severity) {
      Alert.alert('Error', 'Please select severity');
      return;
    }
  
    // ✅ If validation passes
    const payload = {
      complaints,
      symptomSince: `${symptomSince} ${sinceUnit}`,
      severity,
      notes,
    };
  
    console.log('Saved Symptoms:', payload);
  
    Alert.alert(
      'Saved',
      'Symptoms saved successfully',
      [{ text: 'OK' }],
      { cancelable: true }
    );
  };
  
  const renderVital = (
    label: string,
    key: keyof Vitals,
    unit?: string,
    editable = true,
  ) => {
    const isEditing = editingVital === key;
    
 


    return (
      <View style={styles.vitalTile}>
        <View style={styles.vitalHeader}>
          <Text style={styles.vitalLabel}>{label}</Text>
          {editable && (
            <TouchableOpacity
              onPress={() =>
                setEditingVital(isEditing ? null : key)
              }
            >
              <Feather
                name={isEditing ? 'check' : 'edit-2'}
                size={14}
                color="#0EA5A4"
              />
            </TouchableOpacity>
          )}
        </View>

        {isEditing ? (
          <View style={styles.vitalEditRow}>
            <TextInput
              value={extractNumber(vitals[key])}
              onChangeText={v => updateVitalNumber(key, v)}
              keyboardType="numeric"
              autoFocus
              style={styles.vitalInput}
            />
            {unit && <Text style={styles.unit}>{unit}</Text>}
          </View>
        ) : (
          <Text style={styles.vitalValue}>
            {vitals[key] || '--'}
          </Text>
        )}
      </View>
    );
  };
     const [sinceUnit, setSinceUnit] = useState<'Days' | 'Months' | 'Years'>('Days');
const [sinceOpen, setSinceOpen] = useState(false);
const [severity, setSeverity] =
  useState<(typeof SEVERITY_OPTIONS)[number]>('Mild');
const [severityOpen, setSeverityOpen] = useState(false);
const [complaints, setComplaints] = useState('');


  /* ───────── UI ───────── */

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rx Notes</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'android' ? 'height' : 'padding'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {/* Patient Details */}
          <View style={styles.patientCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getInitials(patient.name)}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>{patient.name}</Text>

              <View style={styles.ageChip}>
                <Text style={styles.ageText}>
                  {patient.gender} • {patient.age} yrs
                </Text>
              </View>

              <Text style={styles.meta}>UHID: {patient.IP}</Text>
              <Text style={styles.meta}>Room: {patient.room}</Text>
              <Text style={styles.meta}>
                Doctor: {patient.doctorName}
              </Text>
            </View>
          </View>

          {/* Vitals */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Vitals</Text>
            <View style={styles.grid}>
              {renderVital('Temp', 'temperature', '°F')}
              {renderVital('SpO₂', 'spo2', '%')}
              {renderVital('BP', 'bp')}
              {renderVital('Resp', 'respiration', '/min')}
              {renderVital('HR', 'heartRate', 'bpm')}
              {renderVital('Weight', 'weight', 'kg')}
              {renderVital('Height', 'height', 'cm')}
              {renderVital('BMI', 'bmi', '', false)}
            </View>
          </View>
{/* Symptoms */}
<View style={styles.card}>
  <Text style={styles.sectionTitle}>Symptoms</Text>

  {/* Since + Severity in same row */}
<View style={styles.symptomRow}>
  {/* Complaints */}
  <View style={{ flex: 1.4 }}>
    <Text style={styles.inputLabel}>Complaints</Text>
    <TextInput
      placeholder="e.g. Fever, cough"
      value={complaints}
      onChangeText={setComplaints}
      style={styles.input}
      numberOfLines={1}
    />
  </View>

  <View style={{ flex: 1, marginLeft: 8 }}>
  <Text style={styles.inputLabel}>Since</Text>

  <View style={{ position: 'relative' }}>
    <View style={styles.sinceInputWrapper}>
      <TextInput
        // placeholder="3"
        value={symptomSince}
        onChangeText={setSymptomSince}
        keyboardType="number-pad"
        style={styles.sinceInput}
      />

      <View style={styles.sinceDivider} />

      <TouchableOpacity
        onPress={() => setSinceOpen(prev => !prev)}
        style={styles.sinceUnitButton}
      >
        <Text style={styles.sinceUnitText}>{sinceUnit}</Text>
        <Feather name="chevron-down" size={14} color="#64748B" />
      </TouchableOpacity>
    </View>

    {/* 🔽 DROPDOWN */}
    {sinceOpen && (
      <View style={styles.unitMenuInside}>
        {(['Days', 'Months', 'Years'] as const).map(u => (
          <TouchableOpacity
            key={u}
            style={styles.unitOption}
            onPress={() => {
              setSinceUnit(u);
              setSinceOpen(false);
            }}
          >
            <Text style={styles.unitOptionText}>{u}</Text>
          </TouchableOpacity>
        ))}
      </View>
    )}
  </View>
</View>

  {/* Severity */}
  <View style={{ flex: 1, marginLeft: 8 }}>
    <Text style={styles.inputLabel}>Severity</Text>

    <View style={styles.severityInputWrapper}>
      <TouchableOpacity
        onPress={() => setSeverityOpen(prev => !prev)}
        style={styles.severityButton}
      >
        <Text style={styles.severityValue}>{severity}</Text>
        <Feather name="chevron-down" size={14} color="#64748B" />
      </TouchableOpacity>

      {severityOpen && (
        <View style={styles.severityMenu}>
          {SEVERITY_OPTIONS.map(s => (
            <TouchableOpacity
              key={s}
              onPress={() => {
                setSeverity(s);
                setSeverityOpen(false);
              }}
              style={styles.severityOption}
            >
              <Text
                style={[
                  styles.severityOptionText,
                  severity === s && {
                    color: '#0EA5A4',
                    fontWeight: '600',
                  },
                ]}
              >
                {s}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  </View>
</View>


  {/* Notes */}
  <TextInput
    placeholder="Add Notes..."
    value={notes}
    onChangeText={setNotes}
    multiline
    style={styles.notes}
  />
  <TouchableOpacity
  style={styles.saveButton}
  onPress={handleSaveSymptoms}
>
  <Feather name="save" size={16} color="#fff" />
  <Text style={styles.saveButtonText}>Save</Text>
</TouchableOpacity>

</View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ───────── Styles ───────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },

  header: {
    backgroundColor: '#0EA5A4',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    justifyContent: 'space-between',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },

  content: { padding: 16 },

  patientCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
    elevation: 2,
  },

  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E0F2F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  saveButton: {
    marginTop: 12,
    backgroundColor: '#0EA5A4',
    height: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 6,
  },
  
  avatarText: { fontSize: 18, fontWeight: '700', color: '#0EA5A4' },

  patientName: { fontSize: 17, fontWeight: '700' },

  ageChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#ECFEFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginVertical: 4,
  },
  ageText: { fontSize: 12, color: '#0EA5A4', fontWeight: '600' },

  meta: { fontSize: 13, color: '#475569' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    color:"#0EA5A4",
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  vitalTile: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  vitalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  vitalLabel: {
    fontSize: 11,
    color: '#64748B',
    textTransform: 'uppercase',
  },

  vitalValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },

  vitalEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },

  vitalInput: {
    flex: 1,
    borderBottomWidth: 1,
    borderColor: '#0EA5A4',
    fontSize: 15,
  },

  unit: { marginLeft: 6, fontSize: 12, color: '#64748B' },

  input: {
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },

//   severityRow: { flexDirection: 'row', marginBottom: 10 },

  severityChip: {
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6,
  },

  severityChipActive: {
    backgroundColor: '#ECFEFF',
    borderColor: '#0EA5A4',
  },

  severityText: { fontSize: 12, color: '#64748B' },
  severityTextActive: { color: '#0EA5A4', fontWeight: '600' },

  notes: {
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 8,
    padding: 10,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  symptomRow: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  marginBottom: 10,
},

inputLabel: {
  fontSize: 12,
  color: '#64748B',
  marginBottom: 4,
},

severityRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
},
sinceRow: {
  flexDirection: 'row',
  alignItems: 'center',
},

unitDropdown: {
  flexDirection: 'row',
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#CBD5F5',
  borderRadius: 8,
  paddingHorizontal: 10,
  height: 42,
  minWidth: 80,
  justifyContent: 'space-between',
  backgroundColor: '#fff',
},
severityInputWrapper: {
  borderWidth: 1,
  borderColor: '#CBD5F5',
  borderRadius: 8,
  height: 44,
  backgroundColor: '#fff',
  justifyContent: 'center',
},

severityButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 12,
  height: '100%',
},

severityValue: {
  fontSize: 14,
  color: '#334155',
},

severityMenu: {
  position: 'absolute',
  top: 46,
  right: 0,
  left: 0,
  backgroundColor: '#fff',
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#E2E8F0',
  elevation: 5,
  zIndex: 20,
},

severityOption: {
  paddingHorizontal: 12,
  paddingVertical: 10,
},

severityOptionText: {
  fontSize: 14,
  color: '#475569',
},


unitDropdownText: {
  fontSize: 13,
  color: '#334155',
  marginRight: 4,
},

unitMenu: {
  position: 'absolute',
  top: 44,
  right: 0,
  backgroundColor: '#fff',
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#E2E8F0',
  elevation: 4,
  zIndex: 10,
},

unitOption: {
  paddingHorizontal: 12,
  paddingVertical: 8,
},
sinceInputWrapper: {
  flexDirection: 'row',
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#CBD5F5',
  borderRadius: 8,
  height: 44,
  paddingHorizontal: 8,
  backgroundColor: '#fff',
},

sinceInput: {
  flex: 1,
  fontSize: 14,
  paddingVertical: 0,
},

sinceDivider: {
  width: 1,
  height: '60%',
  backgroundColor: '#E2E8F0',
  marginHorizontal: 6,
},

sinceUnitButton: {
  flexDirection: 'row',
  alignItems: 'center',
},

sinceUnitText: {
  fontSize: 13,
  color: '#334155',
  marginRight: 4,
},

unitMenuInside: {
  position: 'absolute',
  top: 46,
  right: 0,
  backgroundColor: '#fff',
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#E2E8F0',
  elevation: 5,
  zIndex: 20,
  minWidth: 100,
},


unitOptionText: {
  fontSize: 13,
  color: '#475569',
},



});
