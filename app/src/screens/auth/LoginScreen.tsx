import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useStore } from '../../hooks/useStore';

export default function LoginScreen() {
  const [name, setName] = useState('');
  const { setUser } = useStore();

  const handleLogin = () => {
    if (!name.trim()) return;

    setUser({
      id: 'mock-user-1',
      email: `${name.toLowerCase()}@demo.com`,
      displayName: name,
      role: 'primary',
      familyId: 'family-1',
      settings: {
        defaultPickupPerson: 'me',
        notificationPreferences: {
          pushEnabled: true,
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
        },
      },
      calendarConnections: {},
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
    });
    // Navigation happens automatically via conditional rendering in App.tsx
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-50"
    >
      <View className="flex-1 justify-center px-8">
        <View className="items-center mb-8">
          <Text className="text-5xl mb-4">👨‍👩‍👧‍👦</Text>
          <Text className="text-3xl font-bold text-gray-800">Laxie</Text>
          <Text className="text-gray-500 mt-2">家庭協調助手</Text>
        </View>

        <View className="mb-6">
          <Text className="text-sm text-gray-600 mb-2">你的名字</Text>
          <TextInput
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-base"
            placeholder="例如：小明"
            value={name}
            onChangeText={setName}
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity
          className={`py-4 rounded-lg ${name.trim() ? 'bg-gray-800' : 'bg-gray-300'}`}
          onPress={handleLogin}
          disabled={!name.trim()}
        >
          <Text className="text-white text-center font-semibold text-base">
            開始使用
          </Text>
        </TouchableOpacity>

        <Text className="text-center text-gray-400 text-xs mt-6">
          Demo 版本 - 無需真實登入
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
