import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSelector } from 'react-redux';

import { RootState } from './store';
import { getAllowedDocuments } from './api/admissionsApi';

/* ================= TYPES ================= */

type ApiForm = {
  documentId: string;
  title: string;
  totalPages: number;
  editedPages?: number;
  pageProgress?: string;
  backgroundColor?: string | null;
  textColor?: string | null;
};



/* ================= UTILS ================= */

function makeStorageKey(patientName: string, formName: string) {
  const safePatient = patientName.replace(/\s+/g, '_');
  const safeForm = formName.replace(/\s+/g, '_');
  return `DoctorApp:${safePatient}:${safeForm}:pagesBitmaps:v1`;
}

/* ================= SCREEN ================= */

export default function FormTypeScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [forms, setForms] = useState<ApiForm[]>([]);
  const [filledCounts, setFilledCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const patientName: string = route.params?.patientName ?? 'Unknown Patient';
  const patientId: string | undefined = route.params?.patientId;
  const patientIP: number | undefined = route.params?.patientIP;
  const admissionNo: string | undefined = route.params?.admissionNo;
  console.log('Admission No in FormTypeScreen:', admissionNo);
  const [filterVisible, setFilterVisible] = useState(false);
const [selectedColors, setSelectedColors] = useState<string[]>([]);


 const loginUserId =
  useSelector((state: RootState) => state.user.userId)
  ?? 'TEST_USER_ID';

  /* ================= LOAD DOCUMENTS ================= */

useEffect(() => {
  console.log('FormTypeScreen params 👉', {
    admissionNo,
    loginUserId,
    routeParams: route.params,
  });

  if (!admissionNo || !loginUserId) {
    console.warn('API NOT CALLED ❌ Missing params', {
      admissionNo,
      loginUserId,
    });
    return;
  }

  const loadDocuments = async () => {
    try {
      setLoading(true);

      console.log('CALLING API ✅', {
        admissionNo,
        loginUserId,
      });

      const res = await getAllowedDocuments(admissionNo, loginUserId);

      console.log('DOCUMENT LIST 👉', res);

      setForms(Array.isArray(res) ? res : []);

    } catch (err) {
      console.error('Failed to load documents', err);
      setForms([]);
    } finally {
      setLoading(false);
    }
  };

  loadDocuments();
}, [admissionNo, loginUserId]);


  /* ================= LOAD FILLED COUNTS ================= */

 const loadAllCounts = useCallback(async () => {
  try {
    const result: Record<string, number> = {};

    for (const f of forms) {
      const storageKey = makeStorageKey(patientName, f.title);
      const saved = await AsyncStorage.getItem(storageKey);

      if (!saved) {
        result[f.documentId] = 0;
        continue;
      }

      try {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          result[f.documentId] = parsed.length;
        } else if (typeof parsed === 'object' && parsed !== null) {
          result[f.documentId] = Object.keys(parsed).length;
        } else {
          result[f.documentId] = 0;
        }
      } catch {
        result[f.documentId] = 0;
      }
    }

    setFilledCounts(result);
  } catch (err) {
    console.warn('Failed to load form counts', err);
    setFilledCounts({});
  }
}, [forms, patientName]);


  useFocusEffect(
    useCallback(() => {
      if (forms.length) {
        loadAllCounts();
      }
    }, [loadAllCounts, forms])
  );

  /* ================= FILTER ================= */

const filteredForms = useMemo(() => {
  const q = searchQuery.trim().toLowerCase();

  return forms.filter(f => {
    const matchesSearch =
      !q || f.title.toLowerCase().includes(q);

    const matchesColor =
      selectedColors.length === 0 ||
      (f.backgroundColor && selectedColors.includes(f.backgroundColor));

    return matchesSearch && matchesColor;
  });
}, [searchQuery, forms, selectedColors]);


const availableColors = useMemo(() => {
  const colors = forms
    .map(f => f.backgroundColor)
    .filter((c): c is string => !!c);

  return Array.from(new Set(colors));
}, [forms]);


  /* ================= NAVIGATION ================= */

const handlePress = (form: ApiForm) => {
  const storageKey = makeStorageKey(patientName, form.title);

  navigation.navigate('FormImageScreen', {
    patientName,
    patientId,
    patientIP,
    admissionNo,
    formName: form.title,          // ✅
    formKey: form.documentId,      // ✅
    storageKey,
  });
};

  /* ================= RENDER ================= */

const renderItem = ({ item }: { item: ApiForm }) => {
  const bgColor = item.backgroundColor ?? '#FFFFFF'; // ✅ fallback
  const textColor = item.textColor ?? '#0F172A';     // ✅ fallback

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: bgColor }]}
      activeOpacity={0.9}
      onPress={() => handlePress(item)}
    >
      <View style={styles.cardRow}>
        <View style={styles.iconCircle}>
          <Text style={[styles.iconText, { color: textColor }]}>
            {item.title?.charAt(0) ?? '?'}
          </Text>
        </View>

        <View style={styles.cardTextBlock}>
          <Text
            style={[styles.formName, { color: textColor }]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
        </View>

        <View style={styles.pageInfoWrap}>
          <Text style={[styles.pageInfoText, { color: textColor }]}>
            {filledCounts[item.documentId] ?? 0}/{item.totalPages ?? 0}
          </Text>
        </View>

        <View style={styles.chevronWrap}>
          <Text style={styles.chevron}>{'›'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};


    {filterVisible && (
  <View style={styles.filterOverlay}>
    <View style={styles.filterBox}>
      <Text style={styles.filterTitle}>Filter by Color</Text>

      <View style={styles.colorGrid}>
        {availableColors.map(color => {
          const selected = selectedColors.includes(color);

          return (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorItem,
                { backgroundColor: color },
                selected && styles.colorItemSelected,
              ]}
              onPress={() => {
                setSelectedColors(prev =>
                  prev.includes(color)
                    ? prev.filter(c => c !== color)
                    : [...prev, color]
                );
              }}
            />
          );
        })}
      </View>

      <TouchableOpacity
        style={styles.filterDone}
        onPress={() => setFilterVisible(false)}
      >
        <Text style={styles.filterDoneText}>Done</Text>
      </TouchableOpacity>
    </View>
  </View>
)}


return (
  <>
    {/* FILTER MODAL */}
    {filterVisible && (
      <TouchableOpacity
        activeOpacity={1}
        style={styles.filterOverlay}
        onPress={() => setFilterVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.filterBox}
          onPress={() => {}}
        >
          <Text style={styles.filterTitle}>Filter by Color</Text>

          <View style={styles.colorGrid}>
            {availableColors.map(color => {
              const selected = selectedColors.includes(color);

              return (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorItem,
                    { backgroundColor: color },
                    selected && styles.colorItemSelected,
                  ]}
                  onPress={() =>
                    setSelectedColors(prev =>
                      prev.includes(color)
                        ? prev.filter(c => c !== color)
                        : [...prev, color]
                    )
                  }
                />
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.filterDone}
            onPress={() => setFilterVisible(false)}
          >
            <Text style={styles.filterDoneText}>Done</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    )}


  
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('PatientScreen')}
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
        >
          <Text style={styles.hmisButtonText}>HMIS Report</Text>
        </TouchableOpacity>
      </View>

      {/* CONTENT */}
      <View style={styles.contentWrapper}>
        <View style={styles.sectionHeader}>
          <View style={styles.patientInfoCard}>
            <View style={styles.patientInfoCol}>
              <Text style={styles.patientValue} numberOfLines={1}>
                {patientName} / {patientIP}
              </Text>
            </View>
          </View>

<View style={styles.searchWrapperContent}>
  <Icon name="search" size={18} color="#94A3B8" />

  <TextInput
    placeholder="Search Forms"
    placeholderTextColor="#64748B"
    value={searchQuery}
    onChangeText={setSearchQuery}
    style={styles.searchInputContent}
  />

  {/* FILTER ICON */}
  <TouchableOpacity onPress={() => setFilterVisible(v => !v)}>
    <Icon name="filter" size={18} color="#0EA5A4" />
  </TouchableOpacity>
</View>

{/* 🔽 SMALL DROPDOWN */}
{filterVisible && (
  <View style={styles.filterDropdown}>
    <Text style={styles.filterTitle}>Filter by color</Text>

    <View style={styles.colorRow}>
      {availableColors.map(color => {
        const selected = selectedColors.includes(color);

        return (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorDot,
              { backgroundColor: color },
              selected && styles.colorDotSelected,
            ]}
            onPress={() =>
              setSelectedColors(prev =>
                prev.includes(color)
                  ? prev.filter(c => c !== color)
                  : [...prev, color]
              )
            }
          />
        );
      })}
    </View>
  </View>
)}



        </View>

       <FlatList
  data={filteredForms}
  keyExtractor={(item) => item.documentId}
  renderItem={renderItem}
/>

      </View>
    </SafeAreaView>
  </>
  );
}

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
  width: '100%',
  borderRadius: 14,
  marginBottom: 12,
  paddingHorizontal: 14,
  paddingVertical: 12,
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
filterOverlay: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.3)',
  justifyContent: 'center',
  alignItems: 'center',

  zIndex: 999,      // ✅ REQUIRED
  elevation: 999,   // ✅ REQUIRED (Android)
},


filterBox: {
  width: '85%',
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 16,
},

colorGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
},

colorItem: {
  width: 36,
  height: 36,
  borderRadius: 8,
  margin: 6,
  borderWidth: 1,
  borderColor: '#CBD5E1',
},

colorItemSelected: {
  borderWidth: 3,
  borderColor: '#0EA5A4',
},

filterDone: {
  marginTop: 12,
  alignSelf: 'flex-end',
  backgroundColor: '#0EA5A4',
  paddingHorizontal: 16,
  paddingVertical: 6,
  borderRadius: 8,
},

filterDoneText: {
  color: '#fff',
  fontWeight: '700',
},


  formName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },

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

  chevron: {
    fontSize: 22,
    color: '#94A3B8',
    fontWeight: '600',
  },
  filterDropdown: {
  position: 'absolute',
  top: 108,               // ⬅️ adjust if needed
  right: 20,
  backgroundColor: '#fff',
  borderRadius: 20,
  paddingVertical: 10,
  paddingHorizontal: 14,
  elevation: 8,
  zIndex: 1000,
  minWidth: 180,
},

filterTitle: {
  fontSize: 13,
  fontWeight: '700',
  color: '#0F172A',
  marginBottom: 8,
  textAlign: 'center',
},

colorRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'center',
},

colorDot: {
  width: 22,
  height: 22,
  borderRadius: 11,
  margin: 6,
  borderWidth: 1,
  borderColor: '#CBD5E1',
},

colorDotSelected: {
  borderWidth: 3,
  borderColor: '#0EA5A4',
},

});
