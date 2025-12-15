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
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

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
    <View style={styles.root}>
      {/* Search + Calendar */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color="#6b7280" />

        <TextInput
          placeholder="Search form..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
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
          <Text style={styles.empty}>
            No saved forms found
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.folderCard}
            onPress={() => openFolder(item)}
          >
            <Ionicons
              name="folder"
              size={32}
              color="#0EA5A4"
            />
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.folderTitle}>
                {item.title}
              </Text>
              <Text style={styles.folderMeta}>
                {item.totalPages} pages • {item.savedDate}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Calendar */}
      {showCalendar && (
        <Modal transparent animationType="fade">
          <View style={styles.calendarBackdrop}>
            <View style={styles.calendarCard}>
              <DateTimePicker
                value={selectedDate || new Date()}
                mode="date"
                display={
                  Platform.OS === 'ios'
                    ? 'inline'
                    : 'calendar'
                }
                onChange={(_, date) => {
                  setShowCalendar(false);
                  if (date) setSelectedDate(date);
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
    </View>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f9fafb',
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
