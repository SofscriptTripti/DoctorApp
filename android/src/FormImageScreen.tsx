import React, { useEffect, useState, useCallback } from 'react';
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
import { getDocumentPageImage, getDocumentPages } from './api/documentsApi';

/* ---------------- STICKERS ---------------- */
const NAME_STICKER_IMAGE = require('./Images/NameStick.jpg');
const DOCTOR_STICKER_SOURCE = require('./Images/Doctor_Sticker.jpg');

/* ---------------- CONSTS ---------------- */
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PAGE_HEIGHT = Math.round(SCREEN_H * 0.75);

/* ---------------- TYPES ---------------- */
type PageItem = {
  pageId: string;
  displayOrderNo: number;
  imageData?: string;
  loading?: boolean;
};

type PageMeta = {
  pageId: string;
  bitmapPath?: string | null;
};

/* ================= SCREEN ================= */
const FormImageScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const params = route.params || {};

  const documentId = params.documentId;
  const formName = params.formName ?? 'Document';
  const formKey = params.formKey;
  const patientName = params.patientName ?? 'Unknown Patient';
  const patientId = params.patientId;
  const patientIP = params.patientIP;
  const perFormStorageKey = params.storageKey ?? 'DoctorApp:pagesBitmaps:v1';

  const [pages, setPages] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageMeta, setPageMeta] = useState<PageMeta[]>([]);
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

  /* ---------- LOAD PAGES & IMAGES ---------- */
  useEffect(() => {
    if (!documentId) return;

    const loadPages = async () => {
      try {
        setLoading(true);

        const res = await getDocumentPages(documentId);

        const sortedPages: PageItem[] = (Array.isArray(res) ? res : res.pages ?? [])
          .sort((a: any, b: any) => a.displayOrderNo - b.displayOrderNo)
          .map((p: any) => ({
            pageId: p.pageId,
            displayOrderNo: p.displayOrderNo,
            loading: true,
          }));

        setPages(sortedPages);
        
        // Initialize page metadata
        setPageMeta(
          sortedPages.map((p: any) => ({
            pageId: p.pageId,
            bitmapPath: null,
          }))
        );

        const pagesWithImages = await Promise.all(
          sortedPages.map(async (page) => {
            try {
              const imageData = await getDocumentPageImage(
                documentId,
                page.pageId
              );
              return { ...page, imageData, loading: false };
            } catch (e) {
              console.error('Image load failed:', page.pageId, e);
              return { ...page, loading: false };
            }
          })
        );

        setPages(pagesWithImages);
      } catch (e) {
        console.error('Failed to load pages', e);
        setPages([]);
      } finally {
        setLoading(false);
      }
    };

    loadPages();
  }, [documentId]);

  /* ---------- PAGE CARD ---------- */
  const PageCard = ({ page, index }: { page: PageItem; index: number }) => {
    const savedPath = pageMeta.find(p => p.pageId === page.pageId)?.bitmapPath;
    
    const overlaySrc = savedPath
      ? { uri: `${savedPath.startsWith('file://') ? savedPath : 'file://' + savedPath}?t=${reloadToken}` }
      : null;

    return (
      <View style={styles.pageCard}>
        <View style={[styles.imageBox, { width: SCREEN_W, height: PAGE_HEIGHT }]}>
          {page.imageData ? (
            <Image
              source={{ uri: page.imageData }}
              style={{ width: SCREEN_W, height: PAGE_HEIGHT }}
              resizeMode="contain"
            />
          ) : page.loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0EA5A4" />
              <Text style={styles.loadingText}>Loading image...</Text>
            </View>
          ) : (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Failed to load image</Text>
            </View>
          )}

          {overlaySrc && (
            <Image
              source={overlaySrc}
              style={StyleSheet.absoluteFill}
              resizeMode="stretch"
            />
          )}

          {imageStickers
            .filter(s => s.pageId === page.pageId)
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
      apiPages: pages.map(p => ({
        pageId: p.pageId,
        displayOrderNo: p.displayOrderNo,
        imageData: p.imageData,
      })),
    });
  };

  /* ---------- UI ---------- */
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
          keyExtractor={(item) => item.pageId}
          renderItem={({ item, index }) => (
            <PageCard page={item} index={index} />
          )}
          showsHorizontalScrollIndicator={false}
        />
      ) : !loading ? (
        <View style={styles.noPagesContainer}>
          <Text style={styles.noPagesText}>No pages found for this document</Text>
        </View>
      ) : null}

      {/* History FAB Button */}
      <TouchableOpacity
        style={styles.historyFab}
        onPress={() => {
          navigation.navigate('EditorHistory');
        }}
      >
        <Text style={styles.historyText}>History</Text>
        <AntDesign name="folderopen" size={28} color="#0EA5A4" />
      </TouchableOpacity>

      {/* Open Full Editor Button */}
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
};

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
  imageBox: {
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    padding: 12,
    backgroundColor: '#f1f5f9',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  footerTxt: { fontSize: 14, fontWeight: '600', color: '#374151' },
  loading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8d7da',
  },
  errorText: { 
    color: '#721c24', 
    fontSize: 16,
    fontWeight: '600',
  },
  noPagesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPagesText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
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
    zIndex: 10,
  },
  historyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 4,
  },
  bottomSafe: { 
    padding: 16,
    backgroundColor: '#fff',
  },
  btn: {
    backgroundColor: '#0EA5A4',
    paddingVertical: 15,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnTxt: { 
    color: '#fff', 
    marginLeft: 10, 
    fontSize: 16, 
    fontWeight: '700' 
  },
}); 