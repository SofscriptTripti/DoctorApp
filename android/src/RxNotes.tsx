import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  BackHandler,
  AppState,
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
  patientId: number;
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

type DiagnosisItem = {
  id: string;
  code: string;
  doctor: string;
  description: string;
  type: 'Provisional' | 'Final' | '';
  date: string;
};

type SymptomItem = {
  id: string;
  complaint: string;
  since: string;
  unit: 'Days' | 'Weeks' |'Months' | 'Years';
  severity: 'Mild' | 'Moderate' | 'Severe';
  notes: string;
  date: string;
};

type RxNotesData = {
  vitals: Vitals;
  symptoms: SymptomItem[];
  doctorNote: string;
  prescription: string;
  currentDiagnosis: DiagnosisItem[];
  pastDiagnosis: DiagnosisItem[];
  lastSaved: string;
};

const SEVERITY_OPTIONS = ['Mild', 'Moderate', 'Severe'] as const;
const SINCE_UNITS = ['Days', 'Weeks', 'Months', 'Years'] as const;

const DIAGNOSIS_TYPE_OPTIONS = ['Provisional', 'Final'] as const;

const VITALS_CONFIG = [
  { label: 'Temp', key: 'temperature', unit: '°F', editable: true },
  { label: 'SpO₂', key: 'spo2', unit: '%', editable: true },
  { label: 'BP', key: 'bp', unit: '', editable: true },
  { label: 'Resp', key: 'respiration', unit: '/min', editable: true },
  { label: 'HR', key: 'heartRate', unit: 'bpm', editable: true },
  { label: 'Weight', key: 'weight', unit: 'kg', editable: true },
  { label: 'Height', key: 'height', unit: 'cm', editable: true },
  { label: 'BMI', key: 'bmi', unit: '', editable: false },
] as const;

// Storage key for draft
const DRAFT_STORAGE_KEY = 'rx_notes_draft_';

export default function RxNotes() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  
  const { patient, vitals: incomingVitals } = route.params as {
    patient: Patient;
    vitals: Vitals;
  };

  // State for collapsed sections
  const [expandedSections, setExpandedSections] = useState({
    vitals: false,
    symptoms: false,
    doctorsNote: false,
    diagnosis: false,
  });

  // Default symptoms data
  const defaultSymptoms: SymptomItem[] = [
    {
      id: '1',
      complaint: 'Fever',
      since: '3',
      unit: 'Days',
      severity: 'Moderate',
      notes: 'High grade fever with chills',
      date: '01-07-2025',
    },
    {
      id: '2',
      complaint: 'Headache',
      since: '2',
      unit: 'Days',
      severity: 'Mild',
      notes: 'Persistent frontal headache',
      date: '01-07-2025',
    },
    {
      id: '3',
      complaint: 'Cough',
      since: '5',
      unit: 'Days',
      severity: 'Moderate',
      notes: 'Dry cough, worse at night',
      date: '30-06-2025',
    },
      {
      id: '4',
      complaint: 'Fever',
      since: '5',
      unit: 'Days',
      severity: 'Moderate',
      notes: 'Dry cough, worse at night',
      date: '30-06-2025',
    },
  ];

  // State for form data
  const [formData, setFormData] = useState<RxNotesData>({
    vitals: { ...incomingVitals },
    symptoms: defaultSymptoms,
    doctorNote: '',
    prescription: '',
    currentDiagnosis: [
      {
        id: '1',
        code: 'J06.9',
        doctor: 'Dr. Smith',
        description: '',
        type: '',
        date: '01-07-2025',
      },
      {
        id: '2',
        code: 'R50.9',
        doctor: 'Dr. Johnson',
        description: '',
        type: '',
        date: '01-07-2025',
      },
      {
        id: '3',
        code: 'E11.9',
        doctor: 'Dr. Williams',
        description: '',
        type: '',
        date: '01-07-2025',
      },
       {
        id: '4',
        code: 'E11.9',
        doctor: 'Dr. Williams',
        description: '',
        type: '',
        date: '01-07-2025',
      },
       {
        id: '5',
        code: 'E11.9',
        doctor: 'Dr. Williams',
        description: '',
        type: '',
        date: '01-07-2025',
      },
    ],
    pastDiagnosis: [
      {
        id: '7',
        code: 'E11.9',
        doctor: 'Dr. Williams',
        description: 'Breathing Issue',
        type: 'Final',
        date: '02/09/2024',
      },
      {
        id: '8',
        code: 'J20.9',
        doctor: 'Dr. Davis',
        description: 'Fever, cough',
        type: 'Final',
        date: '14/06/2024',
      },
      {
        id: '9',
        code: 'M54.5',
        doctor: 'Dr. Wilson',
        description: 'Smoking, Drinking',
        type: 'Final',
        date: '22/05/2024',
      },
       {
        id: '10',
        code: 'J20.9',
        doctor: 'Dr. Davis',
        description: 'Fever, cough',
        type: 'Final',
        date: '14/06/2024',
      },
       {
        id: '11',
        code: 'J20.9',
        doctor: 'Dr. Davis',
        description: 'Fever, cough',
        type: 'Final',
        date: '14/06/2024',
      },
    ],
    lastSaved: '',
  });

  // UI state
  const [editingVital, setEditingVital] = useState<keyof Vitals | null>(null);
  const [sinceOpen, setSinceOpen] = useState(false);
  const [severityOpen, setSeverityOpen] = useState(false);
  const [diagnosisSearch, setDiagnosisSearch] = useState('');
  const [showAllCurrent, setShowAllCurrent] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);
  const [showAllSymptoms, setShowAllSymptoms] = useState(false);
  const [openTypeDropdownId, setOpenTypeDropdownId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // New symptom input state
  const [newSymptom, setNewSymptom] = useState({
    complaint: '',
    since: '',
    unit: 'Days' as 'Days' | 'Weeks' | 'Months' | 'Years',
    severity: 'Mild' as 'Mild' | 'Moderate' | 'Severe',
    notes: '',
  });
  
  // Refs
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const appStateRef = useRef(AppState.currentState);

  // Toggle section expansion
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Update form data with change tracking
  const updateFormData = useCallback((updates: Partial<RxNotesData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  }, []);

  // Update specific field
  const updateField = useCallback(<K extends keyof RxNotesData>(field: K, value: RxNotesData[K]) => {
    updateFormData({ [field]: value });
  }, [updateFormData]);

  // Get draft storage key
  const getDraftKey = () => `${DRAFT_STORAGE_KEY}${patient.id}`;

  // Save draft to storage
  const saveDraft = useCallback(async () => {
    try {
      const draftData = {
        ...formData,
        lastSaved: new Date().toISOString(),
      };
      
      console.log('Saving draft:', draftData);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setHasUnsavedChanges(false);
      return true;
    } catch (error) {
      console.error('Error saving draft:', error);
      return false;
    }
  }, [formData]);

  // Load draft from storage
  const loadDraft = useCallback(async () => {
    try {
      console.log('Loading draft for patient:', patient.id);
      return true;
    } catch (error) {
      console.error('Error loading draft:', error);
      return false;
    }
  }, [patient.id]);

  // Auto-save when changes are made (debounced)
  useEffect(() => {
    if (hasUnsavedChanges) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      saveTimeoutRef.current = setTimeout(() => {
        saveDraft();
      }, 2000);
    }
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [hasUnsavedChanges, saveDraft]);

  // Handle back button with save confirmation
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (hasUnsavedChanges) {
        handleBackWithSave();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [hasUnsavedChanges]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appStateRef.current.match(/inactive|background/) && 
          nextAppState === 'active') {
        loadDraft();
      } else if (nextAppState.match(/inactive|background/)) {
        if (hasUnsavedChanges) {
          saveDraft();
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [hasUnsavedChanges, loadDraft, saveDraft]);

  // Initial load
  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  // BMI calculation
  useEffect(() => {
    const extractNumber = (v: string) => v?.match(/[\d.]+/)?.[0] ?? '';
    const w = parseFloat(extractNumber(formData.vitals.weight));
    const h = parseFloat(extractNumber(formData.vitals.height));

    if (w > 0 && h > 0) {
      const bmi = (w / Math.pow(h / 100, 2)).toFixed(1);
      updateFormData({
        vitals: { ...formData.vitals, bmi }
      });
    }
  }, [formData.vitals.weight, formData.vitals.height, updateFormData]);

  // Handle back navigation with save
  const handleBackWithSave = async () => {
    Alert.alert(
      'Save Changes',
      'You have unsaved changes. Do you want to save them as draft?',
      [
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setHasUnsavedChanges(false);
            navigation.goBack();
          },
        },
        {
          text: 'Save Draft',
          onPress: async () => {
            const saved = await saveDraft();
            if (saved) {
              Alert.alert('Success', 'Changes saved as draft');
              navigation.goBack();
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  // Handle back button press
  const handleBackPress = () => {
    if (hasUnsavedChanges) {
      handleBackWithSave();
    } else {
      navigation.goBack();
    }
  };

  // Update vital
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
    updateFormData({
      vitals: { ...formData.vitals, [key]: newValue }
    });
  };

  // Add new symptom
  const addSymptom = () => {
    if (!newSymptom.complaint.trim()) return;

    const newItem: SymptomItem = {
      id: Date.now().toString(),
      complaint: newSymptom.complaint.trim(),
      since: newSymptom.since,
      unit: newSymptom.unit,
      severity: newSymptom.severity,
      notes: newSymptom.notes,
      date: new Date().toLocaleDateString('en-GB'),
    };

    updateField('symptoms', [newItem, ...formData.symptoms]);
    
    // Reset form
    setNewSymptom({
      complaint: '',
      since: '',
      unit: 'Days',
      severity: 'Mild',
      notes: '',
    });
    
    // Reset to show only first 3 when adding new symptom
    setShowAllSymptoms(false);
  };

  // Delete symptom
  const deleteSymptom = (id: string) => {
    updateField('symptoms', formData.symptoms.filter(s => s.id !== id));
  };

  // Update symptom
  const updateSymptom = (id: string, field: keyof SymptomItem, value: string) => {
    updateField('symptoms', 
      formData.symptoms.map(s =>
        s.id === id ? { ...s, [field]: value } : s
      )
    );
  };

  // Add diagnosis
  const addDiagnosis = () => {
    if (!diagnosisSearch.trim()) return;

    const newItem: DiagnosisItem = {
      id: Date.now().toString(),
      code: diagnosisSearch.trim(),
      doctor: patient.doctorName,
      type: '',
      description: '',
      date: new Date().toLocaleDateString('en-GB'),
    };

    updateField('currentDiagnosis', [newItem, ...formData.currentDiagnosis]);
    setDiagnosisSearch('');
  };

  // Update diagnosis type
  const updateDiagnosisType = (id: string, newType: 'Provisional' | 'Final') => {
    updateField('currentDiagnosis', 
      formData.currentDiagnosis.map(d =>
        d.id === id ? { ...d, type: newType } : d
      )
    );
    setOpenTypeDropdownId(null);
  };

  // Delete diagnosis
  const deleteDiagnosis = (id: string, isPast = false) => {
    if (isPast) {
      updateField('pastDiagnosis', formData.pastDiagnosis.filter(d => d.id !== id));
    } else {
      updateField('currentDiagnosis', formData.currentDiagnosis.filter(d => d.id !== id));
    }
  };

  // Render current diagnosis row
  const renderCurrentDiagnosisRow = (item: DiagnosisItem) => {
    const isTypeDropdownOpen = openTypeDropdownId === item.id;

    return (
      <View key={item.id} style={styles.diagRow}>
        <Text style={[styles.diagCell, styles.colICD]}>{item.code}</Text>

        <TextInput
          placeholder="Add description"
          value={item.description}
          multiline
          numberOfLines={50}
          textAlignVertical="top"
          onChangeText={text =>
            updateField('currentDiagnosis',
              formData.currentDiagnosis.map(d =>
                d.id === item.id ? { ...d, description: text } : d
              )
            )
          }
          style={[styles.diagDescInput, styles.colDesc]}
        />

        <Text style={[styles.diagCell, styles.colDoctor]}>{item.doctor}</Text>

        <View style={[styles.colType, { position: 'relative' }]}>
          <TouchableOpacity
            style={styles.typeChip}
            onPress={() =>
              setOpenTypeDropdownId(
                openTypeDropdownId === item.id ? null : item.id
              )
            }
          >
            <Text style={styles.typeText}>
              {item.type || 'Type'}
            </Text>
            <Feather name="chevron-down" size={12} />
          </TouchableOpacity>

          {isTypeDropdownOpen && (
            <View style={styles.typeMenu}>
              {DIAGNOSIS_TYPE_OPTIONS.map(t => (
                <TouchableOpacity
                  key={t}
                  style={styles.typeOption}
                  onPress={() => updateDiagnosisType(item.id, t)}
                >
                  <Text
                    style={[
                      styles.typeOptionText,
                      item.type === t && { color: '#0EA5A4', fontWeight: '600' },
                    ]}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <Text style={[styles.diagCell, styles.colDate]}>{item.date}</Text>

        <TouchableOpacity
          style={styles.colDelete}
          onPress={() => deleteDiagnosis(item.id)}
        >
          <Feather name="trash-2" size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>
    );
  };

  // Render past diagnosis row
  const renderPastDiagnosisRow = (item: DiagnosisItem) => (
    <View key={item.id} style={styles.diagRow}>
      <Text style={[styles.diagCell, styles.colICD]}>{item.code}</Text>
      <Text style={[styles.diagDescText, styles.colDesc]}>{item.description || '-'}</Text>
      <Text style={[styles.diagCell, styles.colDoctor]}>{item.doctor}</Text>
      <View style={styles.colType}>
        <View style={styles.typeChip}>
          <Text style={styles.typeText}>{item.type}</Text>
        </View>
      </View>
      <Text style={[styles.diagCell, styles.colDate]}>{item.date}</Text>
      <TouchableOpacity
        style={styles.colDelete}
        onPress={() => deleteDiagnosis(item.id, true)}
      >
        <Feather name="trash-2" size={16} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );

  // Render symptom row
  const renderSymptomRow = (item: SymptomItem) => (
    <View key={item.id} style={styles.symptomRow}>
      <Text style={[styles.symptomCell, styles.sympColComplaint]}>{item.complaint}</Text>
      <Text style={[styles.symptomCell, styles.sympColSince]}>
        {item.since} {item.unit}
      </Text>
      <Text style={[styles.symptomCell, styles.sympColSeverity]}>{item.severity}</Text>
      <Text style={[styles.symptomCell, styles.sympColNotes]}>{item.notes || '-'}</Text>
      <Text style={[styles.symptomCell, styles.sympColDate]}>{item.date}</Text>
      <TouchableOpacity
        style={[styles.sympColDelete, styles.deleteButton]}
        onPress={() => deleteSymptom(item.id)}
      >
        <Feather name="trash-2" size={16} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );

  // Extract number from vital string
  const extractNumber = (v: string) => v?.match(/[\d.]+/)?.[0] ?? '';

  // Get initials for avatar
  const getInitials = (name: string) =>
    name
      .split(' ')
      .map(p => p[0])
      .join('')
      .toUpperCase();

  // Chunk array for vitals grid
  const chunkArray = (array: any[], size: number) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };

  const vitalRows = chunkArray(VITALS_CONFIG, 3);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress}>
          <Icon name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rx Notes</Text>
        <View style={styles.headerRight}>
          {hasUnsavedChanges && (
            <View style={styles.draftBadge}>
              <Text style={styles.draftText}>Draft</Text>
            </View>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'android' ? 'height' : 'padding'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 50 }]}
          onScroll={() => {
            setSinceOpen(false);
            setSeverityOpen(false);
            setOpenTypeDropdownId(null);
          }}
          scrollEventThrottle={16}
        >
          {/* Patient Details */}
          <View style={styles.patientCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(patient.name)}</Text>
            </View>
            <View style={styles.patientInfo}>
              <Text style={styles.patientName}>{patient.name}</Text>
              <View style={styles.infoRow}>
                <View style={styles.infoChip}>
                  <Text style={styles.infoText}>
                    {patient.gender} • {patient.age} yrs
                  </Text>
                </View>
                <Text style={[styles.meta, styles.uhidText]}>UHID: {patient.patientId}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.meta, styles.roomText]}>Room: {patient.room}</Text>
                <Text style={[styles.meta, styles.doctorText]}>Doctor: {patient.doctorName}</Text>
              </View>
            </View>
          </View>

          {/* Vitals Section */}
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection('vitals')}
            >
              <Text style={styles.sectionTitle}>Vitals</Text>
              <Feather
                name={expandedSections.vitals ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#0EA5A4"
              />
            </TouchableOpacity>

            {expandedSections.vitals && (
              <View style={styles.sectionContent}>
                <View style={styles.grid}>
                  {vitalRows.map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.vitalRow}>
                      {row.map((vital, index) => (
                        <View key={vital.key} style={styles.vitalTile}>
                          <View style={styles.vitalHeader}>
                            <Text style={styles.vitalLabel}>{vital.label}</Text>
                            {vital.editable && (
                              <TouchableOpacity
                                onPress={() =>
                                  setEditingVital(editingVital === vital.key ? null : vital.key)
                                }
                              >
                                <Feather
                                  name={editingVital === vital.key ? 'check' : 'edit-2'}
                                  size={14}
                                  color="#0EA5A4"
                                />
                              </TouchableOpacity>
                            )}
                          </View>

                          {editingVital === vital.key ? (
                            <View style={styles.vitalEditRow}>
                              <TextInput
                                value={extractNumber(formData.vitals[vital.key])}
                                onChangeText={v => updateVitalNumber(vital.key, v)}
                                keyboardType="numeric"
                                autoFocus
                                style={styles.vitalInput}
                              />
                              {vital.unit && <Text style={styles.unit}>{vital.unit}</Text>}
                            </View>
                          ) : (
                            <Text style={styles.vitalValue}>
                              {formData.vitals[vital.key] || '--'}
                            </Text>
                          )}
                        </View>
                      ))}
                      {row.length < 3 && rowIndex === vitalRows.length - 1 && (
                        Array.from({ length: 3 - row.length }).map((_, idx) => (
                          <View key={`empty-${idx}`} style={[styles.vitalTile, styles.emptyTile]} />
                        ))
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Symptoms Section */}
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection('symptoms')}
            >
              <Text style={styles.sectionTitle}>Symptoms</Text>
              <Feather
                name={expandedSections.symptoms ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#0EA5A4"
              />
            </TouchableOpacity>

            {expandedSections.symptoms && (
              <View style={styles.sectionContent}>
                {/* Add Symptoms Section */}
                <Text style={styles.subTitle}>Add Symptoms</Text>
                
                {/* Add Symptoms Row */}
                <View style={styles.symptomAddRow}>
                  <TextInput
                    placeholder="Complaint"
                    value={newSymptom.complaint}
                    onChangeText={text => setNewSymptom(prev => ({ ...prev, complaint: text }))}
                    style={[styles.symptomInput, styles.addSympColComplaint]}
                  />

                  {/* Combined Since and Unit Input */}
                  <View style={[styles.sinceContainer, styles.addSympColSince]}>
                    <TextInput
                      placeholder="0"
                      value={newSymptom.since}
                      onChangeText={text => setNewSymptom(prev => ({ ...prev, since: text }))}
                      keyboardType="number-pad"
                      style={styles.sinceInput}
                    />
                    
                    {/* Unit Dropdown */}
                    <View style={styles.unitDropdownContainer}>
                      <TouchableOpacity
                        style={styles.unitDropdown}
                        onPress={() => {
                          setSinceOpen(!sinceOpen);
                          setSeverityOpen(false);
                        }}
                      >
                        <Text style={styles.unitText}>{newSymptom.unit}</Text>
                        <Feather name="chevron-down" size={14} color="#64748B" />
                      </TouchableOpacity>

                      {sinceOpen && (
                        <View style={styles.unitMenu}>
                          {SINCE_UNITS.map(u => (
                            <TouchableOpacity
                              key={u}
                              style={styles.unitOption}
                              onPress={() => {
                                setNewSymptom(prev => ({ ...prev, unit: u }));
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

                  {/* Severity Dropdown */}
                  <View style={[styles.severityContainer, styles.addSympColSeverity]}>
                    <TouchableOpacity
                      style={styles.severityDropdown}
                      onPress={() => {
                        setSeverityOpen(!severityOpen);
                        setSinceOpen(false);
                      }}
                    >
                      <Text style={styles.severityText}>{newSymptom.severity}</Text>
                      <Feather name="chevron-down" size={14} color="#64748B" />
                    </TouchableOpacity>

                    {severityOpen && (
                      <View style={styles.severityMenu}>
                        {SEVERITY_OPTIONS.map(s => (
                          <TouchableOpacity
                            key={s}
                            style={styles.severityOption}
                            onPress={() => {
                              setNewSymptom(prev => ({ ...prev, severity: s }));
                              setSeverityOpen(false);
                            }}
                          >
                            <Text style={styles.severityOptionText}>{s}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  <TextInput
                    placeholder="Remark"
                    multiline
                    numberOfLines={50}
                    value={newSymptom.notes}
                    onChangeText={text => setNewSymptom(prev => ({ ...prev, notes: text }))}
                    style={[styles.symptomInput, styles.addSympColNotes]}
                  />

                  <TouchableOpacity
                    style={[styles.sympAddBtn, styles.addSympColAction]}
                    onPress={addSymptom}
                  >
                    <Feather name="plus" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>

                {/* Symptoms Data Table */}
                <Text style={[styles.subTitle, { marginTop: 16 }]}>Symptoms</Text>
                
                {/* Table Header */}
                <View style={styles.symptomHeader}>
                  <Text style={[styles.symptomHeaderText, styles.sympColComplaint]}>Complaint</Text>
                  <Text style={[styles.symptomHeaderText, styles.sympColSince]}>Since</Text>
                  <Text style={[styles.symptomHeaderText, styles.sympColSeverity]}>Severity</Text>
                  <Text style={[styles.symptomHeaderText, styles.sympColNotes]}>Notes</Text>
                  <Text style={[styles.symptomHeaderText, styles.sympColDate]}>Date</Text>
                  <View style={styles.sympColDelete}></View>
                </View>

                {/* Symptoms Table Rows */}
                {(showAllSymptoms ? formData.symptoms : formData.symptoms.slice(0, 3)).map(
                  renderSymptomRow
                )}

                {/* View All/Less Button for Symptoms */}
                {formData.symptoms.length > 3 && (
                  <View style={styles.viewAllContainer}>
                    <TouchableOpacity
                      style={styles.viewAllButton}
                      onPress={() => setShowAllSymptoms(p => !p)}
                    >
                      <Text style={styles.viewAllButtonText}>
                        {showAllSymptoms ? 'View Less' : 'View All'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Doctor's Note Section */}
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection('doctorsNote')}
            >
              <Text style={styles.sectionTitle}>Doctor's Note</Text>
              <Feather
                name={expandedSections.doctorsNote ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#0EA5A4"
              />
            </TouchableOpacity>

            {expandedSections.doctorsNote && (
              <View style={styles.sectionContent}>
                <View style={styles.prescriptionBox}>
                  <TextInput
                    placeholder="Write notes here..."
                    value={formData.prescription}
                    onChangeText={text => updateField('prescription', text)}
                    multiline
                    style={styles.prescriptionInput}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Diagnosis Section */}
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection('diagnosis')}
            >
              <Text style={styles.sectionTitle}>Diagnosis</Text>
              <Feather
                name={expandedSections.diagnosis ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#0EA5A4"
              />
            </TouchableOpacity>

            {expandedSections.diagnosis && (
              <View style={styles.sectionContent}>
                <Text style={styles.subTitle}>Current Diagnosis</Text>

                <View style={styles.searchRow}>
                  <TextInput
                    placeholder="Search / Add ICD code"
                    value={diagnosisSearch}
                    onChangeText={setDiagnosisSearch}
                    style={styles.searchInput}
                  />
                  <TouchableOpacity style={styles.addBtn} onPress={addDiagnosis}>
                    <Text style={styles.addBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.diagHeader}>
                  <Text style={[styles.diagHeaderText, styles.colICD]}>ICD</Text>
                  <Text style={[styles.diagHeaderText, styles.colDesc]}>Description</Text>
                  <Text style={[styles.diagHeaderText, styles.colDoctor]}>Doctor</Text>
                  <Text style={[styles.diagHeaderText, styles.colType]}>Type</Text>
                  <Text style={[styles.diagHeaderText, styles.colDate]}>Date</Text>
                  <View style={styles.colDelete}></View>
                </View>

                {(showAllCurrent ? formData.currentDiagnosis : formData.currentDiagnosis.slice(0, 3)).map(
                  renderCurrentDiagnosisRow
                )}

                {/* View All/Less Button for Current Diagnosis */}
                {formData.currentDiagnosis.length > 3 && (
                  <View style={styles.viewAllContainer}>
                    <TouchableOpacity
                      style={styles.viewAllButton}
                      onPress={() => setShowAllCurrent(p => !p)}
                    >
                      <Text style={styles.viewAllButtonText}>
                        {showAllCurrent ? 'View Less' : 'View All'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={[styles.subTitle, { marginTop: 16 }]}>Past Diagnosis</Text>

                {(showAllPast ? formData.pastDiagnosis : formData.pastDiagnosis.slice(0, 3)).map(
                  renderPastDiagnosisRow
                )}

                {/* View All/Less Button for Past Diagnosis */}
                {formData.pastDiagnosis.length > 3 && (
                  <View style={styles.viewAllContainer}>
                    <TouchableOpacity
                      style={styles.viewAllButton}
                      onPress={() => setShowAllPast(p => !p)}
                    >
                      <Text style={styles.viewAllButtonText}>
                        {showAllPast ? 'View Less' : 'View All'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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
  headerRight: {
    width: 60,
    alignItems: 'flex-end',
  },
  draftBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  draftText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  content: { padding: 16 },
  patientCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
    elevation: 2,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E0F2F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#0EA5A4' 
  },
  patientInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  patientName: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#334155',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoChip: {
    backgroundColor: '#ECFEFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginRight: 16,
  },
  infoText: {
    fontSize: 13,
    color: '#0EA5A4',
    fontWeight: '600',
  },
  meta: {
    fontSize: 14,
    color: '#475569',
  },
  uhidText: {
    flex: 1,
    marginLeft: 227,
  },
  roomText: {
    flex: 1,
    marginRight: 12,
  },
  doctorText: {
    flex: 1,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: "#0EA5A4",
  },
  sectionContent: {
    marginTop: 10,
  },
  grid: {
    flexDirection: 'column',
  },
  vitalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  vitalTile: {
    width: '32%',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTile: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  vitalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  vitalLabel: {
    fontSize: 11,
    color: '#64748B',
    textTransform: 'uppercase',
  },
  vitalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  vitalEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  vitalInput: {
    flex: 1,
    borderBottomWidth: 1,
    borderColor: '#0EA5A4',
    fontSize: 15,
    paddingVertical: 2,
  },
  unit: { 
    marginLeft: 6, 
    fontSize: 12, 
    color: '#64748B',
    minWidth: 30,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 8,
    padding: 10,
    marginRight: 8,
    height: 44,
  },
  addBtn: {
    backgroundColor: '#0EA5A4',
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  diagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  diagHeaderText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '600',
  },
  diagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  diagCell: {
    fontSize: 14,
    textAlign: 'center',
    color: '#334155',
  },
  diagDescInput: {
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 6,
    fontSize: 14,
    minHeight: 40,
    textAlignVertical: 'top',
  },
  diagDescText: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
  },
  colICD: {
    width: '12%',
  },
  colDesc: {
    width: '38%',
  },
  colDoctor: {
    width: '16%',
  },
  colType: {
    width: '14%',
    alignItems: 'center',
  },
  colDate: {
    width: '16%',
  },
  colDelete: {
    width: '4%',
  },
  typeChip: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  typeText: {
    fontSize: 11,
    color: '#64748B',
  },
  typeMenu: {
    position: 'absolute',
    top: 36,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 5,
    zIndex: 30,
  },
  typeOption: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  typeOptionText: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
  },
  prescriptionBox: {
    position: 'relative',
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 10,
    padding: 10,
    minHeight: 120,
    backgroundColor: '#fff',
  },
  prescriptionInput: {
    minHeight: 100,
    fontSize: 14,
    textAlignVertical: 'top',
    paddingRight: 40,
  },
  viewAllContainer: {
    alignItems: 'flex-end',
    marginTop: 10,
  },
  viewAllButton: {
    backgroundColor: '#0EA5A4',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewAllButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  // Symptoms Add Row Styles
  symptomAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
 symptomInput: {
  borderWidth: 1,
  borderColor: '#CBD5F5',
  borderRadius: 6,
  paddingHorizontal: 8,
  paddingVertical: 8,
  fontSize: 12,
  backgroundColor: '#fff',
  minHeight: 36,
  textAlignVertical: 'top',
},

  
  // Combined Since and Unit container
  sinceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 6,
    height: 36,
    backgroundColor: '#fff',
  },
  sinceInput: {
    flex: 1,
    paddingHorizontal: 8,
    fontSize: 12,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    height: '100%',
    textAlign: 'center',
  },
  unitDropdownContainer: {
    position: 'relative',
    minWidth: 70,
    zIndex: 100,
  },
  severityContainer: {
    position: 'relative',
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 6,
    height: 36,
    backgroundColor: '#fff',
    zIndex: 50,
  },
  unitDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    height: '100%',
    minWidth: 70,
  },
  unitText: {
    fontSize: 12,
    color: '#334155',
  },
  unitMenu: {
    position: 'absolute',
    top: 38,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 1000,
  },
  severityMenu: {
    position: 'absolute',
    top: 38,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 900,
  },
  unitOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  unitOptionText: {
    fontSize: 12,
    color: '#475569',
  },
  

  severityDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    height: '100%',
  },
  severityText: {
    fontSize: 12,
    color: '#334155',
  },

  severityOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  severityOptionText: {
    fontSize: 12,
    color: '#475569',
  },
  
  // Symptoms Table Styles
  symptomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  symptomHeaderText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '600',
  },
  symptomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  symptomCell: {
    fontSize: 13,
    color: '#334155',
    textAlign: 'center',
  },
  sympAddBtn: {
    backgroundColor: '#0EA5A4',
    width: 36,
    height: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Column Widths for Add Symptoms Section
  addSympColComplaint: { 
    width: '24%',
  },
  addSympColSince: { 
    width: '18%',
  },
  addSympColSeverity: { 
    width: '15%',
  },
  addSympColNotes: { 
    width: '35%',
  },
  addSympColAction: { 
    width: '7%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Column Widths for Symptoms Table Section
  sympColComplaint: { 
    width: '24%',
  },
  sympColSince: { 
    width: '18%',
  },
  sympColSeverity: { 
    width: '15%',
  },
  sympColNotes: { 
    width: '24%',
    // backgroundColor:"red"
  },
  sympColDate: { 
    width: '12%',
    paddingRight:4,
    // backgroundColor:"green"
  },
  sympColDelete: { 
    width: '7%',
  },
});