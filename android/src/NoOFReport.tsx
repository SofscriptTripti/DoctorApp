// src/NoOFReport.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar } from 'react-native-calendars';
import { useTheme } from './theme/ThemeContext';

const BRAND = {
  primary: '#0EA5A4',
  accent: '#06B6D4',
  success: '#10B981',
  danger: '#EF4444',
};

type ReportItem = {
  id: string;
  sampleNo: string;
  cbp: string;
  date: string; // "12 Dec 2025"
  status: 'Completed' | 'Pending' | 'In Progress' | 'Rejected';
  pdfFileName: string;    // name of the pdf in android/app/src/main/assets/pdf
};

// 👇 link each id to your PDF file name (inside android/app/src/main/assets/pdf)
const MOCK_REPORTS: ReportItem[] = [
  {
    id: '1',
    sampleNo: '19000039',
    cbp: 'LIPID PROFILE',
    date: '3 Sep 2019, 4:33 PM',
    status: 'Completed',
    pdfFileName: 'File_1.pdf',
  },
  {
    id: '2',
    sampleNo: '18003995',
    cbp: 'STOOL EXAMINATION',
    date: '26 Mar 2018, 12:42 PM',
    status: 'In Progress',
    pdfFileName: 'File_2.pdf',
  },
  {
    id: '3',
    sampleNo: '18003996',
    cbp: 'CBC',
    date: '26 Mar 2018, 12:42 PM',
    status: 'In Progress',
    pdfFileName: 'File_3.pdf',
  },
  {
    id: '4',
    sampleNo: '18004001',
    cbp: 'URINE ANALYSIS',
    date: '26 Mar 2018, 12:42 PM',
    status: 'Completed',
    pdfFileName: 'File_4.pdf',
  },
];

// helper: parse "12 Dec 2025" -> Date
const parseDateString = (dateStr: string): Date | null => {
  // keep only "3 Sep 2019" part in case there is time
  const clean = dateStr.split(',')[0];
  const parts = clean.split(' '); // ["3","Sep","2019"]
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const monthStr = parts[1].toLowerCase();
  const year = parseInt(parts[2], 10);

  const monthMap: { [key: string]: number } = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };

  const month = monthMap[monthStr];
  if (month === undefined || isNaN(day) || isNaN(year)) return null;

  return new Date(year, month, day);
};

// helper: format Date -> "12 Dec 2025"
const formatDisplayDate = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

export default function NoOFReport({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();

  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const hasRange = !!fromDate && !!toDate;

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();

    return MOCK_REPORTS.filter((item) => {
      const matchesSearch =
        !q ||
        item.sampleNo.toLowerCase().includes(q) ||
        item.cbp.toLowerCase().includes(q) ||
        item.date.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q);

      const itemDate = parseDateString(item.date);
      if (!itemDate) return matchesSearch;

      if (!hasRange || !fromDate || !toDate) {
        return matchesSearch;
      }

      const normalizedItem = new Date(
        itemDate.getFullYear(),
        itemDate.getMonth(),
        itemDate.getDate()
      );

      const f = new Date(
        fromDate.getFullYear(),
        fromDate.getMonth(),
        fromDate.getDate()
      );
      const t = new Date(
        toDate.getFullYear(),
        toDate.getMonth(),
        toDate.getDate()
      );

      const matchesDate = normalizedItem >= f && normalizedItem <= t;

      return matchesSearch && matchesDate;
    });
  }, [search, fromDate, toDate, hasRange]);

  const getStatusColors = (status: ReportItem['status']) => {
    switch (status) {
      case 'Completed':
        return { bg: 'rgba(16,185,129,0.12)', text: BRAND.success };
      case 'Pending':
        return { bg: 'rgba(234,179,8,0.12)', text: '#CA8A04' };
      case 'In Progress':
        return { bg: 'rgba(6,182,212,0.12)', text: BRAND.accent };
      case 'Rejected':
        return { bg: 'rgba(239,68,68,0.12)', text: BRAND.danger };
      default:
        return { bg: 'rgba(148,163,184,0.12)', text: '#64748B' };
    }
  };

  const handleOpenReport = (item: ReportItem) => {
    // Navigate to PDF viewer and pass the pdf file name (for bundle-assets)
    console.log('Opening report >>>', item);
    navigation.navigate('PdfViewer', {
      title: item.cbp,
      pdfFileName: item.pdfFileName,
    });
  };

  const renderReportItem = ({ item }: { item: ReportItem }) => {
    const statusColors = getStatusColors(item.status);
    return (
      <TouchableOpacity
        style={styles.cardWrapper}
        activeOpacity={0.8}
        onPress={() => handleOpenReport(item)}
      >
        <View style={styles.cardAccent} />
        <View style={[styles.card, isDark && { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={[styles.cardLabel, isDark && { color: colors.textMuted }]}>Sample No</Text>
              <Text style={[styles.cardTitle, isDark && { color: colors.textPrimary }]}>{item.sampleNo}</Text>
            </View>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: statusColors.bg },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: statusColors.text },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: statusColors.text },
                ]}
              >
                {item.status}
              </Text>
            </View>
          </View>

          <View style={styles.cardRow}>
            <Icon name="barcode-outline" size={16} color={isDark ? colors.textMuted : "#64748B"} />
            <Text style={[styles.cardMetaValue, isDark && { color: colors.textPrimary }]}>{item.cbp}</Text>
          </View>

          <View style={styles.cardRow}>
            <Icon name="calendar-outline" size={16} color={isDark ? colors.textMuted : "#64748B"} />
            <Text style={[styles.cardMetaLabel, isDark && { color: colors.textMuted }]}>Date</Text>
            <Text style={[styles.cardMetaValue, isDark && { color: colors.textPrimary }]}>{item.date}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Handlers for date pickers
  const onFromDateChange = (_event: any, selectedDate?: Date) => {
    setShowFromPicker(false);
    if (selectedDate) {
      setFromDate(selectedDate);
      if (toDate && toDate < selectedDate) {
        setToDate(null);
      }
    }
  };

  const onToDateChange = (_event: any, selectedDate?: Date) => {
    setShowToPicker(false);
    if (selectedDate) {
      setToDate(selectedDate);
    }
  };

  const clearFilter = () => {
    setFromDate(null);
    setToDate(null);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isDark ? colors.background : '#F1F5F9' }]}>
      {/* Header */}
      <View style={[
        styles.header,
        isDark && { backgroundColor: colors.surface, elevation: 0 }
      ]}>
        <TouchableOpacity
          style={[
            styles.backButton,
            isDark && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#0EA5A4' }
          ]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="arrow-back" size={22} color={isDark ? '#0EA5A4' : '#fff'} />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.headerTitle, !isDark && { color: '#fff' }, isDark && { color: colors.textPrimary }]}>Report Details</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.backButton,
            { marginRight: 0 },
            isDark && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#0EA5A4' }
          ]}
          onPress={() => navigation.navigate('PatientScreen')}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="home" size={22} color={isDark ? '#0EA5A4' : '#fff'} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Date Range Section */}
        <View style={[styles.section, isDark && { backgroundColor: colors.surface, elevation: 0 }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.textPrimary }]}>Date Range</Text>

            {!hasRange ? (
              <View style={styles.chip}>
                <Icon name="time-outline" size={14} color={BRAND.accent} />
                <Text style={styles.chipText}>Last 7 days</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.clearChip} onPress={clearFilter}>
                <Icon name="close-circle" size={14} color={BRAND.accent} />
                <Text style={styles.clearChipText}>Clear filter</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.dateRow}>
            <TouchableOpacity
              style={[styles.dateBox, isDark && { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}
              onPress={() => setShowFromPicker(true)}
            >
              <Text style={[styles.dateLabel, isDark && { color: colors.textSecondary }]}>From</Text>
              <View style={styles.dateValueRow}>
                <Icon name="calendar-outline" size={16} color={isDark ? colors.textMuted : "#64748B"} />
                <Text style={[styles.dateValueText, isDark && { color: colors.textPrimary }]}>
                  {fromDate ? formatDisplayDate(fromDate) : 'Start date'}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.dateSeparator}>
              <View style={styles.dateSeparatorLine} />
              <Icon name="arrow-forward" size={14} color="#94A3B8" />
              <View style={styles.dateSeparatorLine} />
            </View>

            <TouchableOpacity
              style={[styles.dateBox, isDark && { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}
              onPress={() => setShowToPicker(true)}
            >
              <Text style={[styles.dateLabel, isDark && { color: colors.textSecondary }]}>To</Text>
              <View style={styles.dateValueRow}>
                <Icon name="calendar-outline" size={16} color={isDark ? colors.textMuted : "#64748B"} />
                <Text style={[styles.dateValueText, isDark && { color: colors.textPrimary }]}>
                  {toDate ? formatDisplayDate(toDate) : 'End date'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={[styles.section, isDark && { backgroundColor: colors.surface, elevation: 0 }]}>
          <Text style={[styles.sectionTitle, isDark && { color: colors.textPrimary }]}>Search</Text>
          <View style={[styles.searchContainer, isDark && { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}>
            <Icon name="search-outline" size={18} color={isDark ? colors.textMuted : "#64748B"} />
            <TextInput
              style={[styles.searchInput, isDark && { color: colors.textPrimary }]}
              placeholder="Search by Sample No, Name"
              placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
          </View>
        </View>

        {/* Report List */}
        <View style={[styles.section, isDark && { backgroundColor: colors.surface, elevation: 0 }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.textPrimary }]}>Reports</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{filteredReports.length}</Text>
            </View>
          </View>

          <FlatList
            data={filteredReports}
            keyExtractor={(item) => item.id}
            renderItem={renderReportItem}
            scrollEnabled={false}
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
          />
        </View>
      </ScrollView>

      {/* Date Picker: From */}
      {showFromPicker && (
        <Modal transparent animationType="fade" visible={showFromPicker} onRequestClose={() => setShowFromPicker(false)}>
          <View style={styles.calendarBackdrop}>
            <View style={[styles.calendarCard, isDark && { backgroundColor: colors.surface }]}>
              <Calendar
                current={fromDate ? fromDate.toISOString().split('T')[0] : undefined}
                theme={{
                  calendarBackground: isDark ? colors.surface : '#ffffff',
                  textSectionTitleColor: isDark ? colors.textMuted : '#b6c1cd',
                  selectedDayBackgroundColor: '#0EA5A4',
                  selectedDayTextColor: '#ffffff',
                  todayTextColor: '#0EA5A4',
                  dayTextColor: isDark ? colors.textPrimary : '#2d4150',
                  textDisabledColor: isDark ? colors.border : '#d9e1e8',
                  dotColor: '#0EA5A4',
                  selectedDotColor: '#ffffff',
                  arrowColor: '#0EA5A4',
                  monthTextColor: isDark ? colors.textPrimary : '#2d4150',
                  indicatorColor: '#0EA5A4',
                }}
                onDayPress={(day) => {
                  // day.timestamp is UTC midnight, which is safe for date selection
                  onFromDateChange({}, new Date(day.timestamp));
                }}
                markedDates={{
                  [fromDate ? fromDate.toISOString().split('T')[0] : '']: { selected: true, selectedColor: '#0EA5A4' }
                }}
              />
              <TouchableOpacity
                onPress={() => setShowFromPicker(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Date Picker: To */}
      {showToPicker && (
        <Modal transparent animationType="fade" visible={showToPicker} onRequestClose={() => setShowToPicker(false)}>
          <View style={styles.calendarBackdrop}>
            <View style={[styles.calendarCard, isDark && { backgroundColor: colors.surface }]}>
              <Calendar
                current={toDate ? toDate.toISOString().split('T')[0] : (fromDate ? fromDate.toISOString().split('T')[0] : undefined)}
                theme={{
                  calendarBackground: isDark ? colors.surface : '#ffffff',
                  textSectionTitleColor: isDark ? colors.textMuted : '#b6c1cd',
                  selectedDayBackgroundColor: '#0EA5A4',
                  selectedDayTextColor: '#ffffff',
                  todayTextColor: '#0EA5A4',
                  dayTextColor: isDark ? colors.textPrimary : '#2d4150',
                  textDisabledColor: isDark ? colors.border : '#d9e1e8',
                  dotColor: '#0EA5A4',
                  selectedDotColor: '#ffffff',
                  arrowColor: '#0EA5A4',
                  monthTextColor: isDark ? colors.textPrimary : '#2d4150',
                  indicatorColor: '#0EA5A4',
                }}
                onDayPress={(day) => {
                  onToDateChange({}, new Date(day.timestamp));
                }}
                markedDates={{
                  [toDate ? toDate.toISOString().split('T')[0] : '']: { selected: true, selectedColor: '#0EA5A4' }
                }}
              />
              <TouchableOpacity
                onPress={() => setShowToPicker(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F1F5F9',
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
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  section: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#0EA5A4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(6,182,212,0.12)',
    gap: 4,
  },
  chipText: {
    fontSize: 11,
    color: BRAND.accent,
    fontWeight: '600',
  },
  clearChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(239,68,68,0.06)',
    gap: 4,
  },
  clearChipText: {
    fontSize: 11,
    color: BRAND.accent,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dateBox: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F766E',
    marginBottom: 4,
  },
  dateValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateValueText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
  },
  dateSeparator: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  dateSeparatorLine: {
    width: '100%',
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  countBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: BRAND.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardWrapper: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  cardAccent: {
    width: 4,
    borderRadius: 999,
    backgroundColor: BRAND.primary,
    marginRight: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  card: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(14,165,164,0.12)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cardTitle: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  cardMetaLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  cardMetaValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  calendarBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarCard: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    elevation: 10,
  },
  modalCloseBtn: {
    marginTop: 10,
    alignSelf: 'center',
    padding: 10,
  },
  modalCloseText: {
    color: BRAND.primary,
    fontWeight: '700',
    fontSize: 16,
  },
});
