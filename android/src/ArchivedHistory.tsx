// android/src/ArchivedHistory.tsx
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Image,
    Dimensions,
    Animated,
    Modal,
    Platform,
    ScrollView,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import moment from 'moment';
import { useTheme } from './theme/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getPatientDocumentVersions, getpagewiseoverlay } from './api/patientDocumentsApi';
import { getDocumentPages, getDocumentPageImage } from './api/documentsApi';
import NativeDrawingView from './components/NativeDrawingView';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PAGE_HEIGHT = Math.round(SCREEN_H * 0.83);
const CARD_WIDTH = 140;
const CARD_HEIGHT = 180;
const SCALE_X = CARD_WIDTH / SCREEN_W;
const SCALE_Y = CARD_HEIGHT / PAGE_HEIGHT;

interface ApiVersionItem {
    documentInstanceId: string;
    versionNo: number;
    createdDt: string;
    createdBy: string;
}

interface GroupedHistory {
    dateLabel: string;
    dateObj: Date;
    items: ApiVersionItem[];
}

const tryParseStrokesJson = (base64?: string): string | null => {
    if (!base64) return null;

    const trimmedInput = base64.trim();
    if (trimmedInput.startsWith('[') || trimmedInput.startsWith('{')) {
        return trimmedInput;
    }

    try {
        const decoded = Buffer.from(base64, 'base64').toString('utf8');
        const trimmed = decoded.trim();
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            return trimmed;
        }
    } catch (e) {
        // ignore
    }
    return null;
};

/* ---------- INTERNAL COMPONENTS ---------- */

const VersionCover = React.memo(({
    version,
    firstPageId,
    coverImage,
    isDark,
    colors,
    hasMultiplePages,
}: {
    version: ApiVersionItem;
    firstPageId: string | null;
    coverImage: string | null;
    isDark: boolean;
    colors: any;
    hasMultiplePages: boolean;
}) => {
    const [overlayUri, setOverlayUri] = useState<string | null>(null);
    const [overlayStrokes, setOverlayStrokes] = useState<string | null>(null);
    const [vVoiceNotes, setVVoiceNotes] = useState<any[]>([]);
    const [vImageStickers, setVImageStickers] = useState<any[]>([]);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        if (!firstPageId || !coverImage) return;

        const fetchData = async () => {
            try {
                const overlays = await getpagewiseoverlay(version.documentInstanceId);

                if (Array.isArray(overlays)) {
                    const pageOverlay = overlays.find((o: any) => o.pageId === firstPageId);
                    if (pageOverlay && pageOverlay.overlayDataBase64) {
                        const raw = pageOverlay.overlayDataBase64;
                        const strokesJson = tryParseStrokesJson(raw);

                        if (strokesJson) {
                            try {
                                const parsed = JSON.parse(strokesJson);
                                if (parsed.version === 'v2') {
                                    if (parsed.strokes) {
                                        const strokes = parsed.strokes;
                                        const strokesJson = tryParseStrokesJson(strokes);
                                        if (strokesJson) {
                                            setOverlayStrokes(strokesJson);
                                        } else {
                                            setOverlayUri(strokes.startsWith('data:image') ? strokes : `data:image/png;base64,${strokes}`);
                                        }
                                    }
                                    if (Array.isArray(parsed.voiceNotes)) {
                                        setVVoiceNotes(parsed.voiceNotes.filter((n: any) => n.pageId === firstPageId));
                                    }
                                    if (Array.isArray(parsed.imageStickers)) {
                                        setVImageStickers(parsed.imageStickers.filter((s: any) => s.pageId === firstPageId));
                                    }
                                } else {
                                    setOverlayStrokes(strokesJson);
                                }
                            } catch (e) {
                                setOverlayStrokes(strokesJson);
                            }
                        } else if (raw.trim().length > 0) {
                            setOverlayUri(`data:image/png;base64,${raw}`);
                        }
                    }
                }
            } catch (e) {
                console.warn('Failed to fetch history overlays:', e);
            } finally {
                setIsReady(true);
            }
        };

        fetchData();
    }, [version.documentInstanceId, firstPageId, coverImage]);

    return (
        <View style={[styles.coverPlaceholder, isDark && { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {isReady && coverImage ? (
                <View style={{ width: CARD_WIDTH, height: CARD_HEIGHT, overflow: 'hidden' }}>
                    <View
                        style={[
                            StyleSheet.absoluteFill,
                            {
                                width: SCREEN_W,
                                height: PAGE_HEIGHT,
                                transform: [
                                    { scaleX: SCALE_X },
                                    { scaleY: SCALE_Y }
                                ],
                                transformOrigin: 'top left'
                            }
                        ]}
                        pointerEvents="none"
                    >
                        <Image
                            source={{ uri: coverImage }}
                            style={{ width: SCREEN_W, height: PAGE_HEIGHT }}
                            resizeMode="contain"
                        />

                        {overlayUri && (
                            <View style={[StyleSheet.absoluteFill, { zIndex: 5 }]} pointerEvents="none">
                                <Image
                                    source={{ uri: overlayUri }}
                                    style={{ width: SCREEN_W, height: PAGE_HEIGHT }}
                                    resizeMode="contain"
                                />
                            </View>
                        )}

                        {overlayStrokes && (
                            <View style={[StyleSheet.absoluteFill, { zIndex: 6 }]} pointerEvents="none">
                                <NativeDrawingView
                                    style={{ width: SCREEN_W, height: PAGE_HEIGHT, backgroundColor: 'transparent' }}
                                    strokesJson={overlayStrokes}
                                />
                            </View>
                        )}

                        {vImageStickers.map((s) => (
                            <View
                                key={s.id}
                                style={{
                                    position: 'absolute',
                                    left: s.x,
                                    top: s.y,
                                    width: (s.width || 240),
                                    height: (s.height || 140),
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    transform: [{ scale: s.scale || 1 }],
                                }}
                            >
                                {s.stickerType === 'patient' ? (
                                    <View style={{ width: '100%', height: '100%', backgroundColor: '#fff', borderRadius: 4, borderWidth: 1.5, borderColor: '#000', padding: 8, justifyContent: 'space-evenly' }}>
                                        <Text style={{ fontSize: 9, fontWeight: '700', color: '#000' }} numberOfLines={1}>{s.textData?.line1 || ''}</Text>
                                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#000' }} numberOfLines={1}>{s.textData?.line2 || ''}</Text>
                                        <Text style={{ fontSize: 9, fontWeight: '500', color: '#000' }} numberOfLines={1}>{s.textData?.line3 || ''}</Text>
                                        <Text style={{ fontSize: 9, fontWeight: '700', color: '#000' }} numberOfLines={1}>{s.textData?.line4 || ''}</Text>
                                        <Text style={{ fontSize: 9, fontWeight: '500', color: '#000' }} numberOfLines={1}>{s.textData?.line5 || ''}</Text>
                                    </View>
                                ) : (
                                    <View style={{ width: '100%', height: '100%', backgroundColor: '#fff', borderRadius: 4, borderWidth: 1.5, borderColor: '#000', padding: 8, justifyContent: 'center', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#000', textAlign: 'center' }}>{s.textData?.line1 || ''}</Text>
                                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#000', textAlign: 'center', marginTop: 2 }}>{s.textData?.line2 || ''}</Text>
                                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#555', textAlign: 'center', marginTop: 2, textTransform: 'uppercase' }}>{s.textData?.line3 || ''}</Text>
                                    </View>
                                )}
                            </View>
                        ))}

                        {vVoiceNotes.map((n) => (
                            <View
                                key={n.id}
                                style={{
                                    position: 'absolute',
                                    left: n.x,
                                    top: n.y,
                                    width: n.boxWidth ?? 180,
                                    height: n.boxHeight ?? 60,
                                    paddingHorizontal: 12,
                                    paddingVertical: 12,
                                    justifyContent: 'center',
                                }}
                            >
                                <Text
                                    style={{
                                        color: n.color,
                                        fontSize: n.fontSize ?? 14,
                                        fontWeight: '500',
                                        textAlign: n.textAlign || 'left',
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    {n.text}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {hasMultiplePages && (
                        <View style={styles.multiPageIcon}>
                            <Ionicons name="documents" size={14} color="#fff" />
                        </View>
                    )}
                </View>
            ) : null}
        </View>
    );
});

/* ================= SCREEN ================= */

export default function ArchivedHistory() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { isDark, colors } = useTheme();

    const { patientNo, admissionNo, documentCd, patientId: pId } = route.params || {};
    const patientId = pId || patientNo;

    const [history, setHistory] = useState<ApiVersionItem[]>([]);
    const [loading, setLoading] = useState(true);

    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [firstPageId, setFirstPageId] = useState<string | null>(null);
    const [hasMultiplePages, setHasMultiplePages] = useState(false);

    const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
    const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState<ApiVersionItem | null>(null);
    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const toastOpacity = useRef(new Animated.Value(0)).current;

    const ARCHIVED_KEY = `DoctorApp:archivedVersions:${admissionNo || patientId}`;
    const DELETED_KEY = `DoctorApp:deletedVersions:${admissionNo || patientId}`;

    const loadCoverImage = useCallback(async (docCd: string) => {
        try {
            const pages = await getDocumentPages(docCd);
            if (pages && pages.length > 0) {
                setHasMultiplePages(pages.length > 1);
                const sorted = pages.sort((a: any, b: any) => a.displayOrderNo - b.displayOrderNo);
                setFirstPageId(sorted[0].pageId);
                const base64Img = await getDocumentPageImage(docCd, sorted[0].pageId);
                setCoverImage(base64Img);
            }
        } catch (err) {
            console.warn('Failed to load cover image:', err);
        }
    }, []);

    const loadHistory = useCallback(async () => {
        if (!patientNo || !admissionNo || !documentCd) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const res = await getPatientDocumentVersions(patientNo, admissionNo, documentCd);
            setHistory(Array.isArray(res) ? res : []);
            loadCoverImage(documentCd);
        } catch (e) {
            console.warn('Failed to load archived history', e);
        } finally {
            setLoading(false);
        }
    }, [patientNo, admissionNo, documentCd]);

    const loadStorage = useCallback(async () => {
        try {
            const storedA = await AsyncStorage.getItem(ARCHIVED_KEY);
            if (storedA) setArchivedIds(new Set(JSON.parse(storedA)));

            const storedD = await AsyncStorage.getItem(DELETED_KEY);
            if (storedD) setDeletedIds(new Set(JSON.parse(storedD)));
        } catch (e) {
            console.warn('Failed to load storage', e);
        }
    }, [ARCHIVED_KEY, DELETED_KEY]);

    useFocusEffect(
        useCallback(() => {
            loadHistory();
            loadStorage();
        }, [loadHistory, loadStorage])
    );

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setToastVisible(true);
        Animated.sequence([
            Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.delay(1500),
            Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => setToastVisible(false));
    };

    const handleUnarchive = async (version: ApiVersionItem) => {
        const id = version.documentInstanceId;
        const newArchived = new Set(archivedIds);
        newArchived.delete(id);
        setArchivedIds(newArchived);
        showToast(`Version ${version.versionNo} restored to history`);

        try {
            await AsyncStorage.setItem(ARCHIVED_KEY, JSON.stringify(Array.from(newArchived)));
        } catch (e) {
            console.warn('Failed to save archived status', e);
        }
    };

    const handlePermanentDelete = (version: ApiVersionItem) => {
        setSelectedVersion(version);
        setShowDeleteModal(true);
    };

    const onConfirmDelete = async () => {
        if (!selectedVersion) return;
        const id = selectedVersion.documentInstanceId;
        const newArchived = new Set(archivedIds);
        const newDeleted = new Set(deletedIds);
        newArchived.delete(id);
        newDeleted.add(id);

        setArchivedIds(newArchived);
        setDeletedIds(newDeleted);
        setShowDeleteModal(false);
        showToast(`Version ${selectedVersion.versionNo} permanently deleted`);

        try {
            await AsyncStorage.setItem(ARCHIVED_KEY, JSON.stringify(Array.from(newArchived)));
            await AsyncStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(newDeleted)));
        } catch (e) {
            console.warn('Failed to delete version', e);
        }
    };

    const openVersion = (version: ApiVersionItem) => {
        navigation.push('FormImageScreen', {
            ...route.params,
            documentInstanceId: version.documentInstanceId,
            versionNo: version.versionNo,
            historyMode: true,
        });
    };

    const groupedData = useMemo(() => {
        const groups: { [key: string]: ApiVersionItem[] } = {};
        history.forEach(item => {
            if (archivedIds.has(item.documentInstanceId) && !deletedIds.has(item.documentInstanceId)) {
                const dateStr = item.createdDt ? item.createdDt.split('T')[0] : 'Unknown';
                if (!groups[dateStr]) groups[dateStr] = [];
                groups[dateStr].push(item);
            }
        });

        const result: GroupedHistory[] = Object.keys(groups).map(dateStr => {
            let label = dateStr;
            if (dateStr !== 'Unknown') {
                const today = moment().startOf('day');
                const itemDate = moment(dateStr, 'YYYY-MM-DD').startOf('day');
                const diffDays = today.diff(itemDate, 'days');
                if (diffDays === 0) label = 'Today';
                else label = moment(dateStr, 'YYYY-MM-DD').format('DD MMM YYYY');
            }
            return {
                dateLabel: label,
                dateObj: dateStr === 'Unknown' ? new Date(0) : new Date(dateStr),
                items: groups[dateStr].sort((a, b) => b.versionNo - a.versionNo),
            };
        });

        return result.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
    }, [history, archivedIds, deletedIds]);

    return (
        <SafeAreaView style={[styles.safeArea, isDark && { backgroundColor: colors.background }]}>
            <View style={[styles.header, isDark && { backgroundColor: colors.surface, borderBottomWidth: 0 }]}>
                <TouchableOpacity
                    style={[styles.backButton, isDark && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#0EA5A4' }]}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={22} color={isDark ? '#0EA5A4' : '#fff'} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Archived Versions</Text>
                <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity
                        style={[styles.backButton, isDark && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#0EA5A4' }]}
                        onPress={() => navigation.navigate('PatientScreen')}
                    >
                        <Ionicons name="home" size={22} color={isDark ? '#0EA5A4' : '#fff'} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.container}>
                {loading ? (
                    <Text style={[styles.empty, isDark && { color: colors.textMuted }]}>Loading archive...</Text>
                ) : groupedData.length === 0 ? (
                    <Text style={[styles.empty, isDark && { color: colors.textMuted }]}>No archived versions found</Text>
                ) : (
                    <FlatList
                        data={groupedData}
                        keyExtractor={(item) => item.dateLabel}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        renderItem={({ item: group }) => (
                            <View style={styles.groupContainer}>
                                <Text style={[styles.dateLabel, isDark && { color: colors.textPrimary }]}>{group.dateLabel}</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                                    {group.items.map((version) => (
                                        <TouchableOpacity
                                            key={version.documentInstanceId}
                                            style={styles.cardWrapper}
                                            onPress={() => openVersion(version)}
                                            activeOpacity={0.9}
                                        >
                                            <VersionCover
                                                version={version}
                                                firstPageId={firstPageId}
                                                coverImage={coverImage}
                                                isDark={isDark}
                                                colors={colors}
                                                hasMultiplePages={hasMultiplePages}
                                            />
                                            <Text style={[styles.versionLabel, isDark && { color: colors.textPrimary }]}>Version {version.versionNo}</Text>

                                            <View style={styles.actionRow}>
                                                <TouchableOpacity
                                                    style={[styles.actionBtn, { backgroundColor: '#0EA5A4' }]}
                                                    onPress={() => handleUnarchive(version)}
                                                >
                                                    <Ionicons name="refresh-outline" size={18} color="#fff" />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.actionBtn, { backgroundColor: '#ef4444', marginLeft: 8 }]}
                                                    onPress={() => handlePermanentDelete(version)}
                                                >
                                                    <Ionicons name="trash-outline" size={18} color="#fff" />
                                                </TouchableOpacity>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                    />
                )}
            </View>

            {toastVisible && (
                <Animated.View style={[styles.toastContainer, { opacity: toastOpacity }]}>
                    <View style={styles.toastContent}>
                        <Text style={styles.toastText}>{toastMessage}</Text>
                    </View>
                </Animated.View>
            )}

            <Modal
                visible={showDeleteModal}
                transparent
                animationType="fade"
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, isDark && { backgroundColor: colors.surface }]}>
                        {/* <Ionicons name="help-circle" size={48} color="#0EA5A4" style={{ marginBottom: 16 }} /> */}
                        <Text style={[styles.modalTitle, isDark && { color: colors.textPrimary }]}>
                            Are you sure you want to delete?
                        </Text>
                        <Text style={[styles.modalSub, isDark && { color: colors.textMuted }]}>
                            This will permanently remove Version {selectedVersion?.versionNo}.
                        </Text>

                        <View style={styles.modalRow}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: '#0EA5A4' }]}
                                onPress={onConfirmDelete}
                            >
                                <Text style={styles.modalBtnText}>Yes</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: isDark ? colors.border : '#E5E7EB' }]}
                                onPress={() => setShowDeleteModal(false)}
                            >
                                <Text style={[styles.modalBtnText, { color: isDark ? colors.textPrimary : '#374151' }]}>No</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0EA5A4',
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
    container: { flex: 1 },
    empty: { textAlign: 'center', marginTop: 100, fontSize: 16, color: '#6B7280' },
    groupContainer: { marginTop: 20 },
    dateLabel: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginLeft: 16, marginBottom: 12 },
    horizontalScroll: { paddingLeft: 16, paddingRight: 8 },
    cardWrapper: {
        marginRight: 16,
        width: CARD_WIDTH,
        alignItems: 'center',
    },
    coverPlaceholder: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    versionLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 10, marginBottom: 8 },
    actionRow: { flexDirection: 'row', marginTop: 4 },
    actionBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
    },
    toastContainer: {
        position: 'absolute',
        top: '50%',
        left: 20,
        right: 20,
        alignItems: 'center',
        zIndex: 9999,
        marginTop: -25,
    },
    toastContent: {
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 30,
        elevation: 10,
    },
    toastText: { color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center' },
    multiPageIcon: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 4,
        padding: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        elevation: 10,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: 8,
        textAlign: 'center',
    },
    modalSub: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 24,
    },
    modalRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        width: '100%',
    },
    modalBtn: {
        flex: 1,
        flexDirection: 'row',
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 6,
    },
    modalBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
});
