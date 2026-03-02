// App.tsx
import React from 'react';
import { StatusBar, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// 🔹 REDUX
import { Provider } from 'react-redux';
import { store } from './android/src/store';
import { ThemeProvider } from './android/src/theme/ThemeContext';

// Screens
import PatientScreen from './android/src/PatientScreen';
import FormType from './android/src/FormType';
import FormImageScreen from './android/src/FormImageScreen';
import FormImageEditor from './android/src/FormImageEditor';
import CareScribeLogin from './android/src/components/CareScribeLogin';
import ArchivedHistory from './android/src/ArchivedHistory';
import HMISFormType from './android/src/HMISFromType';
import NoOFReport from './android/src/NoOFReport';
import PdfViewerScreen from './android/src/PdfViewerScreen';
import EditorHistory from './android/src/EditHistory';
import ImagePdfViewerScreen from './android/src/ImagePdfViewerScreen';
import RxNotes from './android/src/RxNotes';

const Stack = createNativeStackNavigator();

/**
 * Runtime checks (kept as-is)
 */
if (!PatientScreen) {
  console.error('[App] PatientScreen import is undefined - check export/import path');
}
if (!FormType) {
  console.error('[App] FormType import is undefined - check export/import path');
}
if (!FormImageScreen) {
  console.error('[App] FormImageScreen import is undefined - check export/import path');
}
if (!FormImageEditor) {
  console.error('[App] FormImageEditor import is undefined - check export/import path');
}
if (!CareScribeLogin) {
  console.error('[App] CareScribeLogin import is undefined - check export/import path');
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    // 🔹 Redux Provider (TOP LEVEL)
    <Provider store={store}>
      <ThemeProvider>
        <GestureHandlerRootView style={styles.root}>
          <SafeAreaProvider>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

            <NavigationContainer>
              <Stack.Navigator
                initialRouteName="CareScribeLogin"
                screenOptions={{ headerShown: false }}
              >
                {/* Auth */}
                <Stack.Screen
                  name="CareScribeLogin"
                  component={CareScribeLogin}
                />

                {/* Main Screens */}
                <Stack.Screen
                  name="PatientScreen"
                  component={PatientScreen}
                />
                <Stack.Screen
                  name="FormType"
                  component={FormType}
                />

                {/* Form / Editor */}
                <Stack.Screen
                  name="FormImageEditor"
                  component={FormImageEditor}
                />
                <Stack.Screen
                  name="FormImageScreen"
                  component={FormImageScreen}
                />
                <Stack.Screen
                  name="HMISFormType"
                  component={HMISFormType}
                />
                <Stack.Screen
                  name="NoOFReport"
                  component={NoOFReport}
                />
                <Stack.Screen
                  name="PdfViewer"
                  component={PdfViewerScreen}
                />
                <Stack.Screen
                  name="EditorHistory"
                  component={EditorHistory}
                />
                <Stack.Screen
                  name="RxNotes"
                  component={RxNotes}
                />
                <Stack.Screen
                  name="ImagePdfViewer"
                  component={ImagePdfViewerScreen}
                />
                <Stack.Screen
                  name="ArchivedHistory"
                  component={ArchivedHistory}
                />
              </Stack.Navigator>
            </NavigationContainer>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ThemeProvider>
    </Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default App;
