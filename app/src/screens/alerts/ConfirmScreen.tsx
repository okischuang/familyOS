import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Share, Alert as RNAlert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { generateMessage } from '../../services/openai';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Confirm'>;
  route: RouteProp<RootStackParamList, 'Confirm'>;
};

export default function ConfirmScreen({ navigation, route }: Props) {
  const { solution } = route.params;
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMessage();
  }, []);

  const loadMessage = async () => {
    setLoading(true);
    try {
      const result = await generateMessage(solution);
      setMessage(result);
    } catch (error) {
      console.error('Failed to generate message:', error);
      setMessage('無法生成訊息，請稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(message);
    RNAlert.alert('已複製', '訊息已複製到剪貼簿');
  };

  const handleShare = async () => {
    try {
      await Share.share({ message });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleDone = () => {
    navigation.popToTop();
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4">
        <View className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
          <View className="flex-row items-center">
            <Text className="text-xl mr-2">✓</Text>
            <View className="flex-1">
              <Text className="font-semibold text-green-800">已選擇解法</Text>
              <Text className="text-green-700 text-sm mt-0.5">{solution.label}</Text>
            </View>
          </View>
        </View>

        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-gray-500 text-sm mb-1">你選擇的方案</Text>
          <Text className="text-gray-800">{solution.description}</Text>
        </View>

        <View className="mb-4">
          <Text className="text-sm text-gray-500 mb-2">💬 系統建議你這樣說：</Text>
          <View className="bg-white rounded-xl p-4 border-2 border-dashed border-gray-300">
            {loading ? (
              <View className="items-center py-4">
                <ActivityIndicator size="small" color="#1f2937" />
                <Text className="text-gray-500 text-sm mt-2">AI 正在生成訊息...</Text>
              </View>
            ) : (
              <Text className="text-gray-800 leading-6">{message}</Text>
            )}
          </View>
        </View>

        <View>
          <TouchableOpacity
            className="w-full bg-white border border-gray-300 py-4 rounded-xl flex-row items-center justify-center mb-3"
            onPress={handleCopy}
            disabled={loading}
          >
            <Text className="text-base mr-2">📋</Text>
            <Text className="font-semibold text-gray-800">複製文字</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="w-full bg-green-500 py-4 rounded-xl flex-row items-center justify-center"
            onPress={handleShare}
            disabled={loading}
          >
            <Text className="text-base mr-2">💬</Text>
            <Text className="font-semibold text-white">分享訊息</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity className="mt-6 py-3" onPress={handleDone}>
          <Text className="text-center text-gray-500 underline">完成，返回首頁</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
