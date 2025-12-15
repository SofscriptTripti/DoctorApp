import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AntDesign from 'react-native-vector-icons/AntDesign';

/* ---------------- FORM IMAGES ---------------- */

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

  doctor_chart: [
    require('./Images/17 Diabetic Chart 2.jpg'),
  ],
};

/* ---------------- STICKERS ---------------- */

const NAME_STICKER_IMAGE = require('./Images/NameStick.jpg');
const DOCTOR_STICKER_SOURCE = require('./Images/Doctor_Sticker.jpg');

/* ---------------- CONSTS ---------------- */

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PAGE_HEIGHT = Math.round(SCREEN_H * 0.75);
const DEFAULT_IMAGES: any[] = [];

type PageMeta = { bitmapPath?: string | null };

let AsyncStorage: any = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch {}

/* ================== SCREEN ================== */

function FormImageScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const params = route.params || {};

  const formName = params.formName;
  const formKey = params.formKey;

  const patientName = params.patientName ?? 'Unknown Patient';
  const patientId = params.patientId;
  const patientIP = params.patientIP;

  const perFormStorageKey =
    params.storageKey ?? 'DoctorApp:pagesBitmaps:v1';

  const imagesForThisForm =
    IMAGES_BY_FORM[formKey ?? ''] ?? DEFAULT_IMAGES;

  const [pageMeta, setPageMeta] = useState<PageMeta[]>(
    imagesForThisForm.map(() => ({ bitmapPath: null }))
  );

  const [voiceNotes, setVoiceNotes] = useState<any[]>(
    Array.isArray(params.voiceNotes) ? params.voiceNotes : []
  );

  const [imageStickers, setImageStickers] = useState<any[]>(
    Array.isArray(params.imageStickers) ? params.imageStickers : []
  );

  const [reloadToken, setReloadToken] = useState(0);
  const [loading, setLoading] = useState(false);

  /* ---------- FOCUS ---------- */

  useFocusEffect(
    useCallback(() => {
      const p = route.params || {};

      if (Array.isArray(p.savedStrokes)) {
        setPageMeta(p.savedStrokes);
        setVoiceNotes(p.voiceNotes || []);
        setImageStickers(p.imageStickers || []);
        setReloadToken(t => t + 1);

        setTimeout(() => {
          navigation.setParams({
            savedStrokes: undefined,
            voiceNotes: undefined,
            imageStickers: undefined,
          });
        }, 100);
      }

      const onBackPress = () => {
        navigation.goBack();
        return true;
      };

      const sub = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress
      );

      return () => sub.remove();
    }, [route.params])
  );

  /* ---------- LOAD STORAGE ---------- */

  useEffect(() => {
    if (!AsyncStorage) return;
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const raw = await AsyncStorage.getItem(perFormStorageKey);
        if (!mounted || !raw) return;

        const parsed = JSON.parse(raw);
        parsed.bitmaps && setPageMeta(parsed.bitmaps);
        parsed.voiceNotes && setVoiceNotes(parsed.voiceNotes);
        parsed.imageStickers && setImageStickers(parsed.imageStickers);

        setReloadToken(t => t + 1);
      } catch (e) {
        console.warn('Storage load error', e);
      } finally {
        mounted && setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [perFormStorageKey]);

  /* ---------- OPEN EDITOR ---------- */

  const openFullEditor = () => {
    navigation.navigate('FormImageEditor', {
      singleImageMode: false,
      storageKey: perFormStorageKey,
      savedStrokes: pageMeta,
      voiceNotes,
      imageStickers,
      formKey,
      formName,
      patientName,
      patientId,
      patientIP,
    });
  };

  /* ---------- PAGE CARD ---------- */

  const PageCard = ({ idx, source }: any) => {
    const savedPath = pageMeta[idx]?.bitmapPath;
    const overlaySrc = savedPath
      ? { uri: `${savedPath.startsWith('file://') ? savedPath : 'file://' + savedPath}?t=${reloadToken}` }
      : null;

    return (
      <View style={styles.pageCard}>
        <View style={[styles.imageBox, { width: SCREEN_W, height: PAGE_HEIGHT }]}>
          <Image
            source={source}
            style={{ width: SCREEN_W, height: PAGE_HEIGHT }}
            resizeMode="stretch"
          />

          {overlaySrc && (
            <Image
              source={overlaySrc}
              style={StyleSheet.absoluteFill}
              resizeMode="stretch"
            />
          )}

          {imageStickers
            .filter(s => s.pageIndex === idx)
            .map(s => {
              const stickerSource =
                s.stickerType === 'doctor'
                  ? DOCTOR_STICKER_SOURCE
                  : NAME_STICKER_IMAGE;

              return (
                <Image
                  key={s.id}
                  source={stickerSource}
                  style={{
                    position: 'absolute',
                    left: s.x,
                    top: s.y,
                    width: s.width || 140,
                    height: s.height || 90,
                    resizeMode: 'contain',
                  }}
                />
              );
            })}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerTxt}>
            Page {idx + 1} of {imagesForThisForm.length}
          </Text>
        </View>
      </View>
    );
  };

  /* ---------- RENDER ---------- */

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#0EA5A4' }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{formName}</Text>
          <View style={{ width: 30 }} />
        </View>
      </SafeAreaView>

      <FlatList
        data={imagesForThisForm}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => `p-${i}`}
        renderItem={({ item, index }) => (
          <PageCard idx={index} source={item} />
        )}
      />

      {/* ---------- FLOATING HISTORY BUTTON ---------- */}
      <TouchableOpacity
        style={styles.historyFab}
        onPress={() => {
      navigation.navigate('EditorHistory');

        }}
      >
        <Text style={styles.historyText}>History</Text>
        <AntDesign name="folderopen" size={22} color="#0EA5A4" />
      </TouchableOpacity>

      <SafeAreaView edges={['bottom']} style={styles.bottomSafe}>
        <TouchableOpacity style={styles.btn} onPress={openFullEditor}>
          <Ionicons name="create-outline" size={22} color="#fff" />
          <Text style={styles.btnTxt}>Open Full Editor</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#0EA5A4" />
        </View>
      )}
    </View>
  );
}

export default FormImageScreen;

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  header: {
    height: 52,
    backgroundColor: '#0EA5A4',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  title: { color: '#fff', fontSize: 17, fontWeight: '700' },

  pageCard: { flex: 1 },

  imageBox: { backgroundColor: '#f8fafc' },

  footer: {
    padding: 12,
    backgroundColor: '#f1f5f9',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },

  footerTxt: { fontSize: 14, fontWeight: '600', color: '#374151' },

  bottomSafe: { padding: 16 },

  btn: {
    backgroundColor: '#0EA5A4',
    paddingVertical: 15,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  btnTxt: { color: '#fff', marginLeft: 10, fontSize: 16, fontWeight: '700' },

  loading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ---------- HISTORY FAB ---------- */
  historyFab: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  historyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 4,
  },
});
