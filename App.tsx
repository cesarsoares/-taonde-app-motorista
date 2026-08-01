import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from './src/session';
import LoginScreen from './src/screens/LoginScreen';
import RotaScreen from './src/screens/RotaScreen';

const Stack = createNativeStackNavigator();

// Gate de auth: sem token → Login; com token → Rota. (Mais telas entram no stack
// da rota conforme a fatia cresce: Parada, POD…)
function Navegacao() {
  const { token, carregando } = useSession();
  if (carregando) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a1310', justifyContent: 'center' }}>
        <ActivityIndicator color="#34d399" size="large" />
      </View>
    );
  }
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {token ? (
        <Stack.Screen name="Rota" component={RotaScreen} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

const tema = { ...DarkTheme, colors: { ...DarkTheme.colors, background: '#0a1310' } };

export default function App() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <NavigationContainer theme={tema}>
          <Navegacao />
        </NavigationContainer>
        <StatusBar style="light" />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
