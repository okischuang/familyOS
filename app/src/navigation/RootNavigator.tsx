import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import HomeScreen from '../screens/home/HomeScreen';
import AlertDetailScreen from '../screens/alerts/AlertDetailScreen';
import SolutionsScreen from '../screens/alerts/SolutionsScreen';
import ConfirmScreen from '../screens/alerts/ConfirmScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#fff',
          },
          headerTitleStyle: {
            fontWeight: '600',
          },
          headerShadowVisible: false,
          headerBackTitle: '返回',
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{
            title: 'Laxie',
            headerLargeTitle: true,
          }}
        />
        <Stack.Screen
          name="AlertDetail"
          component={AlertDetailScreen}
          options={{
            title: '警報詳情',
          }}
        />
        <Stack.Screen
          name="Solutions"
          component={SolutionsScreen}
          options={{
            title: '建議解法',
          }}
        />
        <Stack.Screen
          name="Confirm"
          component={ConfirmScreen}
          options={{
            title: '確認協調',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
