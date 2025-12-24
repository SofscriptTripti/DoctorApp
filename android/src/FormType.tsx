import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDocumentPages, getDocuments } from './api/documentsApi';


type ApiForm = {
  documentId: string;
  title: string;
  description?: string;
  categoryCode?: string;
  genderApplicability?: string;
  backgroundColor?: string | null;
  textColor?: string | null;
  totalPages?: number;
  editedPages?: number;
  pageProgress?: string;
};

/* ================= UTILS ================= */

function makeStorageKey(patientName: string, formName: string) {
  const safePatient = patientName.replace(/\s+/g, '_');
  const safeForm = formName.replace(/\s+/g, '_');
  return `DoctorApp:${safePatient}:${safeForm}:pagesBitmaps:v1`;
}


export default function FormTypeScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [forms, setForms] = useState<ApiForm[]>([]);
  const [filledCounts, setFilledCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);

  const patientName: string = route.params?.patientName ?? 'Unknown Patient';
  const patientId: string | undefined = route.params?.patientId;
  const patientIP: number | undefined = route.params?.patientIP;
  const admissionNo: string | undefined = route.params?.admissionNo;
  const categoryCode: string | undefined = route.params?.categoryCode;

  console.log('FormTypeScreen params:', {
    patientName,
    patientId,
    patientIP,
    admissionNo,
    categoryCode,
  });

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        setLoading(true);
        console.log('Loading documents with categoryCode:', categoryCode);

        const documents = await getDocuments
        (categoryCode);
        console.log('Documents loaded:', documents);

        // Transform API response to match ApiForm type
        const transformedForms: ApiForm[] = Array.isArray(documents) 
          ? documents.map(doc => ({
              documentId: doc.documentId,
              title: doc.title,
              description: doc.description,
              categoryCode: doc.categoryCode,
              genderApplicability: doc.genderApplicability,
              backgroundColor: doc.backgroundColor || '#FFFFFF',
              textColor: doc.textColor || '#0F172A',
              totalPages: 0, // Will be updated when we load pages
            }))
          : [];

        setForms(transformedForms);

      } catch (err) {
        console.error('Failed to load documents', err);
        setForms([]);
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();
  }, [categoryCode]);


  useEffect(() => {
    const updateTotalPages = async () => {
      if (forms.length === 0) return;

      const updatedForms = [...forms];
      for (let i = 0; i < updatedForms.length; i++) {
        const form = updatedForms[i];
        if (!form.totalPages || form.totalPages === 0) {
          try {
            const pages = await getDocumentPages(form.documentId);
            const pageCount = Array.isArray(pages) ? pages.length : 0;
            updatedForms[i] = {
              ...form,
              totalPages: pageCount,
            };
          } catch (err) {
            console.error(`Failed to load pages for ${form.documentId}:`, err);
            updatedForms[i] = {
              ...form,
              totalPages: 0,
            };
          }
        }
      }
      setForms(updatedForms);
    };

    updateTotalPages();
  }, [forms.length]);

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
      if (forms.length > 0) {
        loadAllCounts();
      }
    }, [loadAllCounts, forms])
  );

  /* ================= FILTER ================= */

  const filteredForms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return forms.filter(f => {
      const matchesSearch =
        !q || 
        f.title.toLowerCase().includes(q) ||
        (f.description && f.description.toLowerCase().includes(q));

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

  /* ================= HANDLE FORM SELECTION ================= */

  const handlePress = async (form: ApiForm) => {
    try {
      // Load pages if not already loaded
      let totalPages = form.totalPages;
      if (!totalPages || totalPages === 0) {
        try {
          const pages = await getDocumentPages(form.documentId);
          totalPages = Array.isArray(pages) ? pages.length : 0;
        } catch (err) {
          console.error('Error loading pages:', err);
          totalPages = 0;
        }
      }

      const storageKey = makeStorageKey(patientName, form.title);

      navigation.navigate('FormImageScreen', {
        patientName,
        documentId: form.documentId,
        patientId,
        patientIP,
        admissionNo,
        formName: form.title,
        formKey: form.documentId,
        storageKey,
        totalPages,
        backgroundColor: form.backgroundColor,
        textColor: form.textColor,
      });
    } catch (err) {
      console.error('Error navigating to form:', err);
      // Fallback navigation
      const storageKey = makeStorageKey(patientName, form.title);
      navigation.navigate('FormImageScreen', {
        patientName,
        documentId: form.documentId,
        patientId,
        patientIP,
        admissionNo,
        formName: form.title,
        formKey: form.documentId,
        storageKey,
        totalPages: form.totalPages || 0,
        backgroundColor: form.backgroundColor,
        textColor: form.textColor,
      });
    }
  };

  /* ================= RENDER ITEM ================= */

  const renderItem = ({ item }: { item: ApiForm }) => {
    const bgColor = item?.backgroundColor ?? '#FFFFFF';
    const textColor = item.textColor ?? '#0F172A';
    const totalPages = item.totalPages || 0;
    const filledCount = filledCounts[item.documentId] || 0;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: bgColor }]}
        activeOpacity={0.9}
        onPress={() => handlePress(item)}
      >
        <View style={styles.cardRow}>
         ` {/* <View style={[styles.iconCircle, { backgroundColor: `${textColor}15` }]}>
            <Text style={[styles.iconText, { color: textColor }]}>
              {item.title?.charAt(0) ?? '?'}
            </Text>
          </View>` */}

          <View style={styles.cardTextBlock}>
            <Text
              style={[styles.formName, { color: textColor }]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            {/* {item.description && (
              <Text
                style={[styles.formDescription, { color: textColor }]}
                numberOfLines={1}
              >
                {item.description}
              </Text>
            )} */}
            {/* {item.categoryCode && (
              <Text
                style={[styles.categoryText, { color: textColor }]}
                numberOfLines={1}
              >
                {item.categoryCode}
              </Text>
            )} */}
          </View>

          <View style={styles.pageInfoWrap}>
            <Text style={[styles.pageInfoText, { color: textColor }]}>
              {filledCount}/{totalPages}
            </Text>
          </View>

          <View style={styles.chevronWrap}>
            <Text style={[styles.chevron, { color: textColor }]}>{'›'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };


  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Form Types</Text>
          </View>
          <View style={styles.hmisButtonPlaceholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0EA5A4" />
          <Text style={styles.loadingText}>Loading forms...</Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ================= RENDER EMPTY STATE ================= */

  const renderEmptyState = () => {
    if (loading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Icon name="document-text-outline" size={60} color="#CBD5E1" />
        <Text style={styles.emptyTitle}>No Forms Found</Text>
        <Text style={styles.emptySubtitle}>
          {forms.length === 0 
            ? 'No forms available for this category.'
            : 'No forms match your search criteria.'}
        </Text>
      </View>
    );
  };

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
              style={styles.filterClear}
              onPress={() => setSelectedColors([])}
            >
              <Text style={styles.filterClearText}>Clear All</Text>
            </TouchableOpacity>

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
            onPress={() => navigation.goBack()}
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
                <Text style={styles.patientLabel}>Patient</Text>
                <Text style={styles.patientValue} numberOfLines={1}>
                  {patientName}
                </Text>
              </View>
              {patientIP && (
                <View style={styles.patientInfoColRight}>
                  <Text style={styles.patientLabel}>IP No</Text>
                  <Text style={styles.patientValue}>{patientIP}</Text>
                </View>
              )}
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
              <TouchableOpacity 
                onPress={() => setFilterVisible(v => !v)}
                style={styles.filterIconButton}
              >
                <Icon 
                  name="filter" 
                  size={18} 
                  color={selectedColors.length > 0 ? "#0EA5A4" : "#94A3B8"} 
                />
                {selectedColors.length > 0 && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>
                      {selectedColors.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Filter Summary */}
            {selectedColors.length > 0 && (
              <View style={styles.filterSummary}>
                <Text style={styles.filterSummaryText}>
                  Filtered by {selectedColors.length} color{selectedColors.length > 1 ? 's' : ''}
                </Text>
                <TouchableOpacity onPress={() => setSelectedColors([])}>
                  <Text style={styles.filterClearSummary}>Clear</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* FORM LIST */}
          <FlatList
            data={filteredForms}
            keyExtractor={(item) => item.documentId}
            renderItem={renderItem}
            ListEmptyComponent={renderEmptyState}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F1F5F9' 
  },

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

  hmisButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  hmisButtonPlaceholder: {
    width: 90,
    height: 38,
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

  patientInfoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#2c9999ff',
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
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    marginBottom: 3,
    fontWeight: '500',
  },

  patientValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  searchWrapperContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: 10,
    minHeight: 44,
  },

  searchInputContent: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    paddingVertical: 0,
    color: '#0F172A',
    fontSize: 15,
  },

  filterIconButton: {
    position: 'relative',
    padding: 4,
  },

  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#0EA5A4',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },

  filterSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
  },

  filterSummaryText: {
    fontSize: 13,
    color: '#0EA5A4',
    fontWeight: '600',
  },

  filterClearSummary: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },

  card: {
    width: '100%',
    borderRadius: 14,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },

  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  iconText: {
    fontSize: 18,
    fontWeight: '700',
  },

  cardTextBlock: {
    flex: 1,
    marginRight: 8,
  },

  formName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },

  formDescription: {
    fontSize: 13,
    opacity: 0.8,
    marginBottom: 2,
  },

  categoryText: {
    fontSize: 12,
    opacity: 0.6,
    fontStyle: 'italic',
  },

  pageInfoWrap: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 50,
  },

  pageInfoText: {
    fontSize: 14,
    fontWeight: '700',
  },

  chevronWrap: { 
    marginLeft: 4 
  },

  chevron: {
    fontSize: 24,
    fontWeight: '600',
    opacity: 0.7,
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
    zIndex: 999,
    elevation: 999,
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
    justifyContent: 'center',
    marginVertical: 8,
  },

  colorItem: {
    width: 40,
    height: 40,
    borderRadius: 8,
    margin: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },

  colorItemSelected: {
    borderWidth: 3,
    borderColor: '#0EA5A4',
  },

  filterClear: {
    marginTop: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },

  filterClearText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 14,
  },

  filterDone: {
    marginTop: 12,
    alignSelf: 'stretch',
    backgroundColor: '#0EA5A4',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },

  filterDoneText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 20,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 16,
    marginBottom: 8,
  },

  emptySubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});