// src/FormImageScreen.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from './theme/ThemeContext';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AntDesign from 'react-native-vector-icons/AntDesign';
import {
  getDocumentPageImage,
  getDocumentPages,
} from './api/documentsApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getpagewiseoverlay,
  createPatientDocument
} from './api/patientDocumentsApi';
import { Buffer } from 'buffer';
import NativeDrawingView from './components/NativeDrawingView';

/* ---------------- STICKERS ---------------- */
const NAME_STICKER_IMAGE = require('./Images/NameStick.jpg');
const DOCTOR_STICKER_SOURCE = require('./Images/Doctor_Sticker.jpg');

/* ---------------- CONSTS ---------------- */
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PAGE_HEIGHT = Math.round(SCREEN_H * 0.83);

// AsyncStorage keys
const STORAGE_KEYS = {
  patientId: 'patientId',
  admissionNo: 'admissionNo',
  documentId: 'documentId',
  documentInstanceId: 'documentInstanceId',
  documentCd: 'documentId'
};

/* ---------------- TYPES ---------------- */
type PageItem = {
  pageId: string;
  displayOrderNo: number;
  imageData?: string;
  overlayData?: string;
  loading?: boolean;
  overlayLoading?: boolean;
  overlayExists?: boolean;
  hasImage: boolean;
  errorMessage?: string;
  overlayErrorMessage?: string;
};

type PageMeta = {
  pageId: string;
  bitmapPath?: string | null;
};

const tryParseStrokesJson = (base64?: string): string | null => {
  if (!base64) return null;
  try {
    // Attempt decoding
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    // Simple heuristic: if it starts with '[', assuming it's our JSON array
    if (decoded.trim().startsWith('[')) {
      return decoded;
    }
  } catch (e) {
    // If it fails, likely a binary PNG that doesn't decode to text nicely
  }
  return null;
};

/* ================= SCREEN ================= */
const FormImageScreen = () => {
  const { colors, isDark } = useTheme();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const params = route.params || {};

  const [documentInstanceId, setDocumentInstanceId] = useState<string | undefined>(params.documentInstanceId);
  const [documentId, setDocumentId] = useState<string | undefined>(params.documentId);
  const [storedDocumentId, setStoredDocumentId] = useState<string>('');
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
  const [shouldReload, setShouldReload] = useState(true);
  const [hasDocumentContext, setHasDocumentContext] = useState(false);
  const [hasValidImages, setHasValidImages] = useState(false);
  const [loadingOverlays, setLoadingOverlays] = useState(false);
  const [isCreatingDocument, setIsCreatingDocument] = useState(false);
  const overlayLoadedRef = useRef(false);

  const loadedDocumentInstanceIdRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);

  /* ---------- HELPER: GET INSTANCE STORAGE KEY ---------- */
  const getInstanceStorageKey = useCallback(() => {
    // Unique key per Admission + Document
    // Handle cases where admissionNo might be missing (fallback to patientId)
    const adm = params.admissionNo || params.patientId || 'UNKNOWN_ADM';
    const doc = params.documentId || storedDocumentId || 'UNKNOWN_DOC';
    return `DOC_INST_${adm}_${doc}`;
  }, [params.admissionNo, params.patientId, params.documentId, storedDocumentId]);


  /* ---------- CREATE DOCUMENT INSTANCE ---------- */
  const createNewDocumentInstance = useCallback(async (): Promise<string | null> => {
    try {
      setIsCreatingDocument(true);

      // Get required data from AsyncStorage
      const [[, patientNo], [, admissionNo], [, documentId], [, documentCd]] =
        await AsyncStorage.multiGet([
          STORAGE_KEYS.patientId,
          STORAGE_KEYS.admissionNo,
          STORAGE_KEYS.documentId,
          STORAGE_KEYS.documentCd,
        ]);

      console.log('Creating document instance with:', {
        patientNo,
        admissionNo,
        documentId,
        documentCd
      });

      // Validate required data
      if (!patientNo || !admissionNo || !documentCd) {
        console.error('Missing required data for creating document instance');
        Alert.alert('Error', 'Missing patient info.');
        return null;
      }

      // Call API to create document instance
      const response = await createPatientDocument(
        patientNo,
        admissionNo,
        documentCd
      );

      console.log('Document instance created:', response);

      if (response?.documentInstanceId) {
        // Save using UNIQUE KEY
        const uniqueKey = getInstanceStorageKey();
        await AsyncStorage.setItem(uniqueKey, response.documentInstanceId);

        console.log('Saved documentInstanceId to:', uniqueKey, '=', response.documentInstanceId);
        return response.documentInstanceId;
      } else {
        console.error('No documentInstanceId in API response');
        return null;
      }
    } catch (error: any) {
      console.error('Failed to create document instance:', error);
      return null;
    } finally {
      setIsCreatingDocument(false);
    }
  }, [navigation, getInstanceStorageKey]);

  /* ---------- GET DOCUMENT CONTEXT FROM STORAGE ---------- */
  const getDocumentContextFromStorage = useCallback(async (): Promise<{
    patientNo: string;
    admissionNo: string;
    documentId: string;
    documentInstanceId: string;
  } | null> => {
    try {
      const uniqueKey = getInstanceStorageKey();

      const [[, patientNo], [, admissionNo], [, documentId], [, documentInstanceId]] =
        await AsyncStorage.multiGet([
          STORAGE_KEYS.patientId,
          STORAGE_KEYS.admissionNo,
          STORAGE_KEYS.documentId,
          uniqueKey, // Use unique key here
        ]);

      console.log('Retrieved from AsyncStorage:', {
        uniqueKey,
        documentInstanceId
      });

      // Store the retrieved documentId for display
      if (documentId) {
        setStoredDocumentId(documentId);
      }

      // If we have documentInstanceId, use it
      if (documentInstanceId) {
        return {
          patientNo: patientNo || '',
          admissionNo: admissionNo || '',
          documentId: documentId || '',
          documentInstanceId: documentInstanceId || ''
        };
      }

      return null;
    } catch (e) {
      console.error('❌ Failed to read document context from AsyncStorage', e);
      return null;
    }
  }, [getInstanceStorageKey]);

  /* ---------- LOAD DOCUMENT ID FROM STORAGE ---------- */
  const loadDocumentIdFromStorage = useCallback(async () => {
    try {
      // Directly get documentId from AsyncStorage
      const storedDocId = await AsyncStorage.getItem(STORAGE_KEYS.documentId);
      console.log('Loaded documentId from AsyncStorage:', storedDocId);

      if (storedDocId) {
        setStoredDocumentId(storedDocId);
      }
    } catch (error) {
      console.error('Error loading documentId from storage:', error);
    }
  }, []);

  /* ---------- LOAD OR CREATE DOCUMENT CONTEXT ---------- */
  const loadDocumentContext = useCallback(async () => {
    try {
      // First check if we have documentInstanceId in params
      if (params.documentInstanceId) {
        console.log('Using documentInstanceId from params:', params.documentInstanceId);
        setDocumentInstanceId(params.documentInstanceId);
        setDocumentId(params.documentId);
        setHasDocumentContext(true);
        return;
      }

      console.log('documentInstanceId not in params, checking AsyncStorage...');

      // Try to get existing document context
      const context = await getDocumentContextFromStorage();

      if (context?.documentInstanceId) {
        console.log('Found existing document context in AsyncStorage:', context);
        setDocumentInstanceId(context.documentInstanceId);
        setDocumentId(context.documentId);
        setHasDocumentContext(true);
      } else {
        console.log('No existing document instance found, creating new one...');

        // Create new document instance
        const newInstanceId = await createNewDocumentInstance();

        if (newInstanceId) {
          console.log('New document instance created:', newInstanceId);
          setDocumentInstanceId(newInstanceId);
          setHasDocumentContext(true);

          // Load document ID from storage again
          const storedDocId = await AsyncStorage.getItem(STORAGE_KEYS.documentId);
          if (storedDocId) {
            setStoredDocumentId(storedDocId);
          }
        } else {
          console.error('Failed to create document instance');
          setHasDocumentContext(false);
        }
      }
    } catch (error) {
      console.error('Error loading document context:', error);
      setHasDocumentContext(false);
    }
  }, [params.documentInstanceId, params.documentId, getDocumentContextFromStorage, createNewDocumentInstance]);

  /* ---------- LOAD ALL OVERLAYS USING PAGE-WISE API ---------- */
  const loadAllOverlays = useCallback(async () => {
    if (!documentInstanceId || pages.length === 0) {
      console.log('Cannot load overlays: documentInstanceId =', documentInstanceId, 'pages.length =', pages.length);
      return;
    }

    console.log(`[OVERLAY] Loading overlays via page-wise API for document instance: ${documentInstanceId}, ${pages.length} pages...`);
    setLoadingOverlays(true);

    try {
      // 🔥 Fetch ALL overlays in a single API call using documentInstanceId
      const pageWiseOverlayData = await getpagewiseoverlay(documentInstanceId);
      console.log('[OVERLAY] Page-wise API response received');

      // Create a map for quick lookup
      const overlayMap = new Map();
      if (Array.isArray(pageWiseOverlayData)) {
        console.log(`[OVERLAY] Found ${pageWiseOverlayData.length} overlays in response`);
        pageWiseOverlayData.forEach((item: any) => {
          if (item.pageId && item.overlayDataBase64) {
            console.log(`[OVERLAY] Overlay found for page ${item.pageId}, hasOverlay: ${item.hasOverlay}`);
            overlayMap.set(item.pageId, {
              base64: item.overlayDataBase64,
              contentType: item.contentType || 'image/png',
              hasOverlay: item.hasOverlay
            });
          }
        });
      } else {
        console.log('[OVERLAY] Response is not an array or is empty');
      }

      // Update all pages with overlay data
      setPages(prev =>
        prev.map(page => {
          const overlayInfo = overlayMap.get(page.pageId);

          if (overlayInfo && overlayInfo.hasOverlay && overlayInfo.base64) {
            const overlayUri = `data:${overlayInfo.contentType};base64,${overlayInfo.base64}`;
            console.log(`[OVERLAY] Created overlay URI for page ${page.pageId}`);
            return {
              ...page,
              overlayData: overlayUri,
              overlayExists: true,
              overlayLoading: false
            };
          } else {
            console.log(`[OVERLAY] No overlay for page ${page.pageId}`);
            return {
              ...page,
              overlayData: undefined,
              overlayExists: false,
              overlayLoading: false
            };
          }
        })
      );

      console.log('[OVERLAY] Finished updating all pages with overlay data');
    } catch (error: any) {
      console.error('[OVERLAY] Error loading overlays:', {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data
      });

      // Set all pages to have no overlay
      setPages(prev =>
        prev.map(page => ({
          ...page,
          overlayData: undefined,
          overlayExists: false,
          overlayLoading: false
        }))
      );
    } finally {
      setLoadingOverlays(false);
    }
  }, [documentInstanceId, pages.length]);

  /* ---------- FOCUS EFFECT ---------- */
  useFocusEffect(
    useCallback(() => {
      console.log('FormImageScreen focused');

      // Load document ID from storage for display
      loadDocumentIdFromStorage();

      // Load or create document context
      loadDocumentContext();

      const p = route.params || {};

      if (Array.isArray(p.savedStrokes)) {
        console.log('Received updated data from editor');
        setPageMeta(p.savedStrokes);
        setVoiceNotes(p.voiceNotes || []);
        setImageStickers(p.imageStickers || []);
        setReloadToken(t => t + 1);
        setShouldReload(true);

        setTimeout(() => {
          navigation.setParams({
            savedStrokes: undefined,
            voiceNotes: undefined,
            imageStickers: undefined,
          });
        }, 100);
      } else {
        if (documentInstanceId && documentInstanceId !== loadedDocumentInstanceIdRef.current) {
          console.log('New document instance ID detected, should reload');
          setShouldReload(true);
        }
      }

      const onBackPress = () => {
        navigation.navigate('FormType');
        return true;
      };

      const sub = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress
      );

      return () => {
        sub.remove();
        console.log('FormImageScreen blur');
      };
    }, [route.params, documentInstanceId, navigation, loadDocumentContext, loadDocumentIdFromStorage])
  );

  /* ---------- LOAD PAGES & IMAGES ---------- */
  const loadAllPages = useCallback(async () => {
    // Use documentId from props if available, otherwise use stored documentId
    const effectiveDocumentId = documentId || storedDocumentId;

    if (!effectiveDocumentId || !documentInstanceId || isLoadingRef.current) {
      console.log('Skipping load: effectiveDocumentId =', effectiveDocumentId, 'documentInstanceId =', documentInstanceId, 'isLoading =', isLoadingRef.current);
      return;
    }

    if (loadedDocumentInstanceIdRef.current === documentInstanceId && !shouldReload) {
      console.log('Already loaded this document instance, skipping reload');
      return;
    }

    console.log('Loading pages for document:', effectiveDocumentId, 'document instance:', documentInstanceId);

    isLoadingRef.current = true;

    try {
      setLoading(true);

      loadedDocumentInstanceIdRef.current = null;
      setHasValidImages(false);

      // First, get the page list using documentId
      const res = await getDocumentPages(effectiveDocumentId);
      console.log('Received', res.length, 'pages from API');

      if (res.length === 0) {
        console.warn('No pages returned from API for document:', effectiveDocumentId);
      }

      // Sort by display order and initialize with loading state
      const sortedPages = res
        .sort((a, b) => a.displayOrderNo - b.displayOrderNo)
        .map(p => ({
          pageId: p.pageId,
          displayOrderNo: p.displayOrderNo,
          loading: true,
          overlayLoading: false,
          overlayExists: undefined,
          hasImage: false,
        }));

      // Update pages with loading state
      setPages(sortedPages);

      // Initialize page metadata
      const initialMeta = sortedPages.map(p => ({
        pageId: p.pageId,
        bitmapPath: null,
      }));
      setPageMeta(initialMeta);

      // Now load images for each page using documentId
      console.log('Loading images for each page...');
      const pagesWithImages = await Promise.all(
        sortedPages.map(async (page, index) => {
          try {
            console.log(`Loading image ${index + 1}/${sortedPages.length} for page ${page.pageId}`);

            const response = await getDocumentPageImage(effectiveDocumentId, page.pageId);

            if (response && typeof response === 'string') {
              if (response.startsWith('data:image/') || response.length > 1000) {
                console.log(`✅ Page ${page.pageId} has valid image data`);
                return {
                  ...page,
                  imageData: response,
                  loading: false,
                  hasImage: true
                };
              } else {
                console.log(`⚠️ Page ${page.pageId} returned non-image response:`, response.substring(0, 100));
                return {
                  ...page,
                  imageData: undefined,
                  loading: false,
                  hasImage: false,
                  errorMessage: response
                };
              }
            } else {
              console.log(`❌ Page ${page.pageId} returned invalid response type:`, typeof response);
              return {
                ...page,
                imageData: undefined,
                loading: false,
                hasImage: false,
                errorMessage: 'Invalid response format'
              };
            }
          } catch (error) {
            console.error(`Failed to load image for page ${page.pageId}:`, error);
            return {
              ...page,
              loading: false,
              hasImage: false,
              errorMessage: error instanceof Error ? error.message : 'Network error'
            };
          }
        })
      );

      // Update with loaded images
      setPages(pagesWithImages);

      // Check if any page has a valid image
      const anyValidImage = pagesWithImages.some(page => page.hasImage);
      setHasValidImages(anyValidImage);

      console.log(`Image loading complete. Valid images found: ${anyValidImage}`);

      // Now load overlays for pages with valid images using documentInstanceId
      if (anyValidImage) {
        console.log('Starting overlay loading via page-wise API using document instance ID...');
        // Start overlay loading immediately

      }

      // Mark this document as loaded
      loadedDocumentInstanceIdRef.current = documentInstanceId;
      setShouldReload(false);

      console.log('All pages loaded successfully');

    } catch (error) {
      console.error('Failed to load document pages:', error);
      loadedDocumentInstanceIdRef.current = null;
      setHasValidImages(false);
      setShouldReload(true);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [documentId, documentInstanceId, storedDocumentId, shouldReload, loadAllOverlays]);

  // Load pages when documentId, storedDocumentId, or documentInstanceId changes
  useEffect(() => {
    console.log('useEffect triggered - documentId:', documentId, 'storedDocumentId:', storedDocumentId, 'documentInstanceId:', documentInstanceId, 'shouldReload:', shouldReload);

    // Use either documentId from props or storedDocumentId
    const effectiveDocumentId = documentId || storedDocumentId;

    if (effectiveDocumentId && documentInstanceId && shouldReload) {
      loadAllPages();
    }
  }, [documentId, storedDocumentId, documentInstanceId, shouldReload, loadAllPages]);

  useEffect(() => {
    if (
      documentInstanceId &&
      pages.length > 0 &&
      pages.some(p => p.hasImage) &&
      !overlayLoadedRef.current
    ) {
      overlayLoadedRef.current = true;
      console.log('[OVERLAY] Triggering overlay API call');
      loadAllOverlays();
    }
  }, [documentInstanceId, pages, loadAllOverlays]);

  // Add a manual refresh function
  const refreshPages = useCallback(() => {
    console.log('Manual refresh triggered');
    loadedDocumentInstanceIdRef.current = null;
    setShouldReload(true);
    setPages([]);
    setPageMeta([]);
    setHasValidImages(false);
    setLoadingOverlays(false);
  }, []);

  /* ---------- PAGE CARD ---------- */
  const PageCard = React.useCallback(({ page, index }: { page: PageItem; index: number }) => {
    const savedPath = pageMeta.find(p => p.pageId === page.pageId)?.bitmapPath;

    const overlaySrc = savedPath
      ? { uri: `${savedPath.startsWith('file://') ? savedPath : 'file://' + savedPath}?t=${reloadToken}` }
      : null;

    return (
      <View style={styles.pageCard}>
        <View style={[styles.imageBox, { width: SCREEN_W, height: PAGE_HEIGHT }]}>
          {page.imageData && page.hasImage ? (
            <View style={styles.imageContainer}>
              {/* Base Image */}
              <Image
                source={{ uri: page.imageData }}
                style={{ width: SCREEN_W, height: PAGE_HEIGHT }}
                resizeMode="contain"
              />

              {/* API Overlay Image (from page-wise API) */}
              {/* API Overlay Image (from page-wise API) */}
              {(() => {
                const overlayData = page.overlayData;
                if (!overlayData) return null;

                // overlayData should be "data:image/png;base64,..."
                // or just base64? The fetch logic constructed data: URI.
                // Let's strip "data:image/...;base64," if present
                const base64Index = overlayData.indexOf('base64,');
                const base64 = base64Index !== -1
                  ? overlayData.substring(base64Index + 7)
                  : overlayData;

                const strokesJson = tryParseStrokesJson(base64);

                if (strokesJson) {
                  return (
                    <View
                      style={[StyleSheet.absoluteFill, { zIndex: 15 }]}
                      pointerEvents="none"
                    >
                      <NativeDrawingView
                        strokesJson={strokesJson}
                        style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}
                      />
                    </View>
                  );
                } else {
                  // Legacy static image
                  return (
                    <Image
                      source={{ uri: overlayData }}
                      style={[StyleSheet.absoluteFill, styles.overlayImage]}
                      resizeMode="contain"
                    />
                  );
                }
              })()}

              {/* Local Editor Overlay */}
              {overlaySrc && (
                <Image
                  source={overlaySrc}
                  style={[StyleSheet.absoluteFill, styles.overlayImage]}
                  resizeMode="contain"
                />
              )}

              {/* Overlay Loading Indicator */}
              {page.overlayLoading && (
                <View style={styles.overlayLoadingContainer}>
                  <ActivityIndicator size="small" color="#0EA5A4" />
                  <Text style={[styles.overlayLoadingText, isDark && { color: colors.textSecondary }]}>Loading overlay...</Text>
                </View>
              )}

              {/* No Overlay Indicator */}
              {page.overlayExists === false && !page.overlayLoading && (
                <View style={[styles.noOverlayIndicator, isDark && { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                  {/* <Text style={styles.noOverlayText}>No overlay available</Text> */}
                </View>
              )}
            </View>
          ) : page.loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0EA5A4" />
              <Text style={[styles.loadingText, isDark && { color: colors.textSecondary }]}>Loading image...</Text>
            </View>
          ) : page.errorMessage ? (
            <View style={styles.messageContainer}>
              {/* <Ionicons name="warning-outline" size={48} color="#dc2626" /> */}
              <Text style={[styles.errorTitle, isDark && { color: colors.danger }]}>No Form Available.</Text>
              {/* <Text style={styles.errorMessageText}>{page.errorMessage}</Text> */}
            </View>
          ) : (
            <View style={styles.errorContainer}>
              <Ionicons name="image-off-outline" size={48} color={isDark ? colors.textMuted : "#9ca3af"} />
              <Text style={[styles.errorTitle, isDark && { color: colors.textPrimary }]}>No Form</Text>
              <Text style={[styles.errorMessageText, isDark && { color: colors.textSecondary }]}>Image data not available</Text>
            </View>
          )}

          {/* Render image stickers */}
          {page.hasImage && imageStickers
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
                    zIndex: 20,
                  }}
                />
              );
            })}

          {/* Render voice notes (text) */}
          {page.hasImage && voiceNotes
            .filter(n => n.pageId === page.pageId)
            .map(n => (
              <View
                key={n.id}
                style={{
                  position: 'absolute',
                  left: n.x,
                  top: n.y,
                  width: n.boxWidth ?? 180,
                  height: n.boxHeight ?? 60, // Match Editor's default height/saved height
                  zIndex: 25,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  justifyContent: 'center', // Match Editor's textTouchArea vertical center
                }}
                pointerEvents="none"
              >
                <Text
                  style={{
                    color: n.color,
                    fontSize: n.fontSize ?? 14,
                    fontWeight: '500', // Match Editor's voiceTextDrag weight
                    includeFontPadding: false,
                    textAlign: 'left',
                  }}
                >
                  {n.text}
                </Text>
              </View>
            ))}
        </View>

        <View style={[styles.footer, isDark && { backgroundColor: colors.surfaceHighlight, borderTopColor: colors.border }]}>
          <Text style={[styles.footerTxt, isDark && { color: colors.textPrimary }]}>
            Page {index + 1} of {pages.length}
          </Text>

        </View>
      </View>
    );
  }, [pageMeta, reloadToken, imageStickers, voiceNotes, pages.length]);

  /* ---------- RENDER ITEM ---------- */
  const renderItem = useCallback(({ item, index }: { item: PageItem; index: number }) => {
    return <PageCard page={item} index={index} />;
  }, [PageCard]);

  /* ---------- OPEN EDITOR ---------- */
  const openFullEditor = useCallback(() => {
    if (!documentInstanceId) {
      console.error('Cannot open editor: documentInstanceId is undefined');
      Alert.alert('Error', 'Document Instance ID is missing. Please try again.');
      return;
    }

    // Use either documentId from props or storedDocumentId
    const effectiveDocumentId = documentId || storedDocumentId;

    if (!effectiveDocumentId) {
      console.error('Cannot open editor: documentId is undefined');
      Alert.alert('Error', 'Document ID is missing. Please try again.');
      return;
    }

    if (!hasValidImages) {
      console.error('Cannot open editor: No valid images found');
      Alert.alert('Error', 'Cannot open editor because no valid images are available for this document.');
      return;
    }

    console.log('Opening editor with', pages.length, 'pages, documentId:', effectiveDocumentId, 'documentInstanceId:', documentInstanceId);

    const validPages = pages.filter(page => page.hasImage && page.imageData);

    const pagesWithOverlays = validPages.map(p => ({
      pageId: p.pageId,
      displayOrderNo: p.displayOrderNo,
      imageData: p.imageData,
      overlayData: p.overlayData,
    }));

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
      documentId: effectiveDocumentId,
      documentInstanceId, // Pass documentInstanceId to editor
      apiPages: pagesWithOverlays,
    });
  }, [navigation, perFormStorageKey, pageMeta, voiceNotes, imageStickers, formKey, formName, patientName, patientId, patientIP, documentId, storedDocumentId, documentInstanceId, pages, hasValidImages]);

  // Determine which document ID to display
  const displayDocumentId = documentId || storedDocumentId || 'Not available';

  /* ---------- UI ---------- */
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: isDark ? colors.surface : '#0EA5A4' }}>
        <View style={[
          styles.header,
          { height: 'auto', paddingVertical: 14 },
          isDark ? { backgroundColor: colors.surface } : {
            borderBottomLeftRadius: 18,
            borderBottomRightRadius: 18,
            elevation: 6,
          }
        ]}>
          <TouchableOpacity
            style={[styles.navButton, isDark && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#0EA5A4' }]}
            onPress={() => navigation.navigate('FormType')}
          >
            <Ionicons name="arrow-back" size={22} color={isDark ? '#0EA5A4' : '#fff'} />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.title} numberOfLines={1}>
              {formName}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.navButton,
              isDark && { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#0EA5A4' }
            ]}
            onPress={() => navigation.navigate('PatientScreen')}
          >
            <Ionicons name="home" size={22} color={isDark ? '#0EA5A4' : '#fff'} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {isCreatingDocument ? (
        <View style={[styles.fullLoading, isDark && { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color="#0EA5A4" />
          <Text style={[styles.loadingText, isDark && { color: colors.textPrimary }]}>Creating document instance...</Text>
          <Text style={[styles.documentIdText, isDark && { color: colors.textSecondary }]}>Please wait</Text>
        </View>
      ) : !hasDocumentContext ? (
        <View style={[styles.errorContainerFull, isDark && { backgroundColor: colors.background }]}>
          <Ionicons name="alert-circle-outline" size={64} color={isDark ? colors.danger : "#dc2626"} />
          <Text style={[styles.errorTitle, isDark && { color: colors.textPrimary }]}>Document Context Missing</Text>
          <Text style={[styles.errorMessage, isDark && { color: colors.textSecondary }]}>
            Unable to load document. Please go back and select a document again.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              loadDocumentContext();
              refreshPages();
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : loading && pages.length === 0 ? (
        <View style={[styles.fullLoading, isDark && { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color="#0EA5A4" />
          <Text style={[styles.loadingText, isDark && { color: colors.textPrimary }]}>Loading document pages...</Text>
          <Text style={[styles.documentIdText, isDark && { color: colors.textSecondary }]}>Document ID: {displayDocumentId}</Text>
          <Text style={[styles.documentIdText, isDark && { color: colors.textSecondary }]}>Document Instance ID: {documentInstanceId || 'Not available'}</Text>
        </View>
      ) : pages.length > 0 ? (
        <>
          <FlatList
            data={pages}
            horizontal
            pagingEnabled
            keyExtractor={(item) => item.pageId}
            renderItem={renderItem}
            showsHorizontalScrollIndicator={false}
            extraData={reloadToken}
            initialNumToRender={1}
            maxToRenderPerBatch={3}
            windowSize={3}
          />

          {/* Show loading indicator for overlays */}
          {loadingOverlays && (
            <View style={[styles.overlayGlobalLoading, isDark && { backgroundColor: colors.surfaceHighlight, borderTopColor: colors.border }]}>
              <ActivityIndicator size="small" color="#0EA5A4" />
              <Text style={[styles.overlayGlobalLoadingText, isDark && { color: colors.primary }]}>Loading overlays...</Text>
            </View>
          )}
        </>
      ) : (
        <View style={[styles.noPagesContainer, isDark && { backgroundColor: colors.background }]}>
          <Text style={[styles.noPagesText, isDark && { color: colors.textPrimary }]}>No pages found for this document</Text>
          <Text style={[styles.documentIdText, isDark && { color: colors.textSecondary }]}>Document ID: {displayDocumentId}</Text>
          <Text style={[styles.documentIdText, isDark && { color: colors.textSecondary }]}>Document Instance ID: {documentInstanceId || 'Not available'}</Text>
          <TouchableOpacity onPress={refreshPages} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* History FAB Button */}
      <TouchableOpacity
        style={[styles.historyFab, isDark && { backgroundColor: colors.surface, shadowColor: '#000' }]}
        onPress={() => {
          navigation.navigate('EditorHistory');
        }}
      >
        <Text style={[styles.historyText, isDark && { color: colors.textPrimary }]}>History</Text>
        <AntDesign name="folderopen" size={28} color="#0EA5A4" />
      </TouchableOpacity>

      {/* Open Full Editor Button */}
      {pages.length > 0 && documentInstanceId && displayDocumentId && hasValidImages && (
        <SafeAreaView edges={['bottom']} style={[styles.bottomSafe, isDark && { backgroundColor: colors.background }]}>
          <TouchableOpacity style={styles.btn} onPress={openFullEditor}>
            <Ionicons name="create-outline" size={22} color="#fff" />
            <Text style={styles.btnTxt}>Open Full Editor</Text>
          </TouchableOpacity>
        </SafeAreaView>
      )}

      {/* Disabled Editor Button */}
      {pages.length > 0 && documentInstanceId && (!displayDocumentId || !hasValidImages) && (
        <SafeAreaView edges={['bottom']} style={[styles.bottomSafe, isDark && { backgroundColor: colors.background }]}>
          <View style={[styles.btn, styles.btnDisabled, isDark && { backgroundColor: colors.surfaceHighlight }]}>
            <Ionicons name="create-outline" size={22} color={isDark ? colors.textMuted : "#94a3b8"} />
            <Text style={[styles.btnTxt, styles.btnTxtDisabled, isDark && { color: colors.textMuted }]}>Open Full Editor</Text>
          </View>
        </SafeAreaView>
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  pageCard: { flex: 1 },
  imageBox: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  imageContainer: {
    width: SCREEN_W,
    height: PAGE_HEIGHT,
    position: 'relative',
  },
  overlayImage: {
    width: SCREEN_W,
    height: PAGE_HEIGHT,
  },
  footer: {
    padding: 12,
    backgroundColor: '#f1f5f9',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'center',
  },
  footerTxt: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  overlayIndicator: {
    fontSize: 12,
    color: '#0EA5A4',
    fontWeight: '500',
  },
  noOverlayFooter: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  fullLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayLoadingContainer: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 8,
    borderRadius: 4,
    zIndex: 10,
  },
  noOverlayIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 10,
  },
  noOverlayText: {
    fontSize: 11,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  overlayLoadingText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  overlayGlobalLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#f0f9ff',
    borderTopWidth: 1,
    borderTopColor: '#e0f2fe',
  },
  overlayGlobalLoadingText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#0EA5A4',
  },
  documentIdText: {
    marginTop: 5,
    color: '#999',
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContainerFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#dc2626',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  errorMessageText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  noPagesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noPagesText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    marginBottom: 10,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#0EA5A4',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
    padding: 14,
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
  btnDisabled: {
    backgroundColor: '#e5e7eb',
  },
  btnTxt: {
    color: '#fff',
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '700'
  },
  btnTxtDisabled: {
    color: '#94a3b8',
  },
  navButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginRight: 0,
  },
});