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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useRoute,
  useNavigation,
  useFocusEffect,
} from '@react-navigation/native';

const { width: W, height: H } = Dimensions.get('window');

// try to resolve a module that exports image requires (keeps compatibility)
const resolveImages = (): any | null => {
  try {
    return require('./Images').default ?? require('./Images');
  } catch (_) {}
  try {
    return require('../android/src/Images').default ?? require('../android/src/Images');
  } catch (_) {}
  try {
    return require('../src/Images').default ?? require('../src/Images');
  } catch (_) {}
  return null;
};

const Images = resolveImages();

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

// AsyncStorage fallback loader
let AsyncStorage: any = null;
try {
  AsyncStorage =
    require('@react-native-async-storage/async-storage').default;
} catch (e) {
  AsyncStorage = null;
}

// Same structure that editor saves: { bitmapPath?: string | null }
type PageMeta = { bitmapPath?: string | null };

export function FormImageScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const params = (route.params as any) || {};
  const formName: string | undefined = params.formName;

  // IMPORTANT: same default key as editor: DoctorApp:pagesBitmaps:v1
  const perFormStorageKey =
    (params.storageKey as string | undefined) ??
    `DoctorApp:pagesBitmaps:v1`;

  const [loading, setLoading] = useState(false);
  const [pageMeta, setPageMeta] = useState<PageMeta[]>(() =>
    LOCAL_IMAGE_LIST.map(() => ({ bitmapPath: null }))
  );
  const [checkingSaved, setCheckingSaved] = useState(false);

  // 🔁 token used only to force React to remount overlay <Image> when data refreshes
  const [reloadToken, setReloadToken] = useState(0);

  // Load saved bitmap paths from AsyncStorage (written by editor)
  const checkSavedPages = useCallback(async () => {
    if (!AsyncStorage) {
      setPageMeta(
        LOCAL_IMAGE_LIST.map(() => ({ bitmapPath: null }))
      );
      setReloadToken((t) => t + 1);
      return;
    }

    setCheckingSaved(true);
    try {
      const raw = await AsyncStorage.getItem(perFormStorageKey);
      if (!raw) {
        setPageMeta(
          LOCAL_IMAGE_LIST.map(() => ({ bitmapPath: null }))
        );
        setReloadToken((t) => t + 1);
        setCheckingSaved(false);
        return;
      }

      const parsed = JSON.parse(raw);
      if (
        Array.isArray(parsed) &&
        parsed.length === LOCAL_IMAGE_LIST.length
      ) {
        const metaArr: PageMeta[] = LOCAL_IMAGE_LIST.map((_, idx) => {
          const m = parsed[idx];
          return { bitmapPath: m?.bitmapPath ?? null };
        });
        setPageMeta(metaArr);
      } else {
        setPageMeta(
          LOCAL_IMAGE_LIST.map(() => ({ bitmapPath: null }))
        );
      }

      // bump token so overlay Image gets a new key and reloads from disk
      setReloadToken((t) => t + 1);
    } catch (e) {
      console.warn('[FormImageScreen] error reading saved pages:', e);
      setPageMeta(
        LOCAL_IMAGE_LIST.map(() => ({ bitmapPath: null }))
      );
      setReloadToken((t) => t + 1);
    } finally {
      setCheckingSaved(false);
    }
  }, [perFormStorageKey]);

  // When screen comes into focus (including after going back from editor),
  // refresh immediately AND once more after a short delay, so we catch
  // the latest AsyncStorage writes.
  useFocusEffect(
    React.useCallback(() => {
      checkSavedPages();
      const timer = setTimeout(() => {
        checkSavedPages();
      }, 500);
      return () => clearTimeout(timer);
    }, [checkSavedPages])
  );

  // Initial mount
  useEffect(() => {
    checkSavedPages();
  }, [checkSavedPages]);

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
      // so editor knows where to return if needed
      returnScreen: 'FormImageScreen',
    });
  };

  // Open the multi-page editor (full editor)
  const openFullEditor = () => {
    navigation.navigate('FormImageEditor', {
      singleImageMode: false,
      storageKey: perFormStorageKey,
      uiStorageKey: undefined,
      formName,
      returnScreen: 'FormImageScreen',
    });
  };

  // Thumbnail / Card for vertical list — shows form image + drawing overlay + "Saved" badge
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

    // Prepare URI for overlay PNG if it exists
    let overlaySource: any = null;
    if (isSaved && savedPath) {
      const baseUri = savedPath.startsWith('file://')
        ? savedPath
        : `file://${savedPath}`;

      // IMPORTANT: add reloadToken as query param to break cache
      const stampedUri = `${baseUri}?t=${reloadToken}`;

      overlaySource = {
        uri: stampedUri,
      };
    }

    return (
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={() => openEditorForPage(idx)}
        style={styles.card}
      >
        {/* Container so we can stack base image + overlay */}
        <View style={styles.cardImageContainer}>
          {/* Base form image */}
          <Image
            source={source}
            style={styles.cardImage}
            resizeMode="contain"
          />

          {/* Overlay strokes PNG saved by editor */}
          {overlaySource && (
            <Image
              key={`overlay-${idx}-${reloadToken}`}
              source={overlaySource}
              style={styles.cardOverlayImage}
              resizeMode="contain"
            />
          )}
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.cardTitle}>Page {idx + 1}</Text>
          {/* {isSaved ? (
            <View style={styles.savedBadge}>
              <Text style={styles.savedBadgeText}>Saved</Text>
            </View>
          ) : null} */}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {(formName as string) || 'Form Images'}
        </Text>
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

  savedBadge: {
    backgroundColor: '#0EA5A4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  savedBadgeText: { color: '#fff', fontWeight: '700' },

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
