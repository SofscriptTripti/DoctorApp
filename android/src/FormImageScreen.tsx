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
  Platform,
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

// Name sticker image
const NAME_STICKER_IMAGE = require('./Images/NameStick.jpeg');

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

  // 🔥 FIX: Add a state to track if we're receiving fresh data
  const [isReceivingFreshData, setIsReceivingFreshData] = useState(false);

  useFocusEffect(
    useCallback(() => {
      console.log('[FormImageScreen] Focused, checking for fresh data...');
      
      // Check if we have fresh data in route.params
      const freshParams = (route.params as any) || {};
      if (freshParams.savedStrokes && Array.isArray(freshParams.savedStrokes)) {
        console.log('[FormImageScreen] Fresh data detected on focus');
        setIsReceivingFreshData(true);
        
        // Update state with fresh data
        const metaArr: PageMeta[] = imagesForThisForm.map((_, idx) => {
          const m = freshParams.savedStrokes[idx];
          return { bitmapPath: m?.bitmapPath ?? null };
        });
        setPageMeta(metaArr);
        
        if (Array.isArray(freshParams.voiceNotes)) {
          setVoiceNotes(freshParams.voiceNotes);
        }
        
        if (Array.isArray(freshParams.imageStickers)) {
          setImageStickers(freshParams.imageStickers);
        }
        
        setReloadToken(t => t + 1);
        
        // Clear the params after processing to avoid re-processing
        setTimeout(() => {
          navigation.setParams({
            savedStrokes: undefined,
            voiceNotes: undefined,
            imageStickers: undefined
          });
        }, 100);
      }

      const onBackPress = () => {
        // ensure this route exists in your navigator
        navigation.navigate('FormType');
        return true;
      };

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress
      );

      return () => {
        subscription.remove();
        setIsReceivingFreshData(false);
      };
    }, [navigation, route.params, imagesForThisForm])
  );

  useEffect(() => {
    const p = (route.params as any) || {};

    if (p.savedStrokes && Array.isArray(p.savedStrokes)) {
      console.log('[FormImageScreen] useEffect: Received savedStrokes from params');
      const metaArr: PageMeta[] = imagesForThisForm.map((_, idx) => {
        const m = p.savedStrokes[idx];
        return { bitmapPath: m?.bitmapPath ?? null };
      });
      setPageMeta(metaArr);
      setReloadToken((t) => t + 1);
    }

    if (Array.isArray(p.voiceNotes)) {
      console.log('[FormImageScreen] useEffect: Received voiceNotes from params');
      setVoiceNotes(p.voiceNotes);
    }
    
    if (Array.isArray(p.imageStickers)) {
      console.log('[FormImageScreen] useEffect: Received imageStickers from params');
      setImageStickers(p.imageStickers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params]);

  useEffect(() => {
    let isMounted = true;

    // 🔥 FIX: Only load from storage if we're not receiving fresh data
    if (isReceivingFreshData) {
      console.log('[FormImageScreen] Skipping storage load - receiving fresh data');
      return;
    }

    const p = (route.params as any) || {};
    if (p.savedStrokes && Array.isArray(p.savedStrokes)) {
      console.log('[FormImageScreen] Already have savedStrokes in params, skipping storage load');
      return;
    }

    if (!AsyncStorage) {
      console.log('[FormImageScreen] AsyncStorage not available');
      return;
    }

    const loadFromStorage = async () => {
      try {
        setLoading(true);
        console.log('[FormImageScreen] Loading from storage key:', perFormStorageKey);
        const json = await AsyncStorage.getItem(perFormStorageKey);
        if (!isMounted) return;
        
        if (json) {
          try {
            const parsed = JSON.parse(json);
            console.log('[FormImageScreen] Parsed storage data');
            
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
                console.log('[FormImageScreen] Setting voice notes from storage:', parsed.voiceNotes.length);
                setVoiceNotes(parsed.voiceNotes);
              }

              if (Array.isArray(parsed.imageStickers)) {
                console.log('[FormImageScreen] Setting image stickers from storage:', parsed.imageStickers.length);
                setImageStickers(parsed.imageStickers);
              }
            }
          } catch (e) {
            console.warn('[FormImageScreen] failed to parse stored data', e);
          }
        } else {
          console.log('[FormImageScreen] No data in storage');
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
  }, [perFormStorageKey, imagesForThisForm, isReceivingFreshData, route.params]);

  const openEditorForPage = (pageIndex: number) => {
    const localModule = imagesForThisForm[pageIndex] ?? null;
    
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
      formKey: formKey,
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
      formKey: formKey,
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

    return (
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={() => openEditorForPage(idx)}
        style={styles.card}
      >
        <View style={styles.cardImageContainer}>
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
            {/* Voice Notes */}
            {notesForPage.map((note) => (
              <View
                key={note.id}
                style={{
                  position: 'absolute',
                  left: note.x * scaleX,
                  top: note.y * scaleY,
                }}
              >
                <Text
                  style={{
                    fontSize: Math.max(10, (note.fontSize || 14) * Math.min(scaleX, scaleY)),
                    fontWeight: '500',
                    color: note.color || '#000',
                    backgroundColor: 'rgba(255, 255, 255, 0.7)',
                    paddingHorizontal: 4,
                    paddingVertical: 2,
                    borderRadius: 2,
                    includeFontPadding: false,
                  }}
                  numberOfLines={2}
                >
                  {note.text}
                </Text>
              </View>
            ))}

            {/* Image Stickers */}
            {stickersForPage.map((sticker) => {
              const stickerWidth = sticker.width || 140;
              const stickerHeight = sticker.height || 90;
              const scaledWidth = stickerWidth * scaleX;
              const scaledHeight = stickerHeight * scaleY;
              
              return (
                <View
                  key={sticker.id}
                  style={{
                    position: 'absolute',
                    left: sticker.x * scaleX,
                    top: sticker.y * scaleY,
                    width: scaledWidth,
                    height: scaledHeight,
                    borderRadius: 8,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: '#0EA5A4',
                    backgroundColor: 'rgba(14, 165, 164, 0.3)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Image
                    source={NAME_STICKER_IMAGE}
                    style={{
                      width: '100%',
                      height: '100%',
                    }}
                    resizeMode="contain"
                  />
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.cardTitle}>Page {idx + 1}</Text>
          
          {/* Show indicator if there's content */}
          {(isSaved || notesForPage.length > 0 || stickersForPage.length > 0) && (
            <View style={styles.contentIndicator}>
              {isSaved && <Ionicons name="pencil" size={14} color="#0EA5A4" style={styles.indicatorIcon} />}
              {notesForPage.length > 0 && <Ionicons name="chatbubble-outline" size={14} color="#E4572E" style={styles.indicatorIcon} />}
              {stickersForPage.length > 0 && <Ionicons name="image-outline" size={14} color="#16a34a" style={styles.indicatorIcon} />}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Status Bar Safe Area for Android */}
      {Platform.OS === 'android' && <View style={styles.statusBarSpacer} />}
      
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.navigate('FormType')}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {formName || 'Form Images'}
          </Text>

          <View style={styles.headerPlaceholder} />
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          bounces={true}
        >
          {imagesForThisForm.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>
                No images available for this form
              </Text>
              <Text style={styles.emptySubText}>
                Form key: {String(formKey)}
              </Text>
            </View>
          )}

          {imagesForThisForm.map((srcItem, i) => (
            <ThumbCard key={`card-${i}`} idx={i} source={srcItem} reloadToken={reloadToken} />
          ))}
          
          {/* Add extra space at the bottom to ensure content doesn't hide behind the fixed button */}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Fixed bottom button with safe area handling */}
        <SafeAreaView style={styles.footerSafeArea} edges={['bottom', 'left', 'right']}>
          <View style={styles.footerContainer}>
            <TouchableOpacity 
              style={styles.openEditorBtn} 
              onPress={openFullEditor}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={22} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.openEditorBtnText}>Open Full Editor</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {loading && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0EA5A4" />
              <Text style={styles.loadingText}>Loading form data...</Text>
            </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  statusBarSpacer: {
    height: Platform.OS === 'android' ? 24 : 0,
    backgroundColor: '#0EA5A4',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0EA5A4',
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backBtn: {
    padding: 4,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
    marginHorizontal: 12,
  },
  headerPlaceholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120, // Extra padding to ensure content clears the fixed button
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 18,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 4,
  },
  emptySubText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardImageContainer: {
    width: '100%',
    height: H * 0.58,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cardTitle: {
    fontWeight: '600',
    fontSize: 16,
    color: '#374151',
  },
  contentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicatorIcon: {
    marginLeft: 8,
  },
  bottomSpacer: {
    height: 100, // Space at the bottom of scroll content
  },
  footerSafeArea: {
    backgroundColor: '#fff',
  },
  footerContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 4 : 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 8,
  },
  openEditorBtn: {
    backgroundColor: '#0EA5A4',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  buttonIcon: {
    marginRight: 10,
  },
  openEditorBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 0.25,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 30,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4b5563',
    fontWeight: '500',
  },
});

export default FormImageScreenInternal;
export { FormImageScreenInternal as FormImageScreen };