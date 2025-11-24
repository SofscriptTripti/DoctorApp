// src/PatientScreen.tsx
import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const PATIENTS = [
  'Tripti Shukla',
  'Priyanka Singh',
  'Rohit Kumar',
  'Anjali Verma',
  'Sandeep Patel',
  'Neha Sharma',
  'Aman Gupta',
  'Sunita Rao',
  'Karan Mehta',
  'Pooja Joshi',
];

export default function PatientScreen() {
  const navigation = useNavigation<any>(); // `any` to avoid tight typing; swap with proper types if desired

  const handlePress = (name: string) => {
    // navigate to FormType and pass the selected patient name
    navigation.navigate('FormType', { patientName: name });
  };

  const renderItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => handlePress(item)}
    >
      <Text style={styles.name}>{item}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Patients</Text>
        <Text style={styles.headerSub}>Tap a name to open form types</Text>
      </View>

      <FlatList
        data={PATIENTS}
        keyExtractor={(item, idx) => `${idx}-${item}`}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FAFD' },
  header: {
    padding: 20,
    backgroundColor: '#0EA5A4',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerSub: { color: '#E6FFFE', fontSize: 13, marginTop: 6 },
  listContent: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 28 },
  card: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
  },
});
