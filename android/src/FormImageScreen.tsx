// src/FormImageScreen.tsx
// Session-only: uses navigation payload, not AsyncStorage, to show overlays.

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

const { width: W, height: H } = Dimensions.get('window');

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

  const [reloadToken, setReloadToken] = useState(0);
  const [loading] = useState(false);

  // ✅ Handle Android hardware back to always go to FormTypeScreen
  useFocusEffect(
    useCallback(() => {
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

  // 🔥 When editor comes back with new savedStrokes, apply them
  useEffect(() => {
    const p = (route.params as any) || {};
    if (p.savedStrokes && Array.isArray(p.savedStrokes)) {
      console.log('[FormImageScreen] got payload savedStrokes =', p.savedStrokes);
      const metaArr: PageMeta[] = LOCAL_IMAGE_LIST.map((_, idx) => {
        const m = p.savedStrokes[idx];
        return { bitmapPath: m?.bitmapPath ?? null };
      });
      setPageMeta(metaArr);
      setReloadToken((t) => t + 1);
    }
  }, [route.params]);

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
      savedStrokes: pageMeta, // pass current session strokes
    });
  };

  const openFullEditor = () => {
    navigation.navigate('FormImageEditor', {
      singleImageMode: false,
      storageKey: perFormStorageKey,
      uiStorageKey: undefined,
      formName,
      returnScreen: 'FormImageScreen',
      savedStrokes: pageMeta, // pass current session strokes
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

    return (
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={() => openEditorForPage(idx)}
        style={styles.card}
      >
        <View style={styles.cardImageContainer}>
          <Image
            source={source}
            style={styles.cardImage}
            resizeMode="contain"
          />

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
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {formName || 'Form Images'}
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
