
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

// 🔹 Import types from editor (no runtime code, only types)
import type {
  VoiceNote,
  ImageSticker,
} from './FormImageEditor';

const { width: W, height: H } = Dimensions.get('window');

// Same page height logic as editor (PAGE_HEIGHT = SCREEN_H * 0.72)
const PAGE_HEIGHT = Math.round(H * 0.72);

const LOCAL_IMAGE_LIST = [
  require('./Images/first.jpeg'),
  require('./Images/second.jpeg'),
  require('./Images/Third.jpeg'),
  require('./Images/forth.jpeg'),
  require('./Images/fifth.jpeg'),
  require('./Images/sixtg.jpeg'),
  require('./Images/seventh.jpeg'),
  require('./Images/Eighth.jpeg'),
  require('./Images/Eleventh.jpeg'),
  require('./Images/ninth.jpeg'),
  require('./Images/Tenth.jpeg'),
  require('./Images/Thirteen.jpeg'),
  require('./Images/twelve.jpeg'),
];

type PageMeta = { bitmapPath?: string | null };

// Try AsyncStorage if available (for persistence per patient+form)
let AsyncStorage: any = null;
try {
  AsyncStorage =
    require('@react-native-async-storage/async-storage').default;
} catch (e) {
  AsyncStorage = null;
}

export function FormImageScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const params = (route.params as any) || {};
  const formName: string | undefined = params.formName;

  const perFormStorageKey =
    (params.storageKey as string | undefined) ??
    `DoctorApp:pagesBitmaps:v1`;

  // 🔥 Initial pageMeta from navigation (savedStrokes) if available
  const [pageMeta, setPageMeta] = useState<PageMeta[]>(() => {
    if (params.savedStrokes && Array.isArray(params.savedStrokes)) {
      return LOCAL_IMAGE_LIST.map((_, idx) => {
        const m = params.savedStrokes[idx];
        return { bitmapPath: m?.bitmapPath ?? null };
      });
    }
    return LOCAL_IMAGE_LIST.map(() => ({ bitmapPath: null }));
  });

  // 🔊 Voice notes + 🧩 stickers state (per page)
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>(() =>
    Array.isArray(params.voiceNotes) ? params.voiceNotes : []
  );
  const [imageStickers, setImageStickers] = useState<ImageSticker[]>(() =>
    Array.isArray(params.imageStickers) ? params.imageStickers : []
  );

  const [reloadToken, setReloadToken] = useState(0);
  const [loading, setLoading] = useState(false);

  // ✅ Handle Android hardware back to always go to FormTypeScreen
  // ✅ Also bump reloadToken whenever this screen comes into focus,
  //    so overlay images are forced to refresh.
  useFocusEffect(
    useCallback(() => {
      // Every time we come back to this screen (from editor, etc.),
      // bump reloadToken so Image URIs change (`?t=...`) and cache is busted.
      setReloadToken((t) => t + 1);

      const onBackPress = () => {
        navigation.navigate('FormType');
        return true; // block default behaviour
      };

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );

      return () => {
        subscription.remove();
      };
    }, [navigation]),
  );

  // 🔥 When editor comes back with new savedStrokes / overlays, apply them
  useEffect(() => {
    const p = (route.params as any) || {};

    // bitmaps
    if (p.savedStrokes && Array.isArray(p.savedStrokes)) {
      console.log(
        '[FormImageScreen] got payload savedStrokes =',
        p.savedStrokes,
      );
      const metaArr: PageMeta[] = LOCAL_IMAGE_LIST.map((_, idx) => {
        const m = p.savedStrokes[idx];
        return { bitmapPath: m?.bitmapPath ?? null };
      });
      setPageMeta(metaArr);
      setReloadToken((t) => t + 1);
    }

    // overlays: voice notes + stickers
    if (Array.isArray(p.voiceNotes)) {
      setVoiceNotes(p.voiceNotes);
    }
    if (Array.isArray(p.imageStickers)) {
      setImageStickers(p.imageStickers);
    }
  }, [route.params]);

  // ✅ On fresh open (no savedStrokes in params), try to restore from AsyncStorage
  useEffect(() => {
    let isMounted = true;

    const p = (route.params as any) || {};
    // If we already have savedStrokes from editor, don't override them
    if (p.savedStrokes && Array.isArray(p.savedStrokes)) {
      return;
    }

    if (!AsyncStorage) {
      return;
    }

    const loadFromStorage = async () => {
      try {
        setLoading(true);
        const json = await AsyncStorage.getItem(perFormStorageKey);
        if (!isMounted) return;

        if (json) {
          try {
            const parsed = JSON.parse(json);

            // 🧩 Old structure: just an array of bitmaps
            if (Array.isArray(parsed)) {
              const metaArr: PageMeta[] = LOCAL_IMAGE_LIST.map((_, idx) => {
                const m = parsed[idx];
                return { bitmapPath: m?.bitmapPath ?? null };
              });
              setPageMeta(metaArr);
              setReloadToken((t) => t + 1);
              console.log(
                '[FormImageScreen] restored (legacy) from AsyncStorage key =',
                perFormStorageKey,
              );
            } else if (parsed && typeof parsed === 'object') {
              // 🧩 New structure: { bitmaps, voiceNotes, imageStickers }
              if (Array.isArray(parsed.bitmaps)) {
                const metaArr: PageMeta[] = LOCAL_IMAGE_LIST.map((_, idx) => {
                  const m = parsed.bitmaps[idx];
                  return { bitmapPath: m?.bitmapPath ?? null };
                });
                setPageMeta(metaArr);
                setReloadToken((t) => t + 1);
                console.log(
                  '[FormImageScreen] restored (full blob) from AsyncStorage key =',
                  perFormStorageKey,
                );
              }

              if (Array.isArray(parsed.voiceNotes)) {
                setVoiceNotes(parsed.voiceNotes);
              }

              if (Array.isArray(parsed.imageStickers)) {
                setImageStickers(parsed.imageStickers);
              }
            }
          } catch (e) {
            console.warn(
              '[FormImageScreen] failed to parse stored data for key =',
              perFormStorageKey,
              e,
            );
          }
        }
      } catch (e) {
        console.warn(
          '[FormImageScreen] error reading AsyncStorage key =',
          perFormStorageKey,
          e,
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadFromStorage();

    return () => {
      isMounted = false;
    };
  }, [perFormStorageKey, route.params]);

  // 🔗 Open editor for single page (still pass full overlays so they persist)
  const openEditorForPage = (pageIndex: number) => {
    const localModule = LOCAL_IMAGE_LIST[pageIndex] ?? null;
    navigation.navigate('FormImageEditor', {
      imageUri: null,
      localImageModule: localModule,
      formName: formName ?? `form-${pageIndex + 1}`,
      singleImageMode: true,
      storageKey: perFormStorageKey,
      uiStorageKey: undefined,
      pageIndex,
      returnScreen: 'FormImageScreen',
      savedStrokes: pageMeta, // pass current pen overlays
      voiceNotes,
      imageStickers,
    });
  };

  // 🔗 Open full multi-page editor, with all overlays
  const openFullEditor = () => {
    navigation.navigate('FormImageEditor', {
      singleImageMode: false,
      storageKey: perFormStorageKey,
      uiStorageKey: undefined,
      formName,
      returnScreen: 'FormImageScreen',
      savedStrokes: pageMeta, // pass current pen overlays
      voiceNotes,
      imageStickers,
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
      const baseUri = savedPath.startsWith('file://')
        ? savedPath
        : `file://${savedPath}`;
      const stampedUri = `${baseUri}?t=${reloadToken}`;
      overlaySource = { uri: stampedUri };
    }

    // 🔎 Overlays for this page
    const notesForPage = voiceNotes.filter(
      (n) => n.pageIndex === idx
    );
    const stickersForPage = imageStickers.filter(
      (s) => s.pageIndex === idx
    );

    // 🔎 Scale factors: editor used SCREEN_W & PAGE_HEIGHT
    // Card uses width = W - 24, height = H * 0.58
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
          {/* Base form image */}
          <Image
            source={source}
            style={styles.cardImage}
            resizeMode="contain"
          />

          {/* Pen overlay PNG (from native drawing) */}
          {overlaySource && (
            <Image
              key={`overlay-${idx}-${reloadToken}`}
              source={overlaySource}
              style={styles.cardOverlayImage}
              resizeMode="contain"
            />
          )}

          {/* Voice text + stickers overlayed on top (read-only) */}
          <View style={StyleSheet.absoluteFill}>
            {notesForPage.map((note) => (
              <View
                key={note.id}
                style={{
                  position: 'absolute',
                  left: note.x * scaleX,
                  top: note.y * scaleY,
                  transform: [
                    { scale: note.scale * uniformScale },
                  ],
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '500',
                    color: note.color,
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
                  transform: [
                    { scale: sticker.scale * uniformScale },
                  ],
                }}
              >
                {/* This is just a placeholder visual; FormImageEditor uses NameStick.jpeg. 
                    On screen we only need to show that sticker is present. */}
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
      {/* 🔙 Header with back button + title */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.navigate('FormType')}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.title}>
          {formName || 'Form Images'}
        </Text>

        {/* Spacer to balance layout */}
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={true}
      >
        {LOCAL_IMAGE_LIST.map((srcItem, i) => (
          <ThumbCard
            key={`card-${i}`}
            idx={i}
            source={srcItem}
            reloadToken={reloadToken}
          />
        ))}
        <View style={{ height: 92 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.openEditorBtn}
          onPress={openFullEditor}
        >
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
