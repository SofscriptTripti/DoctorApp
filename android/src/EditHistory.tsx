import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar } from 'react-native-calendars';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from './theme/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

/* ---------------- CONSTS ---------------- */

const HISTORY_STORAGE_KEY = 'DoctorApp:editorHistory:v1';

/* ---------------- TYPES ---------------- */

export type EditorHistoryItem = {
  id: string;
  title: string;
  formKey: string;
  storageKey: string;
  totalPages: number;
  savedAt: number;
  savedDate: string; // YYYY-MM-DD
};

/* ================= SCREEN ================= */

export default function EditorHistory() {
  const navigation = useNavigation<any>();
  const { isDark, colors } = useTheme();

  const [history, setHistory] = useState<EditorHistoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);

  /* ---------- LOAD HISTORY ---------- */

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
      setHistory(raw ? JSON.parse(raw) : []);
    } catch (e) {
      console.warn('Failed to load editor history', e);
    }
  };

  /* ---------- FILTER ---------- */

  const filtered = useMemo(() => {
    return history.filter(item => {
      const matchesText = item.title
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesDate = selectedDate
        ? item.savedDate === selectedDate.toISOString().split('T')[0]
        : true;

      return matchesText && matchesDate;
    });
  }, [history, search, selectedDate]);

  /* ---------- OPEN FOLDER (IMAGE VIEWER) ---------- */

  const openFolder = (item: EditorHistoryItem) => {
    navigation.navigate('ImagePdfViewer', {
      storageKey: item.storageKey,
      totalPages: item.totalPages,
      title: item.title,
    });
  };


  /* ---------- RENDER ---------- */

  return (
    <SafeAreaView style={[styles.root, isDark && { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, isDark && { backgroundColor: colors.surface, elevation: 0 }]}>
        <TouchableOpacity
          style={[styles.backButton, isDark && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#0EA5A4' }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color={isDark ? '#0EA5A4' : '#fff'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editor History</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.container}>
        {/* Search + Calendar */}
        <View style={[styles.searchRow, isDark && { backgroundColor: colors.surfaceHighlight, elevation: 0 }]}>
          <Ionicons name="search" size={18} color={isDark ? colors.textMuted : "#6b7280"} />

          <TextInput
            placeholder="Search form..."
            placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, isDark && { color: colors.textPrimary }]}
          />

          <TouchableOpacity onPress={() => setShowCalendar(true)}>
            <Ionicons
              name="calendar-outline"
              size={22}
              color="#0EA5A4"
            />
          </TouchableOpacity>
        </View>

        {/* Folder List */}
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          ListEmptyComponent={
            <Text style={[styles.empty, isDark && { color: colors.textMuted }]}>
              No saved forms found
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.folderCard, isDark && { backgroundColor: colors.surface, elevation: 0, borderWidth: 1, borderColor: colors.border }]}
              onPress={() => openFolder(item)}
            >
              <Ionicons
                name="folder"
                size={32}
                color="#0EA5A4"
              />
              <View style={{ marginLeft: 12 }}>
                <Text style={[styles.folderTitle, isDark && { color: colors.textPrimary }]}>
                  {item.title}
                </Text>
                <Text style={[styles.folderMeta, isDark && { color: colors.textSecondary }]}>
                  {item.totalPages} pages • {item.savedDate}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Calendar */}
      {showCalendar && (
        <Modal transparent animationType="fade">
          <View style={styles.calendarBackdrop}>
            <View style={[styles.calendarCard, isDark && { backgroundColor: colors.surface }]}>
              <Calendar
                current={selectedDate ? selectedDate.toISOString().split('T')[0] : undefined}
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
                  setSelectedDate(new Date(day.timestamp));
                  setShowCalendar(false);
                }}
                markedDates={{
                  [selectedDate ? selectedDate.toISOString().split('T')[0] : '']: { selected: true, selectedColor: '#0EA5A4' }
                }}
              />

              <TouchableOpacity
                onPress={() => {
                  setSelectedDate(null);
                  setShowCalendar(false);
                }}
                style={styles.clearBtn}
              >
                <Text style={styles.clearText}>
                  Clear date
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f9fafb',
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
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  container: {
    flex: 1,
    padding: 16,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    elevation: 2,
  },

  searchInput: {
    flex: 1,
    marginHorizontal: 8,
  },

  folderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 1,
  },

  folderTitle: {
    fontSize: 16,
    fontWeight: '600',
  },

  folderMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },

  empty: {
    textAlign: 'center',
    marginTop: 40,
    color: '#6b7280',
  },

  calendarBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  calendarCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '90%',
  },

  clearBtn: {
    marginTop: 10,
    alignSelf: 'center',
  },

  clearText: {
    color: '#dc2626',
    fontWeight: '600',
  },
});
