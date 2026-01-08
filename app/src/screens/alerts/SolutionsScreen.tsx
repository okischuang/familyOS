import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { generateSolutions } from '../../services/openai';
import type { Solution } from '../../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Solutions'>;
  route: RouteProp<RootStackParamList, 'Solutions'>;
};

export default function SolutionsScreen({ navigation, route }: Props) {
  const { alert } = route.params;
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSolutions();
  }, []);

  const loadSolutions = async () => {
    setLoading(true);
    try {
      const result = await generateSolutions();
      setSolutions(result);
      const recommended = result.find(s => s.isRecommended);
      if (recommended) {
        setSelectedId(recommended.id);
      }
    } catch (error) {
      console.error('Failed to load solutions:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedSolution = solutions.find(s => s.id === selectedId);

  if (loading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#1f2937" />
        <Text className="text-gray-500 mt-4">AI 正在分析最佳解法...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4">
        <View className="mb-4">
          <Text className="text-lg font-bold text-gray-800">建議解法</Text>
          <Text className="text-gray-500 text-sm mt-1">選擇一個最適合你的方案</Text>
        </View>

        <View>
          {solutions.map((solution) => (
            <TouchableOpacity
              key={solution.id}
              className={`bg-white rounded-xl p-4 mb-3 border-2 ${
                selectedId === solution.id ? 'border-green-500' : 'border-transparent'
              }`}
              onPress={() => setSelectedId(solution.id)}
            >
              <View className="flex-row items-center mb-2">
                <View
                  className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
                    selectedId === solution.id ? 'border-green-500 bg-green-500' : 'border-gray-300'
                  }`}
                >
                  {selectedId === solution.id && (
                    <Text className="text-white text-xs">✓</Text>
                  )}
                </View>
                <Text className="font-semibold text-gray-800 flex-1">
                  {solution.label}
                </Text>
                {solution.isRecommended && (
                  <View className="bg-green-100 px-2 py-0.5 rounded">
                    <Text className="text-green-700 text-xs">推薦</Text>
                  </View>
                )}
              </View>

              <Text className="text-gray-600 ml-8 mb-2">{solution.description}</Text>

              <View className="ml-8 bg-gray-50 rounded-lg p-3">
                <Text className="text-xs text-gray-500 mb-1">影響：</Text>
                {solution.impacts.map((impact, index) => (
                  <Text key={index} className="text-sm text-gray-600">{impact}</Text>
                ))}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          className={`w-full py-4 rounded-xl mt-4 ${selectedSolution ? 'bg-gray-800' : 'bg-gray-300'}`}
          disabled={!selectedSolution}
          onPress={() => {
            if (selectedSolution) {
              navigation.navigate('Confirm', { alert, solution: selectedSolution });
            }
          }}
        >
          <Text className="text-white text-center font-semibold text-base">
            確認選擇 →
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
