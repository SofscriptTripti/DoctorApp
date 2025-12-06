// App.tsx
import React from 'react';
import { StatusBar, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// NOTE: Use default imports to avoid "undefined" when a file only exports default.
// If a file also exports a named export and you prefer named imports that's fine,
// but be sure the export/import style matches.
import PatientScreen from './android/src/PatientScreen';
import FormType from './android/src/FormType';
import FormImageScreen from './android/src/FormImageScreen'; // default import
import FormImageEditor from './android/src/FormImageEditor'; // default import
import CareScribeLogin from './android/src/components/CareScribeLogin';

const Stack = createNativeStackNavigator();

/**
 * Small runtime checks to fail fast if a screen import resolved to `undefined`.
 * If any of these log show up, fix the corresponding file's export/import.
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
    // GestureHandlerRootView must be the ancestor of any gesture users.
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

        <NavigationContainer>
          <Stack.Navigator initialRouteName="CareScribeLogin" screenOptions={{ headerShown: false }}>
            {/* corrected route name */}
            <Stack.Screen name="CareScribeLogin" component={CareScribeLogin} />

            {/* your main screens */}
            <Stack.Screen name="PatientScreen" component={PatientScreen} />
            <Stack.Screen name="FormType" component={FormType} />

            {/* Form image editor & viewer */}
            <Stack.Screen name="FormImageEditor" component={FormImageEditor} />
            <Stack.Screen name="FormImageScreen" component={FormImageScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default App;
