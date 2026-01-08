import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useStore } from '../../hooks/useStore';
import { MOCK_ALERT } from '../../data/mockData';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

export default function HomeScreen({ navigation }: Props) {
  const { user } = useStore();
  const alert = MOCK_ALERT;

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4">
        <View className="border-b border-dashed border-gray-300 pb-3 mb-4">
          <Text className="text-xs text-gray-500">
            {new Date().toLocaleDateString('zh-TW', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })}
          </Text>
          <View className="flex-row items-center mt-1">
            <Text className="text-lg text-gray-700">家庭狀態：</Text>
            <View className="bg-red-100 px-2 py-1 rounded ml-2">
              <Text className="text-red-700 font-bold text-sm">⚠️ 需要處理</Text>
            </View>
          </View>
          {user && (
            <Text className="text-xs text-gray-400 mt-1">
              嗨，{user.displayName}
            </Text>
          )}
        </View>

        <View className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4 rounded-r-lg">
          <Text className="font-bold text-yellow-800">
            1 件事需要處理
          </Text>
        </View>

        <TouchableOpacity
          className="bg-white border border-gray-200 rounded-xl p-4"
          onPress={() => navigation.navigate('AlertDetail', { alert })}
        >
          <View className="flex-row items-start">
            <Text className="text-2xl mr-3">🚨</Text>
            <View className="flex-1">
              <Text className="font-semibold text-gray-800 text-base">
                {alert.title}
              </Text>
              <Text className="text-gray-500 text-sm mt-1">
                {alert.description}
              </Text>
              <View className="flex-row items-center mt-2">
                <View className="bg-red-100 px-2 py-0.5 rounded">
                  <Text className="text-red-600 text-xs">高風險</Text>
                </View>
                <Text className="text-gray-400 text-xs ml-2">
                  點擊查看詳情
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          className="w-full bg-gray-800 py-4 rounded-xl mt-4"
          onPress={() => navigation.navigate('AlertDetail', { alert })}
        >
          <Text className="text-white text-center font-semibold text-base">
            👉 查看建議解法
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
