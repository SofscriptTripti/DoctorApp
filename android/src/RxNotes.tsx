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
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import { Calendar } from 'react-native-calendars';

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
  unit: 'Days' | 'Weeks' | 'Months' | 'Years';
  severity: 'Mild' | 'Moderate' | 'Severe';
  notes: string;
  date: string;
};

type MedicationItem = {
  id: string;
  name: string;
  dose: string;
  unit: string;
  frequency: string;
  timings: string[];
  duration: string;
  note: string;
};

type MedicationInfusionItem = {
  id: string;
  name: string;
  dose: string;
  diluent: string;
  diluentVolume: string;
  time: string;
  dropFactor: string;
  note: string;
  drugVolume: string;
  totalVolume: string;
  rate: string;
  dropsPerMinute: string;
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

// Investigation Types
type InvestigationItem = {
  id: string;
  category: 'Biochemistry' | 'Clinical Pathology' | 'Coagulation' | 'Cytology' | 'Etsa' |
  'Endocrinology' | 'Genetics' | 'Haematology' | 'Histopathology' | 'Immunology' |
  'Microbiology' | 'Chemotherapy' | 'Radiology' | 'Procedure';
  serviceName: string;
  date: string;
  time: string;
  qty: string;
  source: string;
  select: boolean;
  remarks: string;
  checker: string;
  price?: string;
};

type InvestigationTemplate = {
  id: string;
  name: string;
  type: 'General' | 'My Templates';
  category: string;
};

const SEVERITY_OPTIONS = ['Mild', 'Moderate', 'Severe'] as const;
const SINCE_UNITS = ['Days', 'Weeks', 'Months', 'Years'] as const;
const DIAGNOSIS_TYPE_OPTIONS = ['Provisional', 'Final'] as const;
const DILUENT_OPTIONS = ['NS', 'D5W', 'D10W', 'DNS'];

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

// Investigation Categories
const INVESTIGATION_CATEGORIES = [
  { id: 'all', name: 'All', icon: 'grid' },
  { id: 'laboratory', name: 'Laboratory', icon: 'droplet' },
  { id: 'radiology', name: 'Radiology', icon: 'camera' },
  { id: 'procedures', name: 'Procedures', icon: 'scissors' },
  // { id: 'recent', name: 'Recent', icon: 'clock' },
] as const;

// Biochemistry Tests
const BIOCHEMISTRY_TESTS = [
  'Abumin',
  'Aldolase',
  'Alkaline Phosphatase',
  'Alergic Rhinitis Panel Mask',
  'Amikacin, Serum',
  'Amylase (Minie-spot)',
  'Beta Glucosidase',
  'Bile Acids-Total, Serum',
  'Bio 3 - Essential (OH_CAH & GdPD)',
  'Bio 5 (Bio 4 + Bioinidase Deficiency)',
];

// All Investigation Categories
const ALL_INVESTIGATION_CATEGORIES = [
  'Biochemistry',
  'Clinical Pathology',
  'Coagulation',
  'Cytology',
  'Etsa',
  'Endocrinology',
  'Genetics',
  'Haematology',
  'Histopathology',
  'Immunology',
  'Microbiology',
  'Chemotherapy'
];

// Recent Investigations
const RECENT_INVESTIGATIONS = [
  'CBC',
  'Lipid Profile',
  'Liver Function Test',
  'Chest X-Ray',
  'Ultrasound Abdomen',
  'ECG',
  'MRI Brain',
  'CT Scan Chest',
];

// Investigation Templates
const INVESTIGATION_TEMPLATES = [
  { id: '1', name: 'General Health Checkup', type: 'General' as const, category: 'General' },
  { id: '2', name: 'Pre-Operative Package', type: 'General' as const, category: 'General' },
  { id: '3', name: 'Diabetes Panel', type: 'My Templates' as const, category: 'Endocrinology' },
  { id: '4', name: 'Cardiac Workup', type: 'My Templates' as const, category: 'Cardiology' },
  { id: '5', name: 'Liver Function Package', type: 'General' as const, category: 'Biochemistry' },
];

// Storage key for draft
const DRAFT_STORAGE_KEY = 'rx_notes_draft_';

// Months array
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function RxNotes() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const { patient, vitals: incomingVitals } = route.params as {
    patient: Patient;
    vitals: Vitals;
  };

  const [expandedSections, setExpandedSections] = useState({
    vitals: false,
    symptoms: false,
    doctorsNote: false,
    diagnosis: false,
    medication: false,
    medicationInfusion: false,
    investigation: false
  });

  // Investigation States
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [investigationSearch, setInvestigationSearch] = useState('');
  const [showAllInvestigations, setShowAllInvestigations] = useState(false);
  const [selectedInvestigations, setSelectedInvestigations] = useState<InvestigationItem[]>([
    {
      id: '1',
      category: 'Biochemistry',
      serviceName: 'Aldolase',
      date: '2024-01-07',
      time: '10:30 AM',
      qty: '1',
      source: 'Lab',
      select: true,
      remarks: 'Fasting required',
      checker: 'Dr. Smith',
      price: '₹1,500'
    },
    {
      id: '2',
      category: 'Radiology',
      serviceName: 'Chest X-Ray',
      date: '2024-01-07',
      time: '11:00 AM',
      qty: '1',
      source: 'Radiology Dept',
      select: true,
      remarks: 'PA view',
      checker: 'Dr. Johnson',
      price: '₹800'
    },
    {
      id: '3',
      category: 'Haematology',
      serviceName: 'CBC',
      date: '2024-01-07',
      time: '09:00 AM',
      qty: '1',
      source: 'Lab',
      select: true,
      remarks: 'Complete blood count',
      checker: 'Dr. Williams',
      price: '₹600'
    },
    {
      id: '4',
      category: 'Microbiology',
      serviceName: 'Blood Culture',
      date: '2024-01-07',
      time: '08:30 AM',
      qty: '2',
      source: 'Microbiology Lab',
      select: false,
      remarks: 'Aerobic & Anaerobic',
      checker: 'Dr. Davis',
      price: '₹2,200'
    },
    {
      id: '5',
      category: 'Immunology',
      serviceName: 'CRP',
      date: '2024-01-07',
      time: '10:00 AM',
      qty: '1',
      source: 'Lab',
      select: true,
      remarks: 'Quantitative',
      checker: 'Dr. Wilson',
      price: '₹900'
    },
  ]);

  const [selectedRecentMed, setSelectedRecentMed] = useState<string | null>(null);
  const [showFreqModal, setShowFreqModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [customFrequency, setCustomFrequency] = useState<number[]>([0, 0, 0]);
  const [timings, setTimings] = useState<string[]>([]);
  const [medications, setMedications] = useState<MedicationItem[]>([]);
  const [activeMedicine, setActiveMedicine] = useState<MedicationItem | null>(null);
  const [medSearch, setMedSearch] = useState('');
  const [selectedRecentInfusion, setSelectedRecentInfusion] = useState<string | null>(null);
  const [activeInfusion, setActiveInfusion] = useState<MedicationInfusionItem | null>(null);
  const [diluentOpen, setDiluentOpen] = useState(false);
  const [calendarView, setCalendarView] = useState<'start' | 'end'>('start');
  const [markedDates, setMarkedDates] = useState<{ [date: string]: any }>({});
  const [selectedStartDate, setSelectedStartDate] = useState<string>('');
  const [selectedEndDate, setSelectedEndDate] = useState<string>('');

  // Calendar state
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [showMonthFilter, setShowMonthFilter] = useState(false);
  const [showYearFilter, setShowYearFilter] = useState(false);

  // Generate years for filter (from current year - 10 to current year + 10)
  const years = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);

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

  // ---- Medication Order Table ----
  const [showAllMedOrders, setShowAllMedOrders] = useState(false);
  const [medicationOrderTable, setMedicationOrderTable] = useState([
    { id: '1', name: 'Paracetamol', dose: '500 mg', freq: '1-0-1', duration: '3 Days', note: '-' },
    { id: '2', name: 'Azithromycin', dose: '250 mg', freq: '1-0-0', duration: '5 Days', note: '-' },
    { id: '3', name: 'Pantoprazole', dose: '40 mg', freq: '0-0-1', duration: '7 Days', note: 'Before meal' },
    { id: '4', name: 'Vitamin C', dose: '500 mg', freq: '1-0-1', duration: '10 Days', note: '-' },
    { id: '5', name: 'Cetirizine', dose: '10 mg', freq: '0-0-1', duration: '5 Days', note: 'Night' },
  ]);

  // ---- Medication Infusion Table ----
  const [showAllInfusions, setShowAllInfusions] = useState(false);
  const [medicationInfusionTable, setMedicationInfusionTable] = useState([
    { id: '1', name: 'Amikacin', dose: '500 mg', diluent: 'NS', time: '4 hrs', vol: '100 mL', drops: '9 gtt/min' },
    { id: '2', name: 'Vancomycin', dose: '1 g', diluent: 'D5W', time: '2 hrs', vol: '200 mL', drops: '16 gtt/min' },
    { id: '3', name: 'Ceftriaxone', dose: '1 g', diluent: 'NS', time: '1 hr', vol: '100 mL', drops: '20 gtt/min' },
    { id: '4', name: 'Meropenem', dose: '1 g', diluent: 'NS', time: '3 hrs', vol: '150 mL', drops: '10 gtt/min' },
    { id: '5', name: 'Colistin', dose: '2 MIU', diluent: 'DNS', time: '1 hr', vol: '100 mL', drops: '18 gtt/min' },
  ]);

  // New symptom input state
  const [newSymptom, setNewSymptom] = useState({
    complaint: '',
    since: '',
    unit: 'Days' as 'Days' | 'Weeks' | 'Months' | 'Years',
    severity: 'Mild' as 'Mild' | 'Moderate' | 'Severe',
    notes: '',
  });

  const RECENT_MEDICINES = [
    'Lipitor 40 MG',
    'Chloramphenicol INJ',
    'Dolo 650 MG TAB',
    'Prilosec 40 MG',
    'Glucophage 20 MG',
    '4D Plus TAB',
  ];

  // Filtered investigations based on selected category and search
  const filteredInvestigations = selectedInvestigations.filter(item => {
    const matchesSearch = item.serviceName.toLowerCase().includes(investigationSearch.toLowerCase()) ||
      item.category.toLowerCase().includes(investigationSearch.toLowerCase());

    if (selectedCategory === 'all') return matchesSearch;
    if (selectedCategory === 'laboratory') {
      return matchesSearch && !['Radiology', 'Procedure'].includes(item.category);
    }
    if (selectedCategory === 'radiology') {
      return matchesSearch && item.category === 'Radiology';
    }
    if (selectedCategory === 'procedures') {
      return matchesSearch && item.category === 'Procedure';
    }
    if (selectedCategory === 'recent') {
      // Filter by recent date or other criteria
      const itemDate = new Date(item.date);
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - itemDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return matchesSearch && diffDays <= 7;
    }
    return matchesSearch;
  });

  const createMedicineFromName = (name: string): MedicationItem => ({
    id: Date.now().toString(),
    name,
    dose: '',
    unit: '',
    frequency: '',
    timings: [],
    duration: '',
    note: '',
  });

  const createInfusionFromName = (name: string): MedicationInfusionItem => ({
    id: Date.now().toString(),
    name,
    dose: '',
    diluent: '',
    diluentVolume: '',
    time: '',
    dropFactor: '',
    note: '',
    drugVolume: '',
    totalVolume: '',
    rate: '',
    dropsPerMinute: '',
  });

  // Calculate infusion values
  const calculateInfusionValues = useCallback((infusion: MedicationInfusionItem) => {
    const dose = parseFloat(infusion.dose) || 0;
    const diluentVol = parseFloat(infusion.diluentVolume) || 0;
    const time = parseFloat(infusion.time) || 0;
    const dropFactor = parseFloat(infusion.dropFactor) || 0;

    // Drug Volume = dose Volume but into ML (assuming dose is in mL)
    const drugVolume = dose.toString();

    // Total Volume = dose + diluent Volume
    const totalVolume = (dose + diluentVol).toString();

    // Rate = diluent Volume / hour
    const rate = time > 0 ? (diluentVol / time).toFixed(2) : '0';

    // Drop Per Minute = (VTBI * drop factor) / time(min)
    const timeInMinutes = time * 60;
    const vtbi = dose + diluentVol;
    const dropsPerMinute = (timeInMinutes > 0 && dropFactor > 0)
      ? ((vtbi * dropFactor) / timeInMinutes).toFixed(2)
      : '0';

    return {
      drugVolume,
      totalVolume,
      rate,
      dropsPerMinute
    };
  }, []);

  // Update infusion calculations when inputs change
  useEffect(() => {
    if (activeInfusion) {
      const calculated = calculateInfusionValues(activeInfusion);
      setActiveInfusion(prev => prev ? {
        ...prev,
        drugVolume: calculated.drugVolume,
        totalVolume: calculated.totalVolume,
        rate: calculated.rate,
        dropsPerMinute: calculated.dropsPerMinute
      } : null);
    }
  }, [activeInfusion?.dose, activeInfusion?.diluentVolume, activeInfusion?.time, activeInfusion?.dropFactor, calculateInfusionValues]);

  // Refs
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef(AppState.currentState);

  // Calculate duration between dates
  const calculateDuration = (startDateStr: string, endDateStr: string): string => {
    if (!startDateStr || !endDateStr) return '';

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    // Calculate difference in days
    const timeDiff = Math.abs(endDate.getTime() - startDate.getTime());
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    // Format duration
    if (daysDiff === 1) {
      return '1 day';
    } else if (daysDiff < 7) {
      return `${daysDiff} days`;
    } else if (daysDiff < 30) {
      const weeks = Math.floor(daysDiff / 7);
      const remainingDays = daysDiff % 7;
      if (remainingDays === 0) {
        return weeks === 1 ? '1 week' : `${weeks} weeks`;
      } else {
        return `${weeks} week${weeks > 1 ? 's' : ''} ${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
      }
    } else {
      const months = Math.floor(daysDiff / 30);
      const remainingDays = daysDiff % 30;
      if (remainingDays === 0) {
        return months === 1 ? '1 month' : `${months} months`;
      } else {
        return `${months} month${months > 1 ? 's' : ''} ${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
      }
    }
  };

  // Handle date selection for calendar
  const handleDateSelect = (day: any) => {
    if (calendarView === 'start') {
      setSelectedStartDate(day.dateString);
      setMarkedDates({
        [day.dateString]: {
          selected: true,
          selectedColor: '#0EA5A4',
          startingDay: true,
          color: '#0EA5A4',
          textColor: 'white'
        }
      });
      setCalendarView('end');
    } else {
      setSelectedEndDate(day.dateString);

      // Create range marking
      const newMarkedDates: { [date: string]: any } = {};
      const start = new Date(selectedStartDate);
      const end = new Date(day.dateString);

      // Mark start date
      newMarkedDates[selectedStartDate] = {
        selected: true,
        selectedColor: '#0EA5A4',
        startingDay: true,
        color: '#0EA5A4',
        textColor: 'white'
      };

      // Mark end date
      newMarkedDates[day.dateString] = {
        selected: true,
        selectedColor: '#0EA5A4',
        endingDay: true,
        color: '#0EA5A4',
        textColor: 'white'
      };

      // Mark dates in between
      const current = new Date(start);
      current.setDate(current.getDate() + 1);

      while (current < end) {
        const dateStr = current.toISOString().split('T')[0];
        newMarkedDates[dateStr] = {
          selected: true,
          selectedColor: '#E0F2F1',
          color: '#E0F2F1',
          textColor: '#0EA5A4'
        };
        current.setDate(current.getDate() + 1);
      }

      setMarkedDates(newMarkedDates);
    }
  };

  // Save custom duration
  const saveCustomDuration = () => {
    if (selectedStartDate && selectedEndDate) {
      const calculatedDuration = calculateDuration(selectedStartDate, selectedEndDate);

      if (activeMedicine) {
        setActiveMedicine({
          ...activeMedicine,
          duration: calculatedDuration
        });
      }

      setShowDateModal(false);
      resetCalendar();
    }
  };

  // Reset calendar state
  const resetCalendar = () => {
    setCalendarView('start');
    setSelectedStartDate('');
    setSelectedEndDate('');
    setMarkedDates({});
    setShowMonthFilter(false);
    setShowYearFilter(false);
  };

  // Open duration modal
  const openDurationModal = () => {
    setShowDateModal(true);
    resetCalendar();
  };

  // Handle month selection
  const handleMonthSelect = (monthIndex: number) => {
    setCurrentMonth(monthIndex);
    setShowMonthFilter(false);
  };

  // Handle year selection
  const handleYearSelect = (year: number) => {
    setCurrentYear(year);
    setShowYearFilter(false);
  };

  // Toggle month filter
  const toggleMonthFilter = () => {
    setShowMonthFilter(!showMonthFilter);
    setShowYearFilter(false);
  };

  // Toggle year filter
  const toggleYearFilter = () => {
    setShowYearFilter(!showYearFilter);
    setShowMonthFilter(false);
  };

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

  // Validate medication order form
  const validateMedicationOrder = () => {
    if (!activeMedicine) return false;

    const { name, dose, unit, frequency, duration } = activeMedicine;

    if (!name.trim()) {
      Alert.alert('Validation Error', 'Medicine name is required');
      return false;
    }

    if (!dose.trim()) {
      Alert.alert('Validation Error', 'Dose is required');
      return false;
    }

    if (!unit.trim()) {
      Alert.alert('Validation Error', 'Unit is required');
      return false;
    }

    if (!frequency.trim()) {
      Alert.alert('Validation Error', 'Frequency is required');
      return false;
    }

    if (!duration.trim()) {
      Alert.alert('Validation Error', 'Duration is required');
      return false;
    }

    return true;
  };

  // Validate medication infusion form
  const validateMedicationInfusion = () => {
    if (!activeInfusion) return false;

    const { name, dose, diluent, diluentVolume, time, dropFactor } = activeInfusion;

    if (!name.trim()) {
      Alert.alert('Validation Error', 'Infusion name is required');
      return false;
    }

    if (!dose.trim()) {
      Alert.alert('Validation Error', 'Dose is required');
      return false;
    }

    if (!diluent.trim()) {
      Alert.alert('Validation Error', 'Diluent is required');
      return false;
    }

    if (!diluentVolume.trim()) {
      Alert.alert('Validation Error', 'Diluent volume is required');
      return false;
    }

    if (!time.trim()) {
      Alert.alert('Validation Error', 'Time is required');
      return false;
    }

    if (!dropFactor.trim()) {
      Alert.alert('Validation Error', 'Drop factor is required');
      return false;
    }

    return true;
  };

  // Handle confirm medication order
  const handleConfirmMedicationOrder = () => {
    if (!validateMedicationOrder()) {
      return;
    }

    if (activeMedicine) {
      // Format the medication for table display
      const newMedication = {
        id: Date.now().toString(),
        name: activeMedicine.name,
        dose: `${activeMedicine.dose} ${activeMedicine.unit}`,
        freq: activeMedicine.frequency,
        duration: activeMedicine.duration,
        note: activeMedicine.note || '-',
      };

      setMedicationOrderTable(prev => [newMedication, ...prev]);
      setActiveMedicine(null);
      setSelectedRecentMed(null);
      Alert.alert('Success', 'Medication added to order list');
    }
  };

  // Handle confirm medication infusion
  const handleConfirmMedicationInfusion = () => {
    if (!validateMedicationInfusion()) {
      return;
    }

    if (activeInfusion) {
      // Format the infusion for table display
      const newInfusion = {
        id: Date.now().toString(),
        name: activeInfusion.name,
        dose: activeInfusion.dose,
        diluent: activeInfusion.diluent,
        time: `${activeInfusion.time} hrs`,
        vol: `${activeInfusion.totalVolume} mL`,
        drops: `${activeInfusion.dropsPerMinute} gtt/min`,
      };

      setMedicationInfusionTable(prev => [newInfusion, ...prev]);
      setActiveInfusion(null);
      setSelectedRecentInfusion(null);
      Alert.alert('Success', 'Infusion added to order list');
    }
  };

  // Delete medication order row
  const deleteMedicationOrder = (id: string) => {
    Alert.alert(
      'Delete Medication',
      'Are you sure you want to delete this medication order?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setMedicationOrderTable(prev => prev.filter(item => item.id !== id));
          },
        },
      ]
    );
  };

  // Delete medication infusion row
  const deleteMedicationInfusion = (id: string) => {
    Alert.alert(
      'Delete Infusion',
      'Are you sure you want to delete this medication infusion?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setMedicationInfusionTable(prev => prev.filter(item => item.id !== id));
          },
        },
      ]
    );
  };

  // Investigation functions
  const toggleInvestigationSelection = (id: string) => {
    setSelectedInvestigations(prev =>
      prev.map(item =>
        item.id === id ? { ...item, select: !item.select } : item
      )
    );
  };

  const addNewInvestigation = () => {
    if (!investigationSearch.trim()) return;

    const newItem: InvestigationItem = {
      id: Date.now().toString(),
      category: 'Biochemistry',
      serviceName: investigationSearch.trim(),
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      qty: '1',
      source: 'Lab',
      select: true,
      remarks: '',
      checker: patient.doctorName,
      price: '₹0'
    };

    setSelectedInvestigations(prev => [newItem, ...prev]);
    setInvestigationSearch('');
  };

  const deleteInvestigation = (id: string) => {
    Alert.alert(
      'Delete Investigation',
      'Are you sure you want to delete this investigation?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setSelectedInvestigations(prev => prev.filter(item => item.id !== id));
          },
        },
      ]
    );
  };

  const addFromTemplate = (template: InvestigationTemplate) => {
    const newItem: InvestigationItem = {
      id: Date.now().toString(),
      category: template.category as any,
      serviceName: template.name,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      qty: '1',
      source: template.type === 'General' ? 'Template' : 'My Template',
      select: true,
      remarks: `Added from ${template.type} Template`,
      checker: patient.doctorName,
      price: '₹0'
    };

    setSelectedInvestigations(prev => [newItem, ...prev]);
    Alert.alert('Success', 'Investigation added from template');
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

  // Render investigation row
  const renderInvestigationRow = (item: InvestigationItem) => (
    <View key={item.id} style={styles.investigationRow}>
      <TouchableOpacity
        style={[styles.selectCheckbox, item.select && styles.selectCheckboxSelected]}
        onPress={() => toggleInvestigationSelection(item.id)}
      >
        {item.select && <Feather name="check" size={12} color="#fff" />}
      </TouchableOpacity>
      <Text style={[styles.investigationCell, styles.invColCategory]}>{item.category}</Text>
      <Text style={[styles.investigationCell, styles.invColService]}>{item.serviceName}</Text>
      <Text style={[styles.investigationCell, styles.invColDate]}>{item.date}</Text>
      <Text style={[styles.investigationCell, styles.invColTime]}>{item.time}</Text>
      <Text style={[styles.investigationCell, styles.invColQty]}>{item.qty}</Text>
      <Text style={[styles.investigationCell, styles.invColSource]}>{item.source}</Text>
      <TextInput
        style={[styles.investigationInput, styles.invColRemarks]}
        value={item.remarks}
        onChangeText={text => {
          setSelectedInvestigations(prev =>
            prev.map(inv =>
              inv.id === item.id ? { ...inv, remarks: text } : inv
            )
          );
        }}
        placeholder="Remarks"
        multiline
      />
      <Text style={[styles.investigationCell, styles.invColChecker]}>{item.checker}</Text>
      <TouchableOpacity
        style={[styles.invColDelete, styles.deleteButton]}
        onPress={() => deleteInvestigation(item.id)}
      >
        <Feather name="trash-2" size={14} color="#EF4444" />
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
  const chunkArray = <T,>(array: readonly T[], size: number): T[][] => {
    const chunks: T[][] = [];
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
        <View style={[styles.headerRight, { flexDirection: 'row', alignItems: 'center', width: 'auto', gap: 12 }]}>
          {hasUnsavedChanges && (
            <View style={styles.draftBadge}>
              <Text style={styles.draftText}>Draft</Text>
            </View>
          )}
          <TouchableOpacity
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.18)',
            }}
            onPress={() => navigation.navigate('PatientScreen')}
          >
            <Icon name="home" size={22} color="#fff" />
          </TouchableOpacity>
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
            setDiluentOpen(false);
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

          {/* Medication Order Section */}
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection('medication')}
            >
              <Text style={styles.sectionTitle}>Medication Order</Text>
              <Feather
                name={expandedSections.medication ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#0EA5A4"
              />
            </TouchableOpacity>

            {expandedSections.medication && (
              <View style={styles.sectionContent}>
                {/* Search Row */}
                <View style={styles.medSearchRow}>
                  <TextInput
                    placeholder="Search"
                    value={medSearch}
                    onChangeText={setMedSearch}
                    style={styles.medSearchInput}
                  />
                  <TouchableOpacity style={styles.outsideBtn}>
                    <Text style={styles.outsideBtnText}>Add Outside Medicine</Text>
                  </TouchableOpacity>
                </View>

                {/* Recent Medicines */}
                <Text style={[styles.subTitle, { marginTop: 6 }]}>Recent Medicines</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {RECENT_MEDICINES.map(med => {
                    const isActive = selectedRecentMed === med;

                    return (
                      <TouchableOpacity
                        key={med}
                        style={[
                          styles.recentMedChip,
                          isActive && styles.recentMedChipActive,
                        ]}
                        onPress={() => {
                          setSelectedRecentMed(med);
                          setActiveMedicine(createMedicineFromName(med));
                        }}
                      >
                        <Text
                          style={[
                            styles.recentMedText,
                            isActive && { color: '#fff' },
                          ]}
                        >
                          {med}
                        </Text>
                        <Feather
                          name="plus"
                          size={14}
                          color={isActive ? '#fff' : '#0EA5A4'}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Selected Medicine Card */}
                {activeMedicine && (
                  <View
                    style={[
                      styles.medCard,
                      selectedRecentMed && {
                        borderWidth: 2,
                        borderColor: '#0EA5A4',
                      },
                    ]}
                  >
                    <Text style={styles.medName}>{activeMedicine.name}</Text>

                    {/* Dose + Unit */}
                    <View style={styles.medRow}>
                      <TextInput
                        placeholder="Dose"
                        style={styles.medInput}
                        value={activeMedicine.dose}
                        onChangeText={t =>
                          setActiveMedicine({ ...activeMedicine, dose: t })
                        }
                      />
                      <TextInput
                        placeholder="Select unit"
                        style={styles.medInput}
                        value={activeMedicine.unit}
                        onChangeText={t =>
                          setActiveMedicine({ ...activeMedicine, unit: t })
                        }
                      />
                    </View>

                    {/* Frequency */}
                    <Text style={styles.subTitle}>Frequency</Text>
                    <View style={styles.optionRow}>
                      {['1-0-1', '1-1-1', '1-0-0', '0-1-0', '0-0-1'].map(f => (
                        <TouchableOpacity
                          key={f}
                          style={[
                            styles.optionChip,
                            activeMedicine.frequency === f && styles.optionChipActive,
                          ]}
                          onPress={() =>
                            setActiveMedicine({ ...activeMedicine, frequency: f })
                          }
                        >
                          <Text style={[styles.optionText, activeMedicine.frequency === f && { color: '#fff' }]}>
                            {f}
                          </Text>
                        </TouchableOpacity>
                      ))}

                      <TouchableOpacity style={styles.customizeBtn} onPress={() => setShowFreqModal(true)}>
                        <Text style={styles.customizeText}>Customize</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Timing */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                      {['Before meal', 'After meal', 'SOS', 'Bedtime', 'Empty stomach'].map(t => (
                        <TouchableOpacity
                          key={t}
                          style={{ flexDirection: 'row', alignItems: 'center' }}
                          onPress={() =>
                            setTimings(p =>
                              p.includes(t) ? p.filter(x => x !== t) : [...p, t]
                            )
                          }
                        >
                          <Feather
                            name={timings.includes(t) ? 'check-square' : 'square'}
                            size={16}
                            color="#0EA5A4"
                          />
                          <Text style={{ marginLeft: 6 }}>{t}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Duration */}
                    <Text style={[styles.subTitle, { marginTop: 10 }]}>Duration</Text>
                    <View style={styles.optionRow}>
                      {['1 day', '2 days', '3 days', '5 days', '1 week', '2 weeks'].map(d => (
                        <TouchableOpacity
                          key={d}
                          style={[
                            styles.optionChip,
                            activeMedicine.duration === d && styles.optionChipActive,
                          ]}
                          onPress={() =>
                            setActiveMedicine({ ...activeMedicine, duration: d })
                          }
                        >
                          <Text style={[styles.optionText, activeMedicine.duration === d && { color: '#fff' }]}>
                            {d}
                          </Text>
                        </TouchableOpacity>
                      ))}

                      <TouchableOpacity style={styles.customizeBtn} onPress={openDurationModal}>
                        <Text style={styles.customizeText}>Customize</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Notes */}
                    <TextInput
                      placeholder="Enter note"
                      multiline
                      style={styles.medNote}
                      value={activeMedicine.note}
                      onChangeText={t =>
                        setActiveMedicine({ ...activeMedicine, note: t })
                      }
                    />

                    {/* Actions */}
                    <View style={styles.medActionRow}>
                      <TouchableOpacity
                        style={styles.confirmBtn}
                        onPress={handleConfirmMedicationOrder}
                      >
                        <Text style={styles.confirmText}>Confirm</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.clearBtn}
                        onPress={() => {
                          setActiveMedicine(null);
                          setSelectedRecentMed(null);
                        }}
                      >
                        <Text style={styles.clearText}>Clear</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {/* ===== Medication Order Table ===== */}
                <Text style={[styles.subTitle, { marginTop: 16 }]}>Ordered Medicines</Text>

                {/* Header */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.th, { width: '22%' }]}>Medicine</Text>
                  <Text style={[styles.th, { width: '14%' }]}>Dose</Text>
                  <Text style={[styles.th, { width: '14%' }]}>Freq</Text>
                  <Text style={[styles.th, { width: '20%' }]}>Duration</Text>
                  <Text style={[styles.th, { width: '22%' }]}>Note</Text>
                  <View style={{ width: '8%' }} />
                </View>

                {(showAllMedOrders ? medicationOrderTable : medicationOrderTable.slice(0, 3)).map(item => (
                  <View key={item.id} style={styles.tableRow}>
                    <Text style={[styles.td, { width: '22%' }]}>{item.name}</Text>
                    <Text style={[styles.td, { width: '14%' }]}>{item.dose}</Text>
                    <Text style={[styles.td, { width: '14%' }]}>{item.freq}</Text>
                    <Text style={[styles.td, { width: '20%' }]}>{item.duration}</Text>
                    <Text style={[styles.td, { width: '22%' }]}>{item.note}</Text>

                    <View style={{ width: '8%', alignItems: 'center' }}>
                      <TouchableOpacity onPress={() => deleteMedicationOrder(item.id)}>
                        <Feather name="trash-2" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                {medicationOrderTable.length > 3 && (
                  <View style={styles.viewAllContainer}>
                    <TouchableOpacity
                      style={styles.viewAllButton}
                      onPress={() => setShowAllMedOrders(p => !p)}
                    >
                      <Text style={styles.viewAllButtonText}>
                        {showAllMedOrders ? 'View Less' : 'View All'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

              </View>

            )}


          </View>

          {/* Medication Infusion Section */}
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection('medicationInfusion')}
            >
              <Text style={styles.sectionTitle}>Medication Infusion</Text>
              <Feather
                name={expandedSections.medicationInfusion ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#0EA5A4"
              />
            </TouchableOpacity>

            {expandedSections.medicationInfusion && (
              <View style={styles.sectionContent}>
                {/* Search Row */}
                <View style={styles.medSearchRow}>
                  <TextInput
                    placeholder="Search infusion medicine"
                    style={styles.medSearchInput}
                  />
                  <TouchableOpacity style={styles.outsideBtn}>
                    <Text style={styles.outsideBtnText}>Add Outside Medicine</Text>
                  </TouchableOpacity>
                </View>

                {/* Recent Infusions */}
                <Text style={[styles.subTitle, { marginTop: 6 }]}>
                  Recent Medication Infusion
                </Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {RECENT_MEDICINES.map(med => {
                    const isActive = selectedRecentInfusion === med;

                    return (
                      <TouchableOpacity
                        key={med}
                        style={[
                          styles.recentMedChip,
                          isActive && styles.recentMedChipActive,
                        ]}
                        onPress={() => {
                          setSelectedRecentInfusion(med);
                          setActiveInfusion(createInfusionFromName(med));
                        }}
                      >
                        <Text
                          style={[
                            styles.recentMedText,
                            isActive && { color: '#fff' },
                          ]}
                        >
                          {med}
                        </Text>
                        <Feather
                          name="plus"
                          size={14}
                          color={isActive ? '#fff' : '#0EA5A4'}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Infusion Card */}
                {activeInfusion && (
                  <View style={[styles.medCard, { borderWidth: 1, borderColor: '#0EA5A4' }]}>
                    <Text style={styles.medName}>{activeInfusion.name}</Text>

                    {/* Dose + Diluent */}
                    <View style={styles.medRow}>
                      <TextInput
                        placeholder="Dose (mg)"
                        style={styles.medInput}
                        value={activeInfusion.dose}
                        onChangeText={t => setActiveInfusion({ ...activeInfusion, dose: t })}
                        keyboardType="numeric"
                      />

                      {/* Diluent Dropdown */}
                      <View style={[styles.diluentContainer]}>
                        <TouchableOpacity
                          style={styles.diluentDropdown}
                          onPress={() => setDiluentOpen(!diluentOpen)}
                        >
                          <Text style={styles.diluentText}>
                            {activeInfusion.diluent || 'Diluent'}
                          </Text>
                          <Feather name="chevron-down" size={14} color="#64748B" />
                        </TouchableOpacity>

                        {diluentOpen && (
                          <View style={styles.diluentMenu}>
                            {DILUENT_OPTIONS.map(option => (
                              <TouchableOpacity
                                key={option}
                                style={styles.diluentOption}
                                onPress={() => {
                                  setActiveInfusion({ ...activeInfusion, diluent: option });
                                  setDiluentOpen(false);
                                }}
                              >
                                <Text style={styles.diluentOptionText}>{option}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Diluent Volume + Time */}
                    <View style={styles.medRow}>
                      <TextInput
                        placeholder="Diluent Volume (mL)"
                        style={styles.medInput}
                        value={activeInfusion.diluentVolume}
                        onChangeText={t =>
                          setActiveInfusion({ ...activeInfusion, diluentVolume: t })
                        }
                        keyboardType="numeric"
                      />

                      <TextInput
                        placeholder="Time (hr)"
                        style={styles.medInput}
                        value={activeInfusion.time}
                        onChangeText={t => setActiveInfusion({ ...activeInfusion, time: t })}
                        keyboardType="numeric"
                      />
                    </View>

                    {/* Drop Factor */}
                    <View style={styles.medRow}>
                      <TextInput
                        placeholder="Drop Factor"
                        style={styles.medInput}
                        value={activeInfusion.dropFactor}
                        onChangeText={t => setActiveInfusion({ ...activeInfusion, dropFactor: t })}
                        keyboardType="numeric"
                      />
                      <View style={styles.medInput} />
                    </View>

                    {/* Calculation Results */}
                    <View style={styles.calculationSection}>
                      <Text style={[styles.subTitle, { marginTop: 10 }]}>Calculations</Text>

                      <View style={styles.calculationRow}>
                        <Text style={styles.calculationLabel}>Drug Volume:</Text>
                        <Text style={styles.calculationValue}>{activeInfusion.drugVolume || '0'} mL</Text>
                      </View>

                      <View style={styles.calculationRow}>
                        <Text style={styles.calculationLabel}>Total Volume:</Text>
                        <Text style={styles.calculationValue}>{activeInfusion.totalVolume || '0'} mL</Text>
                      </View>

                      <View style={styles.calculationRow}>
                        <Text style={styles.calculationLabel}>Rate:</Text>
                        <Text style={styles.calculationValue}>{activeInfusion.rate || '0'} mL/hr</Text>
                      </View>

                      <View style={styles.calculationRow}>
                        <Text style={styles.calculationLabel}>Drops/min:</Text>
                        <Text style={styles.calculationValue}>{activeInfusion.dropsPerMinute || '0'} gtt/min</Text>
                      </View>
                    </View>

                    {/* Notes */}
                    <TextInput
                      placeholder="Enter note"
                      multiline
                      style={styles.medNote}
                      value={activeInfusion.note}
                      onChangeText={t => setActiveInfusion({ ...activeInfusion, note: t })}
                    />

                    <View style={styles.medActionRow}>
                      <TouchableOpacity
                        style={styles.confirmBtn}
                        onPress={handleConfirmMedicationInfusion}
                      >
                        <Text style={styles.confirmText}>Confirm</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.clearBtn}
                        onPress={() => {
                          setActiveInfusion(null);
                          setSelectedRecentInfusion(null);
                        }}
                      >
                        <Text style={styles.clearText}>Clear</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {/* ===== Medication Infusion Table ===== */}
                <Text style={[styles.subTitle, { marginTop: 16 }]}>Ordered Infusions</Text>

                <View style={styles.tableHeader}>
                  <Text style={[styles.th, { width: '22%' }]}>Infusion</Text>
                  <Text style={[styles.th, { width: '12%' }]}>Dose</Text>
                  <Text style={[styles.th, { width: '10%' }]}>Diluent</Text>
                  <Text style={[styles.th, { width: '14%' }]}>Time</Text>
                  <Text style={[styles.th, { width: '16%' }]}>Volume</Text>
                  <Text style={[styles.th, { width: '18%' }]}>Drops/min</Text>
                  <View style={{ width: '8%' }} />
                </View>

                {(showAllInfusions ? medicationInfusionTable : medicationInfusionTable.slice(0, 3)).map(item => (
                  <View key={item.id} style={styles.tableRow}>
                    <Text style={[styles.td, { width: '22%' }]}>{item.name}</Text>
                    <Text style={[styles.td, { width: '12%' }]}>{item.dose}</Text>
                    <Text style={[styles.td, { width: '10%' }]}>{item.diluent}</Text>
                    <Text style={[styles.td, { width: '14%' }]}>{item.time}</Text>
                    <Text style={[styles.td, { width: '16%' }]}>{item.vol}</Text>
                    <Text style={[styles.td, { width: '18%' }]}>{item.drops}</Text>

                    <View style={{ width: '8%', alignItems: 'center' }}>
                      <TouchableOpacity onPress={() => deleteMedicationInfusion(item.id)}>
                        <Feather name="trash-2" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                {medicationInfusionTable.length > 3 && (
                  <View style={styles.viewAllContainer}>
                    <TouchableOpacity
                      style={styles.viewAllButton}
                      onPress={() => setShowAllInfusions(p => !p)}
                    >
                      <Text style={styles.viewAllButtonText}>
                        {showAllInfusions ? 'View Less' : 'View All'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

              </View>

            )}

          </View>

          {/* ================= INVESTIGATIONS SECTION ================= */}
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection('investigation')}
            >
              <Text style={styles.sectionTitle}>Investigations</Text>
              <Feather
                name={expandedSections.investigation ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#0EA5A4"
              />
            </TouchableOpacity>

            {expandedSections.investigation && (
              <View style={styles.sectionContent}>
                {/* Filter by Category */}
                <Text style={styles.subTitle}>Filter by</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilter}>
                  {INVESTIGATION_CATEGORIES.map(category => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryChip,
                        selectedCategory === category.id && styles.categoryChipActive
                      ]}
                      onPress={() => setSelectedCategory(category.id)}
                    >
                      <Feather
                        name={category.icon as any}
                        size={14}
                        color={selectedCategory === category.id ? '#fff' : '#0EA5A4'}
                      />
                      <Text style={[
                        styles.categoryText,
                        selectedCategory === category.id && styles.categoryTextActive
                      ]}>
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Search Investigation */}
                {/* <Text style={[styles.subTitle, { marginTop: 16 }]}>Search Investigation</Text> */}
                <View style={styles.searchRow}>
                  <TextInput
                    placeholder="Search for investigation..."
                    value={investigationSearch}
                    onChangeText={setInvestigationSearch}
                    style={[styles.searchInput, { flex: 1 }]}
                  />
                  <TouchableOpacity style={styles.addBtn} onPress={addNewInvestigation}>
                    <Text style={styles.addBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>

                {/* Templates
                <Text style={[styles.subTitle, { marginTop: 16 }]}>Templates</Text>
                <View style={styles.templateContainer}>
                  <View style={styles.templateHeader}>
                    <Text style={styles.templateTitle}>General Templates</Text>
                    <TouchableOpacity>
                      <Text style={styles.templateViewAll}>View All</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {INVESTIGATION_TEMPLATES.filter(t => t.type === 'General').map(template => (
                      <TouchableOpacity
                        key={template.id}
                        style={styles.templateChip}
                        onPress={() => addFromTemplate(template)}
                      >
                        <Text style={styles.templateChipText}>{template.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  
                  <View style={[styles.templateHeader, { marginTop: 12 }]}>
                    <Text style={styles.templateTitle}>My Templates</Text>
                    <TouchableOpacity>
                      <Text style={styles.templateViewAll}>View All</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {INVESTIGATION_TEMPLATES.filter(t => t.type === 'My Templates').map(template => (
                      <TouchableOpacity
                        key={template.id}
                        style={styles.templateChip}
                        onPress={() => addFromTemplate(template)}
                      >
                        <Text style={styles.templateChipText}>{template.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View> */}

                {/* Test Categories - Biochemistry */}
                <Text style={[styles.subTitle, { marginTop: 16 }]}>Biochemistry</Text>
                <View style={styles.testCategoryContainer}>
                  {ALL_INVESTIGATION_CATEGORIES.map(category => (
                    <TouchableOpacity key={category} style={styles.testCategoryChip}>
                      <Text style={styles.testCategoryText}>{category}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Selected Tests */}
                <Text style={[styles.subTitle, { marginTop: 16 }]}>Selected Tests</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {BIOCHEMISTRY_TESTS.slice(0, 5).map(test => (
                    <TouchableOpacity key={test} style={styles.testChip}>
                      <Text style={styles.testChipText}>{test}</Text>
                      <Feather name="plus" size={12} color="#0EA5A4" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Recent Investigations */}
                <Text style={[styles.subTitle, { marginTop: 16 }]}>Recent Investigations</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {RECENT_INVESTIGATIONS.map(investigation => (
                    <TouchableOpacity key={investigation} style={styles.testChip}>
                      <Text style={styles.testChipText}>{investigation}</Text>
                      <Feather name="plus" size={12} color="#0EA5A4" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Investigation Order Table */}
                <Text style={[styles.subTitle, { marginTop: 16 }]}>Ordered Investigations</Text>

                {/* Table Header */}
                <View style={styles.investigationHeader}>
                  <View style={[styles.investigationHeaderCol, styles.invColSelect]}></View>
                  <Text style={[styles.investigationHeaderText, styles.invColCategory]}>Category</Text>
                  <Text style={[styles.investigationHeaderText, styles.invColService]}>Service name</Text>
                  <Text style={[styles.investigationHeaderText, styles.invColDate]}>Date</Text>
                  <Text style={[styles.investigationHeaderText, styles.invColTime]}>Time</Text>
                  <Text style={[styles.investigationHeaderText, styles.invColQty]}>Qty</Text>
                  <Text style={[styles.investigationHeaderText, styles.invColSource]}>Source</Text>
                  <Text style={[styles.investigationHeaderText, styles.invColRemarks]}>Remarks</Text>
                  <Text style={[styles.investigationHeaderText, styles.invColChecker]}>Checker</Text>
                  <View style={styles.invColDelete}></View>
                </View>

                {/* Table Rows */}
                {(showAllInvestigations ? filteredInvestigations : filteredInvestigations.slice(0, 3)).map(
                  renderInvestigationRow
                )}

                {/* View All/Less Button */}
                {filteredInvestigations.length > 3 && (
                  <View style={styles.viewAllContainer}>
                    <TouchableOpacity
                      style={styles.viewAllButton}
                      onPress={() => setShowAllInvestigations(p => !p)}
                    >
                      <Text style={styles.viewAllButtonText}>
                        {showAllInvestigations ? 'View Less' : 'View All'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Action Buttons */}
                <View style={[styles.medActionRow, { marginTop: 16 }]}>
                  <TouchableOpacity style={styles.confirmBtn}>
                    <Text style={styles.confirmText}>Save Investigations</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.clearBtn}>
                    <Text style={styles.clearText}>Clear All</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* ================= MODALS ================= */}

          {/* Frequency Modal */}
          <Modal
            visible={showFreqModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowFreqModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>Custom Frequency</Text>

                <View style={{ flexDirection: 'row', gap: 8, marginVertical: 12 }}>
                  {customFrequency.map((v, i) => (
                    <TextInput
                      key={i}
                      style={styles.freqInput}
                      keyboardType="number-pad"
                      value={String(v)}
                      onChangeText={t => {
                        const copy = [...customFrequency];
                        copy[i] = Number(t || 0);
                        setCustomFrequency(copy);
                      }}
                    />
                  ))}

                  <TouchableOpacity onPress={() => setCustomFrequency(p => [...p, 0])}>
                    <Text style={{ color: '#0EA5A4', fontWeight: '600' }}>
                      Add More
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.confirmBtn}
                    onPress={() => setShowFreqModal(false)}
                  >
                    <Text style={styles.confirmText}>Save</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.clearBtn}
                    onPress={() => setShowFreqModal(false)}
                  >
                    <Text style={styles.clearText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Calendar Modal for Duration */}
          <Modal
            visible={showDateModal}
            transparent
            animationType="fade"
            onRequestClose={() => {
              setShowDateModal(false);
              resetCalendar();
            }}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalBox, { width: '95%' }]}>

                {/* ===== Title ===== */}
                <Text style={styles.modalTitle}>
                  {calendarView === 'start' ? 'Select Start Date' : 'Select End Date'}
                </Text>

                {/* ===== Calendar Header with Month/Year Filter ===== */}
                <View style={styles.calendarHeaderContainer}>
                  <View style={styles.calendarHeader}>
                    {/* Month Filter */}
                    <View style={styles.monthYearSelector}>
                      <TouchableOpacity
                        style={styles.monthYearButton}
                        onPress={toggleMonthFilter}
                      >
                        <Text style={styles.monthYearButtonText}>
                          {MONTHS[currentMonth]}
                        </Text>
                        <Feather name="chevron-down" size={16} color="#0EA5A4" />
                      </TouchableOpacity>

                      <Text style={styles.separator}> </Text>

                      {/* Year Filter */}
                      <TouchableOpacity
                        style={styles.monthYearButton}
                        onPress={toggleYearFilter}
                      >
                        <Text style={styles.monthYearButtonText}>
                          {currentYear}
                        </Text>
                        <Feather name="chevron-down" size={16} color="#0EA5A4" />
                      </TouchableOpacity>
                    </View>

                    {/* Navigation Arrows */}
                    <View style={styles.navigationArrows}>
                      <TouchableOpacity
                        onPress={() => {
                          if (currentMonth === 0) {
                            setCurrentMonth(11);
                            setCurrentYear(prev => prev - 1);
                          } else {
                            setCurrentMonth(prev => prev - 1);
                          }
                        }}
                        style={styles.navArrow}
                      >
                        <Feather name="chevron-left" size={20} color="#0EA5A4" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          if (currentMonth === 11) {
                            setCurrentMonth(0);
                            setCurrentYear(prev => prev + 1);
                          } else {
                            setCurrentMonth(prev => prev + 1);
                          }
                        }}
                        style={styles.navArrow}
                      >
                        <Feather name="chevron-right" size={20} color="#0EA5A4" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Month Filter Dropdown */}
                  {showMonthFilter && (
                    <View style={styles.filterDropdown}>
                      <ScrollView style={styles.filterList}>
                        {MONTHS.map((month, index) => (
                          <TouchableOpacity
                            key={month}
                            style={[
                              styles.filterItem,
                              currentMonth === index && styles.selectedFilterItem
                            ]}
                            onPress={() => handleMonthSelect(index)}
                          >
                            <Text style={[
                              styles.filterItemText,
                              currentMonth === index && styles.selectedFilterItemText
                            ]}>
                              {month}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Year Filter Dropdown */}
                  {showYearFilter && (
                    <View style={styles.filterDropdown}>
                      <ScrollView style={styles.filterList}>
                        {years.map((year) => (
                          <TouchableOpacity
                            key={year}
                            style={[
                              styles.filterItem,
                              currentYear === year && styles.selectedFilterItem
                            ]}
                            onPress={() => handleYearSelect(year)}
                          >
                            <Text style={[
                              styles.filterItemText,
                              currentYear === year && styles.selectedFilterItemText
                            ]}>
                              {year}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <Calendar
                  current={`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`}
                  onDayPress={handleDateSelect}
                  onMonthChange={(month) => {
                    setCurrentMonth(month.month - 1);
                    setCurrentYear(month.year);
                  }}
                  markedDates={markedDates}
                  markingType="period"
                  enableSwipeMonths
                  hideExtraDays
                  theme={{
                    backgroundColor: '#ffffff',
                    calendarBackground: '#ffffff',
                    textSectionTitleColor: '#64748B',
                    selectedDayBackgroundColor: '#0EA5A4',
                    selectedDayTextColor: '#ffffff',
                    todayTextColor: '#0EA5A4',
                    dayTextColor: '#334155',
                    textDisabledColor: '#CBD5E1',
                    arrowColor: '#0ea5a4ff',
                    monthTextColor: '#334155',
                    textMonthFontWeight: '600',
                    textDayFontSize: 16,
                    textMonthFontSize: 16,
                    textDayHeaderFontSize: 14,
                  }}
                // style={styles.calendar}
                />

                {/* ===== Duration Summary ===== */}
                {selectedStartDate && selectedEndDate && (
                  <View style={styles.durationSummary}>
                    <Text style={styles.durationText}>
                      Duration: {calculateDuration(selectedStartDate, selectedEndDate)}
                    </Text>
                    <Text style={styles.dateRangeText}>
                      {new Date(selectedStartDate).toLocaleDateString('en-GB')} –{' '}
                      {new Date(selectedEndDate).toLocaleDateString('en-GB')}
                    </Text>
                  </View>
                )}

                {/* ===== Actions ===== */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[
                      styles.confirmBtn,
                      (!selectedStartDate || !selectedEndDate) && { opacity: 0.5 },
                    ]}
                    onPress={saveCustomDuration}
                    disabled={!selectedStartDate || !selectedEndDate}
                  >
                    <Text style={styles.confirmText}>Save</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.clearBtn}
                    onPress={() => {
                      setShowDateModal(false);
                      resetCalendar();
                    }}
                  >
                    <Text style={styles.clearText}>Cancel</Text>
                  </TouchableOpacity>
                </View>

              </View>
            </View>
          </Modal>

          {/* ================= END MODALS ================= */}
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
  calendarHeaderContainer: {
    marginBottom: 10,
    position: 'relative',
    zIndex: 1000,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthYearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthYearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthYearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginRight: 4,
  },
  separator: {
    fontSize: 14,
    color: '#64748B',
    marginHorizontal: 4,
  },
  navigationArrows: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navArrow: {
    padding: 6,
    marginLeft: 8,
  },
  filterDropdown: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    maxHeight: 200,
    zIndex: 1001,
  },
  filterList: {
    maxHeight: 200,
  },
  filterItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  selectedFilterItem: {
    backgroundColor: '#F0F9FF',
  },
  filterItemText: {
    fontSize: 14,
    color: '#334155',
  },
  selectedFilterItemText: {
    color: '#0EA5A4',
    fontWeight: '600',
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
  recentMedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#0EA5A4',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  recentMedChipActive: {
    backgroundColor: '#0EA5A4',
  },
  recentMedText: {
    fontSize: 12,
    color: '#0EA5A4',
    marginRight: 4,
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
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  th: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
  },
  td: {
    fontSize: 13,
    color: '#334155',
    textAlign: 'center',
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
  },
  sympColDate: {
    width: '12%',
    paddingRight: 4,
  },
  sympColDelete: {
    width: '7%',
  },
  medSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  medSearchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 8,
    padding: 10,
    marginRight: 8,
  },
  outsideBtn: {
    backgroundColor: '#0EA5A4',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 8,
    justifyContent: 'center',
  },
  outsideBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  medChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#0EA5A4',
    marginRight: 8,
    marginBottom: 10,
  },
  medChipText: {
    fontSize: 12,
    color: '#0EA5A4',
    marginRight: 4,
  },
  medCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  medName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    color: '#334155',
  },
  medRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  medInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 6,
    padding: 8,
    fontSize: 13,
    backgroundColor: '#fff',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  optionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CBD5F5',
  },
  optionChipActive: {
    backgroundColor: '#0EA5A4',
    borderColor: '#0EA5A4',
  },
  optionText: {
    fontSize: 12,
    color: '#334155',
  },
  customizeBtn: {
    borderWidth: 1,
    borderColor: '#0EA5A4',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 4,
  },
  customizeText: {
    color: '#0EA5A4',
    fontWeight: '600',
    fontSize: 12,
  },
  medNote: {
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 6,
    padding: 8,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  medActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confirmBtn: {
    backgroundColor: '#0EA5A4',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  confirmText: {
    color: '#fff',
    fontWeight: '600',
  },
  clearBtn: {
    borderWidth: 1,
    borderColor: '#CBD5F5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  clearText: {
    color: '#475569',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
  },
  freqInput: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 6,
    textAlign: 'center',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  calendar: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 10,
  },
  durationSummary: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginVertical: 10,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
  dateRangeText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  // New styles for Medication Infusion
  diluentContainer: {
    flex: 1,
    position: 'relative',
  },
  diluentDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 6,
    padding: 8,
    backgroundColor: '#fff',
  },
  diluentText: {
    fontSize: 13,
    color: '#334155',
  },
  diluentMenu: {
    position: 'absolute',
    top: 40,
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
  diluentOption: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  diluentOptionText: {
    fontSize: 13,
    color: '#475569',
  },
  calculationSection: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 12,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  calculationLabel: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  calculationValue: {
    fontSize: 13,
    color: '#0EA5A4',
    fontWeight: '600',
  },

  // Investigation Styles
  categoryFilter: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#0EA5A4',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  categoryChipActive: {
    backgroundColor: '#0EA5A4',
  },
  categoryText: {
    fontSize: 12,
    color: '#0EA5A4',
    marginLeft: 4,
  },
  categoryTextActive: {
    color: '#fff',
  },
  templateContainer: {
    marginBottom: 16,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  templateViewAll: {
    fontSize: 12,
    color: '#0EA5A4',
    fontWeight: '600',
  },
  templateChip: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  templateChipText: {
    fontSize: 12,
    color: '#0EA5A4',
  },
  testCategoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  testCategoryChip: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  testCategoryText: {
    fontSize: 12,
    color: '#475569',
  },
  testChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  testChipText: {
    fontSize: 11,
    color: '#0EA5A4',
    marginRight: 4,
  },
  investigationHeader: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  investigationHeaderCol: {
    width: '4%',
  },
  investigationHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
  },
  investigationRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  investigationCell: {
    fontSize: 11,
    color: '#334155',
    textAlign: 'center',
  },
  investigationInput: {
    fontSize: 11,
    color: '#334155',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    minHeight: 24,
    backgroundColor: '#fff',
  },
  selectCheckbox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  selectCheckboxSelected: {
    backgroundColor: '#0EA5A4',
    borderColor: '#0EA5A4',
  },
  // Investigation column widths (adjust as needed)
  invColSelect: { width: '4%' },
  invColCategory: { width: '12%' },
  invColService: { width: '20%' },
  invColDate: { width: '8%' },
  invColTime: { width: '8%' },
  invColQty: { width: '6%' },
  invColSource: { width: '10%' },
  invColRemarks: { width: '18%' },
  invColChecker: { width: '10%' },
  invColDelete: { width: '4%' },
});