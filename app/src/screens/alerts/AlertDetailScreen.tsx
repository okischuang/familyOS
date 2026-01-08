import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { MOCK_CONFLICT_CONTEXT } from '../../data/mockData';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AlertDetail'>;
  route: RouteProp<RootStackParamList, 'AlertDetail'>;
};

export default function AlertDetailScreen({ navigation, route }: Props) {
  const { alert } = route.params;
  const context = MOCK_CONFLICT_CONTEXT;

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4">
        <View className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4 rounded-r-lg">
          <Text className="font-bold text-yellow-800">⚠️ 行程衝突</Text>
        </View>

        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-gray-500 text-sm">衝突時間</Text>
          <Text className="text-xl font-bold text-gray-800 mt-1">
            {context.conflictTime}
          </Text>
        </View>

        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="font-semibold text-gray-800 mb-3">發生什麼事？</Text>
          {context.events.map((event, index) => (
            <View
              key={index}
              className={`flex-row items-start py-2 ${index < context.events.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <View className="w-16">
                <Text className="text-gray-500 text-sm">{event.person}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-gray-800">{event.event}</Text>
                <Text className="text-gray-400 text-xs mt-0.5">
                  📍 {event.location}
                  {event.deadline && ` · ${event.deadline}`}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <Text className="font-semibold text-red-700 mb-1">⚠️ 如果不處理</Text>
          <Text className="text-red-600 text-sm">{context.consequence}</Text>
        </View>

        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-gray-500 text-sm mb-2">可以幫忙的人</Text>
          <View className="flex-row flex-wrap">
            {context.availableHelpers.map((helper, index) => (
              <View key={index} className="bg-gray-100 px-3 py-1.5 rounded-full mr-2 mb-2">
                <Text className="text-gray-700 text-sm">{helper}</Text>
              </View>
            ))}
            <View className="bg-gray-100 px-3 py-1.5 rounded-full mr-2 mb-2">
              <Text className="text-gray-700 text-sm">另一半</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          className="w-full bg-gray-800 py-4 rounded-xl"
          onPress={() => navigation.navigate('Solutions', { alert })}
        >
          <Text className="text-white text-center font-semibold text-base">
            👉 看解決方式
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
