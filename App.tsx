// App.tsx
import React from 'react';
import { StatusBar, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PatientScreen from './android/src/PatientScreen';
import FormType from './android/src/FormType';
import { FormImageScreen } from './android/src/FormImageScreen';
// keep FormImageEditor lazy-required to avoid forcing native module load at app startup
// import FormImageEditor from './android/src/FormImageEditor';

const Stack = createNativeStackNavigator();

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    // GestureHandlerRootView must be the ancestor of any gesture users.
    // Put it at the very top so all gesture handlers (including inside navigation) work.
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Patients" component={PatientScreen} />
            <Stack.Screen name="FormType" component={FormType} />

            {/* Lazy-load the editor so the native module isn't required until the screen is opened */}
            <Stack.Screen
              name="FormImageEditor"
              getComponent={() => require('./android/src/FormImageEditor').default}
            />

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
