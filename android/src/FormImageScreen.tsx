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
import { getDocumentPages } from './api/documentsApi';

/* ---------------- STICKERS ---------------- */
const NAME_STICKER_IMAGE = require('./Images/NameStick.jpg');
const DOCTOR_STICKER_SOURCE = require('./Images/Doctor_Sticker.jpg');

/* ---------------- CONSTS ---------------- */
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PAGE_HEIGHT = Math.round(SCREEN_H * 0.75);
const DEFAULT_IMAGES: any[] = [];

let AsyncStorage: any = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch {}

type PageMeta = { bitmapPath?: string | null };

/* ================== SCREEN ================== */
function FormImageScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const params = route.params || {};

  const formName = params.formName;
  const formKey = params.formKey;
  const documentId = params.documentId || params.formKey;

  const patientName = params.patientName ?? 'Unknown Patient';
  const patientId = params.patientId;
  const patientIP = params.patientIP;

  const perFormStorageKey = params.storageKey ?? 'DoctorApp:pagesBitmaps:v1';
  const imagesForThisForm = params.IMAGES_BY_FORM?.[formKey ?? ''] ?? DEFAULT_IMAGES;

  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  /* ---------- FOCUS EFFECT ---------- */
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

  /* ---------- LOAD DOCUMENT PAGES ---------- */
  useEffect(() => {
    if (!documentId) return;

    const loadPages = async () => {
      try {
        setLoading(true);
        console.log('📄 Fetching pages for document:', documentId);

        const res = await getDocumentPages(documentId);
        console.log('📄 Pages response:', res);

        // Adjust based on your API response structure
        setPages(Array.isArray(res) ? res : res.pages ?? []);
      } catch (e) {
        console.error('Failed to load document pages', e);
        setPages([]);
      } finally {
        setLoading(false);
      }
    };

    loadPages();
  }, [documentId]);

  /* ---------- PAGE CARD COMPONENT ---------- */
  const PageCard = ({ page, index }: { page: any; index: number }) => {
    const savedPath = pageMeta[index]?.bitmapPath;
    const overlaySrc = savedPath
      ? { uri: `${savedPath.startsWith('file://') ? savedPath : 'file://' + savedPath}?t=${reloadToken}` }
      : null;

    return (
      <View style={styles.pageCard}>
        <View style={[styles.imageBox, { width: SCREEN_W, height: PAGE_HEIGHT }]}>
          <Image
            source={{ uri: page.imageUrl || page.url || page.uri }}
            style={{ width: SCREEN_W, height: PAGE_HEIGHT }}
            resizeMode="contain"
          />

          {overlaySrc && (
            <Image
              source={overlaySrc}
              style={StyleSheet.absoluteFill}
              resizeMode="stretch"
            />
          )}

          {imageStickers
            .filter(s => s.pageIndex === index)
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
            Page {index + 1} of {pages.length}
          </Text>
        </View>
      </View>
    );
  };

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
      documentId,
     apiPages: pages,
    });
  };

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

      {pages.length > 0 ? (
        <FlatList
          data={pages}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, index) => `page-${index}`}
          renderItem={({ item, index }) => <PageCard page={item} index={index} />}
        />
      ) : (
        !loading && (
          <View style={styles.noPagesContainer}>
            <Text style={styles.noPagesText}>No pages found for this document</Text>
          </View>
        )
      )}

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
  noPagesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPagesText: {
    fontSize: 16,
    color: '#666',
  },
});