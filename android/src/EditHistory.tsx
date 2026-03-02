import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { Buffer } from 'buffer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar } from 'react-native-calendars';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useTheme } from './theme/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getPatientDocumentVersions, getpagewiseoverlay } from './api/patientDocumentsApi';
import { getDocumentPages, getDocumentPageImage } from './api/documentsApi';
import NativeDrawingView from './components/NativeDrawingView';

// A helper for date grouping
import moment from 'moment';

/* ---------------- CONSTS ---------------- */

const HISTORY_STORAGE_KEY = 'DoctorApp:editorHistory:v1';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PAGE_HEIGHT = Math.round(SCREEN_H * 0.83);

// History Card Dimensions (from styles: 140x180)
const CARD_WIDTH = 140;
const CARD_HEIGHT = 180;

// Scaling factors for overlays
const SCALE_X = CARD_WIDTH / SCREEN_W;
const SCALE_Y = CARD_HEIGHT / PAGE_HEIGHT;

/* ---------------- TYPES ---------------- */

export type ApiVersionItem = {
  versionNo: number;
  documentInstanceId: string;
  status: string;
  createdBy: string;
  createdDt: string;
  lastUpdatedBy: string | null;
  lastUpdatedDt: string | null;
};

type GroupedHistory = {
  dateLabel: string;
  dateObj: Date;
  items: ApiVersionItem[];
};

const tryParseStrokesJson = (base64?: string): string | null => {
  if (!base64) return null;

  const trimmedInput = base64.trim();
  // 🟢 NEW: If input already looks like JSON (starts with [ or {), return as-is
  if (trimmedInput.startsWith('[') || trimmedInput.startsWith('{')) {
    return trimmedInput;
  }

  try {
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    const trimmed = decoded.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      return trimmed;
    }
  } catch (e) {
    // ignore
  }
  return null;
};

/* ================= SCREEN ================= */

export default function EditorHistory() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDark, colors } = useTheme();

  const { patientNo, patientId: pId, admissionNo, documentCd, formName, patientName } = route.params || {};
  const patientId = pId || patientNo;

  const [history, setHistory] = useState<ApiVersionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Cover image states
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [hasMultiplePages, setHasMultiplePages] = useState(false);
  const [firstPageId, setFirstPageId] = useState<string | null>(null);

  const loadCoverImage = useCallback(async (docCd: string) => {
    try {
      const pages = await getDocumentPages(docCd);
      if (pages && pages.length > 0) {
        setHasMultiplePages(pages.length > 1);
        const sorted = pages.sort((a: any, b: any) => a.displayOrderNo - b.displayOrderNo);
        const firstPage = sorted[0];
        setFirstPageId(firstPage.pageId);

        const base64Img = await getDocumentPageImage(docCd, firstPage.pageId);
        setCoverImage(base64Img);
      }
    } catch (err) {
      console.warn('Failed to load form cover image:', err);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    if (!patientNo || !admissionNo || !documentCd) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await getPatientDocumentVersions(patientNo, admissionNo, documentCd);
      setHistory(Array.isArray(res) ? res : []);

      // Also fetch the cover image if not fetched yet
      loadCoverImage(documentCd);
    } catch (e) {
      console.warn('Failed to load editor history versions', e);
    } finally {
      setLoading(false);
    }
  }, [patientNo, admissionNo, documentCd]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  /* ---------- GROUP BY DATE ---------- */

  const groupedData = useMemo(() => {
    const groups: { [key: string]: ApiVersionItem[] } = {};

    history.forEach(item => {
      // Create date format YYYY-MM-DD
      const dateStr = item.createdDt ? item.createdDt.split('T')[0] : 'Unknown';
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(item);
    });

    const result: GroupedHistory[] = Object.keys(groups).map(dateStr => {
      let label = dateStr;
      if (dateStr !== 'Unknown') {
        const today = moment().startOf('day');
        const itemDate = moment(dateStr, 'YYYY-MM-DD').startOf('day');
        const diffDays = today.diff(itemDate, 'days');

        if (diffDays === 0) label = 'Today';
        else label = moment(dateStr, 'YYYY-MM-DD').format('DD MMM YYYY');
      }

      // items sorted descending by versionNo inside group
      const sortedItems = groups[dateStr].sort((a, b) => b.versionNo - a.versionNo);

      return {
        dateLabel: label,
        dateObj: dateStr === 'Unknown' ? new Date(0) : new Date(dateStr),
        items: sortedItems,
      };
    });

    // sort groups descending by date
    result.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
    return result;
  }, [history]);

  /* ---------- OPEN FOLDER (IMAGE VIEWER OR EDITOR) ---------- */

  const openVersion = (item: ApiVersionItem) => {
    // Navigate back to FormImageScreen with the selected version's instance ID
    // ✅ FIX: Construct specific storageKey for this version
    const safePatient = (patientName || 'Unknown').replace(/\s+/g, '_');
    const safeForm = (formName || 'Document').replace(/\s+/g, '_');
    const suffix = (admissionNo || patientId) ? `:${admissionNo || patientId}` : '';
    const instSuffix = `:${item.documentInstanceId}`;
    const versionStorageKey = `DoctorApp:${safePatient}:${safeForm}${suffix}${instSuffix}:pagesBitmaps:v1`;

    navigation.navigate('FormImageScreen', {
      ...route.params,
      storageKey: versionStorageKey,
      documentInstanceId: item.documentInstanceId,
      documentId: documentCd,
      formName: formName || `Form v${item.versionNo}`,
      patientId: patientId,
      patientNo: patientNo,
      admissionNo: admissionNo,
      patientName: patientName,
      patientAge: route.params?.patientAge,
      patientGender: route.params?.patientGender,
      patientRoom: route.params?.patientRoom,
      attendingDoctor: route.params?.attendingDoctor,
      admitDate: route.params?.admitDate,
    });
  };


  /* ---------- RENDER COVER WRAPPER ---------- */

  const VersionCover = ({ version }: { version: ApiVersionItem }) => {
    const [overlayUri, setOverlayUri] = useState<string | null>(null);
    const [overlayStrokes, setOverlayStrokes] = useState<string | null>(null);
    const [vVoiceNotes, setVVoiceNotes] = useState<any[]>([]);
    const [vImageStickers, setVImageStickers] = useState<any[]>([]);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
      // Use outer scope firstPageId and coverImage
      if (!firstPageId || !coverImage) return;

      const fetchData = async () => {
        try {
          // 1. Fetch Server-side Overlays (Bundled Drawings/Notes/Stickers)
          const overlays = await getpagewiseoverlay(version.documentInstanceId);

          if (Array.isArray(overlays)) {
            const pageOverlay = overlays.find((o: any) => o.pageId === firstPageId);
            if (pageOverlay && pageOverlay.overlayDataBase64) {
              const raw = pageOverlay.overlayDataBase64;
              const strokesJson = tryParseStrokesJson(raw);

              if (strokesJson) {
                try {
                  const parsed = JSON.parse(strokesJson);
                  if (parsed.version === 'v2') {
                    // v2 Bundle
                    if (parsed.strokes) {
                      const strokes = parsed.strokes;
                      const strokesJson = tryParseStrokesJson(strokes);

                      if (strokesJson) {
                        setOverlayStrokes(strokesJson);
                      } else {
                        // It's a PNG base64 string
                        setOverlayUri(strokes.startsWith('data:image') ? strokes : `data:image/png;base64,${strokes}`);
                      }
                    }
                    if (Array.isArray(parsed.voiceNotes)) {
                      setVVoiceNotes(parsed.voiceNotes.filter((n: any) => n.pageId === firstPageId));
                    }
                    if (Array.isArray(parsed.imageStickers)) {
                      setVImageStickers(parsed.imageStickers.filter((s: any) => s.pageId === firstPageId));
                    }
                  } else {
                    // Legacy JSON strokes
                    setOverlayStrokes(strokesJson);
                  }
                } catch (e) {
                  setOverlayStrokes(strokesJson);
                }
              } else if (raw.trim().length > 0) {
                // Legacy PNG
                setOverlayUri(`data:image/png;base64,${raw}`);
              }
            }
          }
        } catch (e) {
          console.warn('Failed to fetch history overlays:', e);
        } finally {
          setIsReady(true);
        }
      };

      fetchData();
    }, [version.documentInstanceId, firstPageId, coverImage]);

    return (
      <View style={[styles.coverPlaceholder, isDark && { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {isReady && coverImage ? (
          <View style={{ width: CARD_WIDTH, height: CARD_HEIGHT, overflow: 'hidden' }}>
            {/* Unified Scaled Container */}
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  width: SCREEN_W,
                  height: PAGE_HEIGHT,
                  transform: [
                    { scaleX: SCALE_X },
                    { scaleY: SCALE_Y }
                  ],
                  transformOrigin: 'top left'
                }
              ]}
              pointerEvents="none"
            >
              {/* 1. Base Image */}
              <Image
                source={{ uri: coverImage }}
                style={{ width: SCREEN_W, height: PAGE_HEIGHT }}
                resizeMode="contain"
              />

              {/* 2. Drawing Overlay (PNG or JSON) */}
              {overlayUri && (
                <View style={[StyleSheet.absoluteFill, { zIndex: 5 }]} pointerEvents="none">
                  <Image
                    source={{ uri: overlayUri }}
                    style={{ width: SCREEN_W, height: PAGE_HEIGHT }}
                    resizeMode="contain"
                  />
                </View>
              )}

              {overlayStrokes && (
                <View style={[StyleSheet.absoluteFill, { zIndex: 6 }]} pointerEvents="none">
                  <NativeDrawingView
                    style={{ width: SCREEN_W, height: PAGE_HEIGHT, backgroundColor: 'transparent' }}
                    strokesJson={overlayStrokes}
                  />
                </View>
              )}

              {/* 3. Text/Stickers Layer */}
              {vImageStickers.map((s) => (
                <View
                  key={s.id}
                  style={{
                    position: 'absolute',
                    left: s.x,
                    top: s.y,
                    width: (s.width || 240),
                    height: (s.height || 140),
                    justifyContent: 'center',
                    alignItems: 'center',
                    transform: [{ scale: s.scale || 1 }],
                  }}
                >
                  {s.stickerType === 'patient' ? (
                    <View style={{ width: '100%', height: '100%', backgroundColor: '#fff', borderRadius: 4, borderWidth: 1.5, borderColor: '#000', padding: 8, justifyContent: 'space-evenly' }}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: '#000' }} numberOfLines={1}>{s.textData?.line1 || ''}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#000' }} numberOfLines={1}>{s.textData?.line2 || ''}</Text>
                      <Text style={{ fontSize: 9, fontWeight: '500', color: '#000' }} numberOfLines={1}>{s.textData?.line3 || ''}</Text>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: '#000' }} numberOfLines={1}>{s.textData?.line4 || ''}</Text>
                      <Text style={{ fontSize: 9, fontWeight: '500', color: '#000' }} numberOfLines={1}>{s.textData?.line5 || ''}</Text>
                    </View>
                  ) : (
                    <View style={{ width: '100%', height: '100%', backgroundColor: '#fff', borderRadius: 4, borderWidth: 1.5, borderColor: '#000', padding: 8, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#000', textAlign: 'center' }}>{s.textData?.line1 || ''}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#000', textAlign: 'center', marginTop: 2 }}>{s.textData?.line2 || ''}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#555', textAlign: 'center', marginTop: 2, textTransform: 'uppercase' }}>{s.textData?.line3 || ''}</Text>
                    </View>
                  )}
                </View>
              ))}

              {vVoiceNotes.map((n) => (
                <View
                  key={n.id}
                  style={{
                    position: 'absolute',
                    left: n.x,
                    top: n.y,
                    width: n.boxWidth ?? 180,
                    height: n.boxHeight ?? 60,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: n.color,
                      fontSize: n.fontSize ?? 14,
                      fontWeight: '500',
                      includeFontPadding: false,
                      textAlign: n.textAlign || 'left',
                      flexWrap: 'wrap',
                    }}
                  >
                    {n.text}
                  </Text>
                </View>
              ))}
            </View>

            {hasMultiplePages && (
              <View style={styles.multiPageIcon}>
                <Ionicons name="documents" size={14} color="#fff" />
              </View>
            )}
          </View>
        ) : null}
      </View>
    );
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
        {/* Folder List */}
        {loading ? (
          <Text style={[styles.empty, isDark && { color: colors.textMuted }]}>Loading versions...</Text>
        ) : groupedData.length === 0 ? (
          <Text style={[styles.empty, isDark && { color: colors.textMuted }]}>No saved versions found</Text>
        ) : (
          <FlatList
            data={groupedData}
            keyExtractor={(item) => item.dateLabel}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.dateGroupContainer}>
                <Text style={[styles.dateLabel, isDark && { color: colors.textPrimary }]}>
                  {item.dateLabel}
                </Text>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rowContainer}
                >
                  {item.items.map((version) => (
                    <TouchableOpacity
                      key={version.versionNo}
                      style={styles.versionCard}
                      onPress={() => openVersion(version)}
                    >
                      <VersionCover version={version} />
                      <Text style={[styles.versionTitle, isDark && { color: colors.textPrimary }]} numberOfLines={1}>
                        Version {version.versionNo}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          />
        )}
      </View>
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

  empty: {
    textAlign: 'center',
    marginTop: 40,
    color: '#6b7280',
    fontSize: 16,
  },

  dateGroupContainer: {
    marginBottom: 20,
  },
  dateLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
    marginTop: 8,
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
  },
  versionCard: {
    width: CARD_WIDTH,
    marginRight: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  coverPlaceholder: {
    width: '100%',
    aspectRatio: 0.75, // Makes it taller (portrait style)
    backgroundColor: '#fff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    position: 'relative',
    overflow: 'hidden', // Ensure overlays don't peek out
  },
  coverImageStyle: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  multiPageIcon: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    padding: 3,
  },
  versionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
});
