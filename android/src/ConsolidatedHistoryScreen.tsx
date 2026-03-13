import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import moment from 'moment';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from './theme/ThemeContext';
import { getDeletedPatientDocuments, getPatientDocumentArchiveLog } from './api/patientDocumentsApi';

const ConsolidatedHistoryScreen = () => {
    const { isDark, colors } = useTheme();
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { patientNo, admissionNo, documentCd, archivedVersions } = route.params || {};

    const [activeTab, setActiveTab] = useState<'deleted' | 'archive'>('archive');
    const [deletedHistory, setDeletedHistory] = useState<any[]>([]);
    const [archiveLogs, setArchiveLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);


    const fetchHistory = useCallback(async () => {
        setLoading(true);
        console.log('📝 [ConsolidatedHistory] Fetching for:', { patientNo, admissionNo, documentCd });
        try {
            // 1. Fetch Deleted History
            const deletedData = await getDeletedPatientDocuments(patientNo, admissionNo, documentCd);
            console.log('✅ [ConsolidatedHistory] Deleted History Data:', JSON.stringify(deletedData, null, 2));
            setDeletedHistory(deletedData || []);

            // 2. Fetch Archive Logs for all archived versions passed in
            // Since there is no bulk API, we fetch per version. 
            // If archivedVersions is large, this might be slow, but usually it's a small list.
            if (archivedVersions && Array.isArray(archivedVersions)) {
                const logPromises = archivedVersions.map(v => getPatientDocumentArchiveLog(v.documentInstanceId));
                const allLogsResults = await Promise.all(logPromises);

                // Using .concat for better compatibility (replaces .flat())
                const flattenedLogs: any[] = [].concat(...allLogsResults as any);
                console.log('✅ [ConsolidatedHistory] Raw Archive Logs Data:', JSON.stringify(flattenedLogs, null, 2));

                const sortedLogs = flattenedLogs.sort((a, b) =>
                    new Date(b.performedDt).getTime() - new Date(a.performedDt).getTime()
                );
                setArchiveLogs(sortedLogs);
            }
        } catch (error) {
            console.error('Failed to fetch history:', error);
        } finally {
            setLoading(false);
        }
    }, [patientNo, admissionNo, documentCd, archivedVersions]);

    useFocusEffect(
        useCallback(() => {
            fetchHistory();
        }, [fetchHistory])
    );

    const renderLogItem = (item: any, type: 'deleted' | 'archive') => {
        const isDeleted = type === 'deleted';
        const actionLabel = isDeleted ? 'DELETED' : (item.action === 'Archive' ? 'ARCHIVE' : 'UNARCHIVE');
        const color = isDeleted ? '#ef4444' : (item.action === 'Archive' ? '#f59e0b' : '#10b981');
        const date = isDeleted ? item.deletedDt : item.performedDt;
        const user = isDeleted ? item.deletedBy : item.performedBy;
        const reason = isDeleted ? item.deletionReason : item.note;

        return (
            <View key={item.logId || item.patientDocumentId || Math.random().toString()} style={[styles.logItem, isDark && { backgroundColor: colors.surface, borderLeftColor: color }, !isDark && { borderLeftColor: color }]}>
                <Text style={[styles.actionText, { color }]}>{actionLabel}</Text>

                <View style={styles.logBody}>
                    <View style={styles.logRow}>
                        <Text style={[styles.logValueText, isDark && { color: colors.textPrimary }]}>
                            <Text style={styles.logLabelText}>Version : </Text>V{item.versionNo}
                        </Text>
                    </View>

                    <View style={styles.logRow}>
                        <Text style={[styles.logValueText, isDark && { color: colors.textPrimary }]}>
                            <Text style={styles.logLabelText}>By : </Text>{user || '—'}
                        </Text>
                    </View>

                    <View style={styles.logRow}>
                        <Text style={[styles.logValueText, isDark && { color: colors.textPrimary }]}>
                            <Text style={styles.logLabelText}>Date/Time : </Text>{moment(date).format('DD MMM YYYY, hh:mm A')}
                        </Text>
                    </View>

                    {isDeleted && (
                        <View style={styles.logRow}>
                            <Text style={[styles.logValueText, isDark && { color: colors.textPrimary }]}>
                                <Text style={styles.logLabelText}>Reason : </Text>{reason || '—'}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.safeArea, isDark && { backgroundColor: colors.background }]}>
            <View style={[styles.header, isDark && { backgroundColor: colors.surface, borderBottomWidth: 0 }]}>
                <TouchableOpacity
                    style={[styles.backButton, isDark && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#0EA5A4' }]}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={22} color={isDark ? '#0EA5A4' : '#fff'} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, isDark && { color: '#fff' }]}>History of Documents</Text>
                <TouchableOpacity
                    style={[styles.backButton, isDark && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#0EA5A4' }]}
                    onPress={() => navigation.navigate('PatientScreen')}
                >
                    <Ionicons name="home" size={22} color={isDark ? '#0EA5A4' : '#fff'} />
                </TouchableOpacity>
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'archive' && styles.activeTab]}
                    onPress={() => setActiveTab('archive')}
                >
                    <Text style={[styles.tabText, activeTab === 'archive' && styles.activeTabText]}>Archive History</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'deleted' && styles.activeTab]}
                    onPress={() => setActiveTab('deleted')}
                >
                    <Text style={[styles.tabText, activeTab === 'deleted' && styles.activeTabText]}>Deleted History</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#0EA5A4" />
                    <Text style={[styles.loadingText, isDark && { color: colors.textMuted }]}>Fetching history data...</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {activeTab === 'archive' ? (
                        archiveLogs.length > 0 ? (
                            archiveLogs.map(log => renderLogItem(log, 'archive'))
                        ) : (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="archive-outline" size={60} color="#cbd5e1" />
                                <Text style={styles.emptyText}>No archive history found</Text>
                            </View>
                        )
                    ) : (
                        deletedHistory.length > 0 ? (
                            deletedHistory.map(log => renderLogItem(log, 'deleted'))
                        ) : (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="trash-outline" size={60} color="#cbd5e1" />
                                <Text style={styles.emptyText}>No deleted history found</Text>
                            </View>
                        )
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#0EA5A4',
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 18,
        elevation: 6,
    },
    backButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.18)',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
        flex: 1,
        textAlign: 'center',
    },
    tabContainer: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: 'transparent',
    },
    tab: {
        flex: 1,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        marginHorizontal: 4,
    },
    activeTab: {
        backgroundColor: '#0EA5A4',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    activeTabText: {
        color: '#fff',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    logItem: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderLeftWidth: 5,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    actionText: {
        fontSize: 16,
        fontWeight: '900',
        textTransform: 'uppercase',
        marginBottom: 16,
        letterSpacing: 0.5,
    },
    logBody: {
        gap: 10,
    },
    logRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    logValueText: {
        fontSize: 14,
        color: '#1F2937',
        fontWeight: '600',
        flexShrink: 1,
        lineHeight: 20,
    },
    logLabelText: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600', // Little bold as requested
        textTransform: 'none', // Changed to match "Version By Date Reason" case in prompt
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#64748b',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        marginTop: 100,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        color: '#94a3b8',
        fontWeight: '500',
    }
});

export default ConsolidatedHistoryScreen;
