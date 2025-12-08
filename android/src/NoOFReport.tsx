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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';

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
    status: 'Pending',
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
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardLabel}>Sample No</Text>
              <Text style={styles.cardTitle}>{item.sampleNo}</Text>
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
            <Icon name="barcode-outline" size={16} color="#64748B" />
            <Text style={styles.cardMetaValue}>{item.cbp}</Text>
          </View>

          <View style={styles.cardRow}>
            <Icon name="calendar-outline" size={16} color="#64748B" />
            <Text style={styles.cardMetaLabel}>Date</Text>
            <Text style={styles.cardMetaValue}>{item.date}</Text>
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
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="chevron-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Date Range Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Date Range</Text>

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
              style={styles.dateBox}
              onPress={() => setShowFromPicker(true)}
            >
              <Text style={styles.dateLabel}>From</Text>
              <View style={styles.dateValueRow}>
                <Icon name="calendar-outline" size={16} color="#64748B" />
                <Text style={styles.dateValueText}>
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
              style={styles.dateBox}
              onPress={() => setShowToPicker(true)}
            >
              <Text style={styles.dateLabel}>To</Text>
              <View style={styles.dateValueRow}>
                <Icon name="calendar-outline" size={16} color="#64748B" />
                <Text style={styles.dateValueText}>
                  {toDate ? formatDisplayDate(toDate) : 'End date'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Search</Text>
          <View style={styles.searchContainer}>
            <Icon name="search-outline" size={18} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by sample no, Name"
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
          </View>
        </View>

        {/* Report List */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Reports</Text>
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

      {/* Date Pickers */}
      {showFromPicker && (
        <DateTimePicker
          value={fromDate || new Date()}
          mode="date"
          display="calendar"
          onChange={onFromDateChange}
        />
      )}

      {showToPicker && (
        <DateTimePicker
          value={toDate || fromDate || new Date()}
          mode="date"
          display="calendar"
          onChange={onToDateChange}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ECFEFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#ECFEFF',
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
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
});
