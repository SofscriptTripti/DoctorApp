// src/FormImageScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useRoute,
  useNavigation,
  useFocusEffect,
} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

// ---------- IMPORTANT ----------
// Keep these require(...) lines exactly as they are if those files exist.
// If you move this file, update the relative paths accordingly.
// --------------------------------

const IMAGES_BY_FORM: Record<string, any[]> = {
  emergency_nursing_assessment: [
    require('./Images/Emergency Nursing Assessment/6 Emergency Nursing Assessment_pages-to-jpg-0001.jpg'),
    require('./Images/Emergency Nursing Assessment/6 Emergency Nursing Assessment_pages-to-jpg-0002.jpg'),
    require('./Images/Emergency Nursing Assessment/6 Emergency Nursing Assessment_pages-to-jpg-0003.jpg'),
    require('./Images/Emergency Nursing Assessment/6 Emergency Nursing Assessment_pages-to-jpg-0004.jpg'),
  ],

  initial_nursing_assessment: [
    require('./Images/Initial Nursing Assessment/1 Initial Nursing Assessment -ADULTS_pages-to-jpg-0001.jpg'),
    require('./Images/Initial Nursing Assessment/1 Initial Nursing Assessment -ADULTS_pages-to-jpg-0002.jpg'),
    require('./Images/Initial Nursing Assessment/1 Initial Nursing Assessment -ADULTS_pages-to-jpg-0003.jpg'),
    require('./Images/Initial Nursing Assessment/1 Initial Nursing Assessment -ADULTS_pages-to-jpg-0004.jpg'),
    require('./Images/Initial Nursing Assessment/1 Initial Nursing Assessment -ADULTS_pages-to-jpg-0005.jpg'),
    require('./Images/Initial Nursing Assessment/1 Initial Nursing Assessment -ADULTS_pages-to-jpg-0006.jpg'),
  ],

  neonatal_initial_nursing: [
    require('./Images/Neonatal Initial Nursing/2 Neonatal Initial Nursing Assessment Form_page-0001.jpg'),
    require('./Images/Neonatal Initial Nursing/2 Neonatal Initial Nursing Assessment Form_page-0002.jpg'),
    require('./Images/Neonatal Initial Nursing/2 Neonatal Initial Nursing Assessment Form_page-0003.jpg'),
    require('./Images/Neonatal Initial Nursing/2 Neonatal Initial Nursing Assessment Form_page-0004.jpg'),
  ],
  doctors_handover_isbar: [
    require('./Images/DoctorHandOverFromat.jpg'),
  ],
  
};

const DEFAULT_IMAGES: any[] = [
  // Add fallback images here if desired, example:
  // require('./Images/placeholder.jpg'),
];

const { width: W, height: H } = Dimensions.get('window');
const PAGE_HEIGHT = Math.round(H * 0.72);

type PageMeta = { bitmapPath?: string | null };

let AsyncStorage: any = null;
try {
  // optional: if AsyncStorage is available use it, otherwise code still runs
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  AsyncStorage = null;
  // It's fine to log here; app will work without AsyncStorage
  console.warn('[FormImageScreen] AsyncStorage not installed');
}

function FormImageScreenInternal() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const params = (route.params as any) || {};
  const formName: string | undefined = params.formName;
  const formKey: string | undefined = params.formKey;

  const perFormStorageKey =
    (params.storageKey as string | undefined) ?? `DoctorApp:pagesBitmaps:v1`;

  const imagesForThisForm = IMAGES_BY_FORM[formKey ?? ''] ?? DEFAULT_IMAGES;
  const [pageMeta, setPageMeta] = useState<PageMeta[]>(
    () => imagesForThisForm.map(() => ({ bitmapPath: null }))
  );

  const [voiceNotes, setVoiceNotes] = useState<any[]>(
    () => (Array.isArray(params.voiceNotes) ? params.voiceNotes : [])
  );
  const [imageStickers, setImageStickers] = useState<any[]>(
    () => (Array.isArray(params.imageStickers) ? params.imageStickers : [])
  );

  const [reloadToken, setReloadToken] = useState(0);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setReloadToken((t) => t + 1);

      const onBackPress = () => {
        // ensure this route exists in your navigator
        navigation.navigate('FormType');
        return true;
      };

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress
      );

      return () => subscription.remove();
    }, [navigation])
  );

  useEffect(() => {
    const p = (route.params as any) || {};

    if (p.savedStrokes && Array.isArray(p.savedStrokes)) {
      const metaArr: PageMeta[] = imagesForThisForm.map((_, idx) => {
        const m = p.savedStrokes[idx];
        return { bitmapPath: m?.bitmapPath ?? null };
      });
      setPageMeta(metaArr);
      setReloadToken((t) => t + 1);
    }

    if (Array.isArray(p.voiceNotes)) setVoiceNotes(p.voiceNotes);
    if (Array.isArray(p.imageStickers)) setImageStickers(p.imageStickers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params]);

  useEffect(() => {
    let isMounted = true;

    const p = (route.params as any) || {};
    if (p.savedStrokes && Array.isArray(p.savedStrokes)) {
      return;
    }

    if (!AsyncStorage) return;

    const loadFromStorage = async () => {
      try {
        setLoading(true);
        const json = await AsyncStorage.getItem(perFormStorageKey);
        if (!isMounted) return;
        if (json) {
          try {
            const parsed = JSON.parse(json);
            if (Array.isArray(parsed)) {
              const metaArr: PageMeta[] = imagesForThisForm.map((_, idx) => {
                const m = parsed[idx];
                return { bitmapPath: m?.bitmapPath ?? null };
              });
              setPageMeta(metaArr);
              setReloadToken((t) => t + 1);
            } else if (parsed && typeof parsed === 'object') {
              if (Array.isArray(parsed.bitmaps)) {
                const metaArr: PageMeta[] = imagesForThisForm.map((_, idx) => {
                  const m = parsed.bitmaps[idx];
                  return { bitmapPath: m?.bitmapPath ?? null };
                });
                setPageMeta(metaArr);
                setReloadToken((t) => t + 1);
              }

              if (Array.isArray(parsed.voiceNotes)) {
                setVoiceNotes(parsed.voiceNotes);
              }

              if (Array.isArray(parsed.imageStickers)) {
                setImageStickers(parsed.imageStickers);
              }
            }
          } catch (e) {
            console.warn('[FormImageScreen] failed to parse stored data', e);
          }
        }
      } catch (e) {
        console.warn('[FormImageScreen] error reading AsyncStorage', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadFromStorage();

    return () => {
      isMounted = false;
    };
  }, [perFormStorageKey, imagesForThisForm]);

  const openEditorForPage = (pageIndex: number) => {
    const localModule = imagesForThisForm[pageIndex] ?? null;
    // Make sure 'FormImageEditor' is a registered route in your navigator
    navigation.navigate('FormImageEditor', {
      imageUri: null,
      localImageModule: localModule,
      formName: formName ?? `form-${pageIndex + 1}`,
      singleImageMode: true,
      storageKey: perFormStorageKey,
      uiStorageKey: undefined,
      pageIndex,
      returnScreen: 'FormImageScreen',
      savedStrokes: pageMeta,
      voiceNotes,
      imageStickers,
      // 🔥 ADD THIS LINE - Pass the formKey received from FormTypeScreen
      formKey: formKey, // This is the key that maps to IMAGES_BY_FORM
    });
  };

  const openFullEditor = () => {
    navigation.navigate('FormImageEditor', {
      singleImageMode: false,
      storageKey: perFormStorageKey,
      uiStorageKey: undefined,
      formName,
      returnScreen: 'FormImageScreen',
      savedStrokes: pageMeta,
      voiceNotes,
      imageStickers,
      // 🔥 ADD THIS LINE - Pass the formKey received from FormTypeScreen
      formKey: formKey, // This is the key that maps to IMAGES_BY_FORM
    });
  };

  const ThumbCard = ({
    idx,
    source,
    reloadToken,
  }: {
    idx: number;
    source: any;
    reloadToken: number;
  }) => {
    const meta = pageMeta[idx];
    const savedPath = meta?.bitmapPath || null;
    const isSaved = !!savedPath && savedPath.length > 0;

    let overlaySource: any = null;
    if (isSaved && savedPath) {
      const baseUri = savedPath.startsWith('file://') ? savedPath : `file://${savedPath}`;
      const stampedUri = `${baseUri}?t=${reloadToken}`;
      overlaySource = { uri: stampedUri };
    }

    const notesForPage = voiceNotes.filter((n) => n.pageIndex === idx);
    const stickersForPage = imageStickers.filter((s) => s.pageIndex === idx);

    const cardWidth = W - 24;
    const cardHeight = H * 0.58;
    const scaleX = cardWidth / W;
    const scaleY = cardHeight / PAGE_HEIGHT;
    const uniformScale = Math.min(scaleX, scaleY);

    return (
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={() => openEditorForPage(idx)}
        style={styles.card}
      >
        <View style={styles.cardImageContainer}>
          {/* source could be require(...) or { uri: '...' } */}
          <Image source={source} style={styles.cardImage} resizeMode="contain" />
          {overlaySource && (
            <Image
              key={`overlay-${idx}-${reloadToken}`}
              source={overlaySource}
              style={styles.cardOverlayImage}
              resizeMode="contain"
            />
          )}
          <View style={StyleSheet.absoluteFill}>
            {notesForPage.map((note) => (
              <View
                key={note.id}
                style={{
                  position: 'absolute',
                  left: note.x * scaleX,
                  top: note.y * scaleY,
                  transform: [{ scale: note.scale * uniformScale }],
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '500',
                    color: note.color || '#000',
                    backgroundColor: 'transparent',
                  }}
                >
                  {note.text}
                </Text>
              </View>
            ))}

            {stickersForPage.map((sticker) => (
              <View
                key={sticker.id}
                style={{
                  position: 'absolute',
                  left: sticker.x * scaleX,
                  top: sticker.y * scaleY,
                  transform: [{ scale: sticker.scale * uniformScale }],
                }}
              >
                <View
                  style={{
                    width: 140 * uniformScale,
                    height: 90 * uniformScale,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#0EA5A4',
                    backgroundColor: '#e0f2f1',
                  }}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.cardTitle}>Page {idx + 1}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.navigate('FormType')}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.title}>{formName || 'Form Images'}</Text>

        {/* keep an empty view for spacing so title is centered */}
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator>
        {imagesForThisForm.length === 0 && (
          <View style={{ padding: 20 }}>
            <Text style={{ textAlign: 'center', color: '#666' }}>
              No images available for this form key: {String(formKey)}
            </Text>
          </View>
        )}

        {imagesForThisForm.map((srcItem, i) => (
          <ThumbCard key={`card-${i}`} idx={i} source={srcItem} reloadToken={reloadToken} />
        ))}

        <View style={{ height: 92 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.openEditorBtn} onPress={openFullEditor}>
          <Text style={styles.openEditorBtnText}>Open Editor</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0EA5A4',
    justifyContent: 'space-between',
  },

  backBtn: {
    paddingRight: 10,
    paddingVertical: 4,
  },

  title: { color: '#fff', fontSize: 18, fontWeight: '700' },

  listContainer: { padding: 12, alignItems: 'center' },

  card: {
    width: W - 24,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 14,
    overflow: 'hidden',
    elevation: 3,
    borderWidth: 1,
    borderColor: '#eee',
  },

  cardImageContainer: {
    width: '100%',
    height: H * 0.58,
    backgroundColor: '#f9fbfd',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardImage: {
    width: '100%',
    height: '100%',
  },

  cardOverlayImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },

  cardFooter: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cardTitle: { fontWeight: '700', fontSize: 14, color: '#333' },

  centered: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '45%',
    alignItems: 'center',
  },

  footer: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 16,
    alignItems: 'center',
  },

  openEditorBtn: {
    backgroundColor: '#0EA5A4',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    elevation: 6,
    width: W - 48,
    alignItems: 'center',
  },

  openEditorBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
});

// Export BOTH default and named export to avoid default/named import mismatch in navigator
export default FormImageScreenInternal;
export { FormImageScreenInternal as FormImageScreen };
