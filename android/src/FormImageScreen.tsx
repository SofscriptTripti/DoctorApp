// src/FormImageScreen.tsx
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
  getDocuments,
} from './api/documentsApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getpagewiseoverlay,
  createPatientDocument,
  NewVersion,
  getPatientDocumentPageImage
} from './api/patientDocumentsApi';
import { Buffer } from 'buffer';
import NativeDrawingView from './components/NativeDrawingView';

/* ---------------- STICKERS ---------------- */
const NAME_STICKER_IMAGE = require('./Images/NameStick.jpg');
const DOCTOR_STICKER_SOURCE = require('./Images/Doctor_Sticker.jpg');

/* ---------------- CONSTS ---------------- */
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const DISPLAY_PAGE_HEIGHT = Math.round(SCREEN_H * 0.83);

// NEW: Fixed Logical Coordinate Space
const FORM_WIDTH = 800;
const FORM_HEIGHT = 1131;
const formScale = Math.min(SCREEN_W / FORM_WIDTH, DISPLAY_PAGE_HEIGHT / FORM_HEIGHT);
const PAGE_HEIGHT = FORM_HEIGHT; // Alias for backward compatibility in logic

// AsyncStorage keys
const STORAGE_KEYS = {
  patientId: 'patientId',
  admissionNo: 'admissionNo',
  documentId: 'documentId',
  documentInstanceId: 'documentInstanceId',
  documentCd: 'documentCd'
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

  const trimmedInput = base64.trim();
  // 🟢 NEW: If input already looks like JSON (starts with [ or {), return as-is
  if (trimmedInput.startsWith('[') || trimmedInput.startsWith('{')) {
    return trimmedInput;
  }

  try {
    // Attempt decoding
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    const trimmed = decoded.trim();
    // Heuristic: starts with '[' (array of strokes) or '{' (v2 bundle object)
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      return trimmed;
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
  const patientName = params.patientName ?? 'Unknown';
  const patientId = params.patientId || params.patientNo;
  const patientIP = params.patientIP;

  // ✅ FIX: Use a memoized storage key that is unique per instance
  const perFormStorageKey = useMemo(() => {
    // 🟢 CRITICAL: Always use the instance-specific key if we have an ID.
    // This prevents different versions from sharing the same local storage slot.
    if (documentInstanceId) {
      const safePatient = (patientName || 'Unknown').replace(/\s+/g, '_');
      const safeForm = (formName || 'Document').replace(/\s+/g, '_');
      const suffix = (params.admissionNo || patientId) ? `:${params.admissionNo || patientId}` : '';
      const instSuffix = `:${documentInstanceId}`;
      return `DoctorApp:${safePatient}:${safeForm}${suffix}${instSuffix}:pagesBitmaps:v1`;
    }

    // Fallback for cases without an instance context (e.g., initial entry)
    if (params.storageKey && params.storageKey !== 'DoctorApp:pagesBitmaps:v1') {
      return params.storageKey;
    }

    return null;
  }, [params.storageKey, documentInstanceId, patientName, formName, params.admissionNo, patientId]);

  const [pages, setPages] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageMeta, setPageMeta] = useState<PageMeta[]>([]);
  const [voiceNotes, setVoiceNotes] = useState<any[]>(
    Array.isArray(params.voiceNotes) ? params.voiceNotes : []
  );
  const [imageStickers, setImageStickers] = useState<any[]>(
    Array.isArray(params.imageStickers) ? params.imageStickers : []
  );

  // ✅ Fix: Sync state with params when they change (prevent stale data on reuse)
  useEffect(() => {
    if (Array.isArray(params.voiceNotes)) setVoiceNotes(params.voiceNotes);
    if (Array.isArray(params.imageStickers)) setImageStickers(params.imageStickers);
  }, [params.voiceNotes, params.imageStickers, params.admissionNo, params.documentId]);
  const [reloadToken, setReloadToken] = useState(0);
  const [shouldReload, setShouldReload] = useState(true);
  const [hasDocumentContext, setHasDocumentContext] = useState(false);
  const [hasValidImages, setHasValidImages] = useState(false);
  const [editedPages, setEditedPages] = useState<number>(params.editedPages || 0);
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

      // ✅ FIX: Prefer params directly — they are always passed from FormType.
      // AsyncStorage fallback is used only if params are missing.
      const [[, storedPatientNo], [, storedAdmissionNo]] =
        await AsyncStorage.multiGet([
          STORAGE_KEYS.patientId,
          STORAGE_KEYS.admissionNo,
        ]);

      const patientNo = params.patientId || storedPatientNo;
      const admissionNo = params.admissionNo || storedAdmissionNo;
      // documentCd = the document template ID, always in params.documentId
      const documentCd = params.documentId || params.formKey;

      console.log('Creating document instance with:', {
        patientNo,
        admissionNo,
        documentCd
      });

      // Validate required data
      if (!patientNo || !admissionNo || !documentCd) {
        console.error('Missing required data for creating document instance:', { patientNo, admissionNo, documentCd });
        Alert.alert('Error', 'Missing patient or document info. Please go back and reopen the form.');
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
        // Also persist documentCd so history/new-version flows can use it
        await AsyncStorage.setItem(STORAGE_KEYS.documentCd, documentCd);

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
  }, [navigation, getInstanceStorageKey, params.patientId, params.admissionNo, params.documentId, params.formKey]);

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
      let currentDocId = params.documentId || storedDocumentId;

      if (!currentDocId) {
        console.log('No documentId found, attempting to fetch from getDocuments()...');
        try {
          const docs = await getDocuments();
          if (Array.isArray(docs) && docs.length > 0) {
            const matchedDoc = docs.find((d: any) => d.title === formName) || docs[0];
            currentDocId = matchedDoc.documentId;
            console.log('Fetched fallback documentId:', currentDocId);
            setDocumentId(currentDocId);
            setStoredDocumentId(currentDocId);
            await AsyncStorage.setItem(STORAGE_KEYS.documentId, currentDocId);
          }
        } catch (apiErr) {
          console.error('Failed to fetch fallback documents:', apiErr);
        }
      }

      // First check if we have documentInstanceId in params (returning user / history open)
      if (params.documentInstanceId) {
        console.log('Using documentInstanceId from params:', params.documentInstanceId);
        setDocumentInstanceId(params.documentInstanceId);
        setDocumentId(currentDocId || params.documentId);
        setHasDocumentContext(true);
        return;
      }

      console.log('documentInstanceId not in params, checking AsyncStorage...');

      // Try to get existing document instance saved from a previous session
      const context = await getDocumentContextFromStorage();

      if (context?.documentInstanceId) {
        console.log('Found existing document context in AsyncStorage:', context);
        setDocumentInstanceId(context.documentInstanceId);
        setDocumentId(context.documentId || currentDocId);
        setHasDocumentContext(true);
      } else {
        // ✅ NEW DESIGN: No instance exists yet — show base form images (read-only preview).
        // Do NOT auto-create an instance. The user must explicitly tap "New" to create one.
        console.log('No existing document instance. Showing base form images. User can tap New to create an instance.');
        setDocumentId(currentDocId);
        setHasDocumentContext(true); // ✅ Allow image loading — documentInstanceId stays undefined
      }
    } catch (error) {
      console.error('Error loading document context:', error);
      // Even on error, allow base images to show
      setHasDocumentContext(true);
    }
  }, [params.documentInstanceId, params.documentId, storedDocumentId, formName, getDocumentContextFromStorage]);


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
      const allFetchedNotes: any[] = [];
      const allFetchedStickers: any[] = [];

      if (Array.isArray(pageWiseOverlayData)) {
        console.log(`[OVERLAY] Found ${pageWiseOverlayData.length} entries in API response`);
        pageWiseOverlayData.forEach((item: any) => {
          if (item.pageId && item.overlayDataBase64 && item.hasOverlay) {
            const raw = item.overlayDataBase64;
            const strokesJson = tryParseStrokesJson(raw);

            if (strokesJson) {
              try {
                const parsed = JSON.parse(strokesJson);
                if (parsed.version === 'v2') {
                  console.log(`[OVERLAY] Page ${item.pageId} has v2 bundle`);
                  overlayMap.set(item.pageId, {
                    base64: parsed.strokes, // Only the strokes part for rendering
                    contentType: item.contentType || 'image/png',
                    hasOverlay: !!parsed.strokes
                  });
                  if (Array.isArray(parsed.voiceNotes)) allFetchedNotes.push(...parsed.voiceNotes);
                  if (Array.isArray(parsed.imageStickers)) allFetchedStickers.push(...parsed.imageStickers);
                } else {
                  // Legacy JSON strokes
                  overlayMap.set(item.pageId, {
                    base64: raw,
                    contentType: item.contentType || 'image/png',
                    hasOverlay: true
                  });
                }
              } catch (e) {
                overlayMap.set(item.pageId, {
                  base64: raw,
                  contentType: item.contentType || 'image/png',
                  hasOverlay: true
                });
              }
            } else {
              // Binary PNG or un-parseable
              overlayMap.set(item.pageId, {
                base64: raw,
                contentType: item.contentType || 'image/png',
                hasOverlay: true
              });
            }
          }
        });
      }

      // Update global states for Notes/Stickers from API (Merge by pageId)
      console.log(`[OVERLAY] Merging API data: ${allFetchedNotes.length} notes, ${allFetchedStickers.length} stickers`);

      // 🟢 FIX: Always update Notes/Stickers states, clearing them if API returns nothing
      const fetchedPageIds = new Set([...allFetchedNotes, ...allFetchedStickers].map(x => x.pageId).filter(id => !!id));

      setVoiceNotes(prev => {
        // If we have new data, replace overlays for those pages; otherwise preserve if they weren't fetched?
        // Actually, for a clean sync, we should only keep local changes if we haven't saved them.
        // But for "New" form, we want a total wipe.
        const otherNotes = prev.filter(n => !fetchedPageIds.has(n.pageId));
        return [...otherNotes, ...allFetchedNotes];
      });

      setImageStickers(prev => {
        const otherStickers = prev.filter(s => !fetchedPageIds.has(s.pageId));
        return [...otherStickers, ...allFetchedStickers];
      });

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

      if (Array.isArray(p.savedStrokes) || Array.isArray(p.voiceNotes) || Array.isArray(p.imageStickers)) {
        console.log('Received updated data from editor');
        if (p.savedStrokes) setPageMeta(p.savedStrokes);
        if (p.voiceNotes) setVoiceNotes(p.voiceNotes);
        if (p.imageStickers) setImageStickers(p.imageStickers);

        overlayLoadedRef.current = false; // ✅ FORCE RELOAD from API to be sure
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
        navigation.navigate('FormType', { ...params });
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

  const loadAllPages = useCallback(async () => {
    // Use documentId from props if available, otherwise use stored documentId
    const effectiveDocumentId = documentId || storedDocumentId;

    if (!effectiveDocumentId || isLoadingRef.current) {
      console.log('Skipping load: effectiveDocumentId =', effectiveDocumentId, 'isLoading =', isLoadingRef.current);
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

            const response = documentInstanceId
              ? await getPatientDocumentPageImage(documentInstanceId, page.pageId)
              : await getDocumentPageImage(effectiveDocumentId, page.pageId);

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
      loadedDocumentInstanceIdRef.current = documentInstanceId || null;
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

    if (effectiveDocumentId && shouldReload) {
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

  /* ---------- NEW: HANDLER FOR CREATE NEW INSTANCE ---------- */
  const handleCreateNewPress = useCallback(() => {
    Alert.alert(
      "Create New Form",
      "Do you want to start a fresh copy of this form?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Create New",
          style: 'default',
          onPress: async () => {
            // ✅ Use params directly — always available from FormType navigation
            const [[, storedPatientNo], [, storedAdmissionNo], [, storedDocumentCd]] =
              await AsyncStorage.multiGet([
                STORAGE_KEYS.patientId,
                STORAGE_KEYS.admissionNo,
                STORAGE_KEYS.documentCd,
              ]);

            const patientNo = params.patientId || storedPatientNo;
            const admissionNo = params.admissionNo || storedAdmissionNo;
            const documentCd = params.documentId || params.formKey;

            if (!patientNo || !admissionNo || !documentCd) {
              Alert.alert('Error', `Missing required info to create form.\npatientId: ${patientNo || 'missing'}\nadmissionNo: ${admissionNo || 'missing'}\ndocumentCd: ${documentCd || 'missing'}`);
              return;
            }
            try {
              let response: any;

              if (documentInstanceId) {
                // ✅ Existing user: create a NEW VERSION of the existing form
                response = await NewVersion(patientNo, admissionNo, documentCd);
                console.log('✅ NewVersion API Response:', response);
              } else {
                // ✅ New user: open/create the FIRST instance of this form
                response = await createPatientDocument(patientNo, admissionNo, documentCd);
                console.log('✅ createPatientDocument API Response:', response);
              }

              if (response?.documentInstanceId) {
                const uniqueKey = getInstanceStorageKey();
                await AsyncStorage.setItem(uniqueKey, response.documentInstanceId);
                // Also save documentCd for future history/new-version calls
                await AsyncStorage.setItem('documentCd', documentCd);

                // 🟢 CLEAR OVERLAYS FOR NEW FORM
                setVoiceNotes([]);
                setImageStickers([]);
                setPageMeta([]);
                setEditedPages(0);
                overlayLoadedRef.current = false;

                // ✅ Wipe navigation params to prevent hooks from sticking to old keys/data
                navigation.setParams({
                  storageKey: undefined,
                  documentInstanceId: undefined,
                  savedStrokes: undefined,
                  voiceNotes: undefined,
                  imageStickers: undefined
                });

                setDocumentInstanceId(response.documentInstanceId);
                setShouldReload(true);
              } else {
                Alert.alert('Error', 'Server did not return a document instance ID.');
              }
            } catch (error) {
              console.error('Failed to create new form:', error);
              Alert.alert('Error', 'Failed to create form. Please try again.');
            }
          }
        }
      ]
    );
  }, [documentInstanceId, getInstanceStorageKey, params.patientId, params.admissionNo, params.documentId, params.formKey]);


  /* ---------- HANDLER FOR HISTORY ---------- */
  const handleHistoryPress = useCallback(async () => {
    const [[, storedPatientNo], [, storedAdmissionNo], [, storedDocumentCd]] =
      await AsyncStorage.multiGet([
        STORAGE_KEYS.patientId,
        STORAGE_KEYS.admissionNo,
        STORAGE_KEYS.documentCd,
      ]);

    const patientNo = params.patientId || storedPatientNo;
    const admissionNo = params.admissionNo || storedAdmissionNo;
    const documentCd = params.documentId || params.formKey || storedDocumentCd;

    if (!patientNo || !admissionNo || !documentCd) {
      Alert.alert('Error', 'Missing required patient info for history.');
      return;
    }

    navigation.navigate('EditorHistory', {
      ...params,
      patientNo,
      patientId,
      admissionNo,
      documentCd,
      formName,
      patientName,
      patientIP,
      documentInstanceId,
      patientAge: params.patientAge,
      patientGender: params.patientGender,
      patientRoom: params.patientRoom,
      attendingDoctor: params.attendingDoctor,
      admitDate: params.admitDate,
    });
  }, [navigation, formName, documentInstanceId]);

  /* ---------- PAGE CARD ---------- */
  const PageCard = React.useCallback(({ page, index }: { page: PageItem; index: number }) => {
    const savedPath = pageMeta.find(p => p.pageId === page.pageId)?.bitmapPath;

    const overlaySrc = savedPath
      ? { uri: `${savedPath.startsWith('file://') ? savedPath : 'file://' + savedPath}?t=${reloadToken}` }
      : null;

    return (
      <View style={[styles.pageCard, { width: SCREEN_W, height: DISPLAY_PAGE_HEIGHT, alignItems: 'center', justifyContent: 'center' }]}>
        <View style={[styles.imageBox, { width: FORM_WIDTH, height: FORM_HEIGHT, transform: [{ scale: formScale }] }]}>
          {page.imageData && page.hasImage ? (
            <View style={styles.imageContainer}>
              {/* Base Image */}
              <Image
                source={{ uri: page.imageData }}
                style={{ width: FORM_WIDTH, height: FORM_HEIGHT }}
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

          {/* Render image stickers - Fix: Check index correlation */}
          {/* ✅ FIX: Hide stickers on FormImageScreen if form is new (editedPages == 0) and we haven't locally edited yet. 
              The user wants to see them ONLY in the editor initially to keep the view clean. 
              We assume if reloadToken > 0, it means we returned from Editor with changes.
          */}
          {/* Render Stickers with DYNAMIC FONT SCALING */}
          {imageStickers.map((s, i) => {
            if (s.pageId !== page.pageId && s.pageIndex !== index) return null;

            // Calculate scale based on current width vs initial width
            const isPatient = s.stickerType === 'patient';
            
            // For FormImageScreen we don't apply an extra manual scale, the entire wrapper handles it.
            // But we do need to extract their intended scale from editor sizing
            const initialWidth = isPatient ? 220 : 180;
            const currentWidth = s.width || initialWidth;
            const scale = currentWidth / initialWidth;

            // Helper to scale font size
            const sf = (size: number) => Math.max(4, size * scale);

            return (
              <View
                key={s.id}
                style={{
                  position: 'absolute',
                  left: s.x,
                  top: s.y,
                  width: s.width || initialWidth,
                  height: s.height || (isPatient ? 120 : 90),
                  backgroundColor: '#fff',
                  borderRadius: 4 * scale,
                  borderWidth: 1.5 * scale,
                  borderColor: '#000',
                  padding: 6 * scale,
                  zIndex: 20,
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}
                pointerEvents="none"
              >
                {isPatient ? (
                  <View style={{ flex: 1, justifyContent: 'space-evenly' }}>
                    <Text style={{ fontSize: sf(9), fontWeight: '700', color: '#000' }} numberOfLines={1}>
                      {s.textData?.line1 || ''}
                    </Text>
                    <Text style={{ fontSize: sf(11), fontWeight: '800', color: '#000' }} numberOfLines={1}>
                      {s.textData?.line2 || ''}
                    </Text>
                    <Text style={{ fontSize: sf(9), fontWeight: '500', color: '#000' }} numberOfLines={1}>
                      {s.textData?.line3 || ''}
                    </Text>
                    <Text style={{ fontSize: sf(9), fontWeight: '700', color: '#000' }} numberOfLines={1}>
                      {s.textData?.line4 || ''}
                    </Text>
                    <Text style={{ fontSize: sf(9), fontWeight: '500', color: '#000' }} numberOfLines={1}>
                      {s.textData?.line5 || ''}
                    </Text>
                  </View>
                ) : (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: sf(13), fontWeight: '700', color: '#000', textAlign: 'center' }}>
                      {s.textData?.line1 || ''}
                    </Text>
                    <Text style={{ fontSize: sf(12), fontWeight: '600', color: '#000', textAlign: 'center', marginTop: 2 * scale }}>
                      {s.textData?.line2 || ''}
                    </Text>
                    <Text style={{ fontSize: sf(11), fontWeight: '600', color: '#555', textAlign: 'center', marginTop: 2 * scale, textTransform: 'uppercase' }}>
                      {s.textData?.line3 || ''}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}

          {/* Render voice notes (text) - Fix: Check index correlation */}
          {voiceNotes
            .filter(n => {
              const match = n.pageId === page.pageId || n.pageIndex === index;
              if (match) {
                // console.log(`[RENDER] Rendering Note ${n.id} for Page ${page.pageId} (Index ${index})`);
              }
              return match;
            })
            .map(n => (
              <View
                key={n.id}
                style={{
                  position: 'absolute',
                  left: n.x,
                  top: n.y,
                  width: n.boxWidth ?? 180,
                  height: n.boxHeight ?? 60,
                  zIndex: 25,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  justifyContent: 'center',
                }}
                pointerEvents="none"
              >
                <View style={{ width: '100%', height: '100%', justifyContent: 'center', flex: 1 }}>
                  <Text
                    style={{
                      color: n.color,
                      fontSize: n.fontSize ?? 14,
                      fontWeight: '500',
                      includeFontPadding: false,
                      textAlign: n.textAlign || 'left',
                      flexWrap: 'wrap',
                      width: '100%',
                    }}
                    allowFontScaling={false}
                  >
                    {n.text}
                  </Text>
                </View>
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
  const openFullEditor = useCallback(async () => {
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
      // ✅ Pass new details
      patientAge: params.patientAge,
      patientGender: params.patientGender,
      patientRoom: params.patientRoom, // ✅ Added
      attendingDoctor: params.attendingDoctor, // ✅ Added
      admitDate: params.admitDate, // ✅ Added
      doctorName: await AsyncStorage.getItem('fullName') || 'Unavailable',
      doctorRegNo: params.loginUserId || await AsyncStorage.getItem('userId') || 'Unavailable',
      doctorSpeciality: await AsyncStorage.getItem('department') || 'Unavailable', // ✅ Updated fallback

      documentId: effectiveDocumentId,
      documentInstanceId, // Pass documentInstanceId to editor
      apiPages: pagesWithOverlays,
      editedPages, // ✅ Pass state instead of params
    });
  }, [navigation, perFormStorageKey, pageMeta, voiceNotes, imageStickers, formKey, formName, patientName, patientId, patientIP, documentId, storedDocumentId, documentInstanceId, pages, hasValidImages, params.editedPages]);

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
            onPress={() => navigation.navigate('FormType', { ...params })}
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

      {/* Create New FAB Button (Above History) */}
      <TouchableOpacity
        style={[styles.createFab, isDark && { backgroundColor: colors.surface, shadowColor: '#000' }]}
        onPress={handleCreateNewPress}
        activeOpacity={0.8}
      >
        <Text style={[styles.historyText, isDark && { color: colors.textPrimary }, { color: '#fff' }]}>New</Text>
        <Ionicons name="add-circle-outline" size={28} color="#fff" />
      </TouchableOpacity>

      {/* History FAB Button */}
      <TouchableOpacity
        style={[styles.historyFab, isDark && { backgroundColor: colors.surface, shadowColor: '#000' }]}
        onPress={handleHistoryPress}
        activeOpacity={0.8}
      >
        <Text style={[styles.historyText, isDark && { color: colors.textPrimary }, { color: '#fff' }]}>History</Text>
        <Ionicons name="time-outline" size={28} color="#fff" />
      </TouchableOpacity>


      {/* Open Full Editor Button - show when images loaded, with or without instance */}
      {pages.length > 0 && displayDocumentId && hasValidImages && (
        <SafeAreaView edges={['bottom']} style={[styles.bottomSafe, isDark && { backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[styles.btn, !documentInstanceId && { backgroundColor: '#64748b' }]}
            onPress={() => {
              if (!documentInstanceId) {
                // Prompt user to create an instance first
                Alert.alert(
                  'Create Form First',
                  'Please tap the "New" button to create a form instance before editing.',
                  [{ text: 'OK' }]
                );
              } else {
                openFullEditor();
              }
            }}
          >
            <Ionicons name="create-outline" size={22} color="#fff" />
            <Text style={styles.btnTxt}>
              {documentInstanceId ? 'Open Full Editor' : 'Tap “New” to Start Editing'}
            </Text>
          </TouchableOpacity>
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
    width: FORM_WIDTH,
    height: FORM_HEIGHT,
    position: 'relative',
  },
  overlayImage: {
    width: FORM_WIDTH,
    height: FORM_HEIGHT,
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
  createFab: {
    position: 'absolute',
    right: 16,
    bottom: 195, // Above history
    width: 64, // Fixed width to match
    height: 64, // Fixed height for square-ish/icon look or let padding handle it? User said same height/width.
    // Actually existing styles use paddingVertical 8. content is Icon(28) + text.
    // Let's use standard dimensions.
    backgroundColor: '#0EA5A4',
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 10,
  },
  historyFab: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    width: 64, // Fixed width
    backgroundColor: '#0EA5A4',
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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