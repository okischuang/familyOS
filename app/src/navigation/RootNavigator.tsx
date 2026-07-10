import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { RootStackParamList } from '../types';
import HomeScreen from '../screens/home/HomeScreen';
import AlertDetailScreen from '../screens/alerts/AlertDetailScreen';
import SolutionsScreen from '../screens/alerts/SolutionsScreen';
import ConfirmScreen from '../screens/alerts/ConfirmScreen';
import { AuditScreen, PendingActionsScreen } from '../screens/audit';
import { SubscriptionsScreen, SubscriptionActionScreen } from '../screens/subscriptions';

type TabParamList = {
  HomeTab: undefined;
  SubscriptionsTab: undefined;
  PendingTab: undefined;
  AuditTab: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// Tab icon component
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    '首頁': '🏠',
    '訂閱': '💳',
    '待執行': '⏰',
    '紀錄': '📋',
  };
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 20 }}>{icons[name]}</Text>
      <Text
        style={{
          fontSize: 10,
          color: focused ? '#1a1a1a' : '#9ca3af',
          marginTop: 2,
        }}
      >
        {name}
      </Text>
    </View>
  );
}

// Main Tab Navigator
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#fff',
        },
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e5e7eb',
          height: 60,
          paddingBottom: 8,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: 'Laxie',
          tabBarIcon: ({ focused }) => <TabIcon name="首頁" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="SubscriptionsTab"
        component={SubscriptionsScreen}
        options={{
          title: '訂閱管家',
          tabBarIcon: ({ focused }) => <TabIcon name="訂閱" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="PendingTab"
        component={PendingActionsScreen}
        options={{
          title: '待執行',
          tabBarIcon: ({ focused }) => <TabIcon name="待執行" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="AuditTab"
        component={AuditScreen}
        options={{
          title: '行動紀錄',
          tabBarIcon: ({ focused }) => <TabIcon name="紀錄" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Main"
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
          name="Main"
          component={MainTabs}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{
            title: 'Laxie',
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
        <Stack.Screen
          name="SubscriptionAction"
          component={SubscriptionActionScreen}
          options={{
            title: '訂閱決策',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
