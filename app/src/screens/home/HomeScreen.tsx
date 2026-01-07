import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useStore } from '../../hooks/useStore';

export default function HomeScreen() {
  const { alerts, user } = useStore();
  const pendingAlerts = alerts.filter((a) => a.status === 'pending');
  const hasHighSeverity = pendingAlerts.some((a) => a.severity === 'high');

  const getStatusColor = () => {
    if (pendingAlerts.length === 0) return 'bg-green-100 text-green-700';
    if (hasHighSeverity) return 'bg-red-100 text-red-700';
    return 'bg-yellow-100 text-yellow-700';
  };

  const getStatusText = () => {
    if (pendingAlerts.length === 0) return 'All Good';
    if (hasHighSeverity) return 'High Risk';
    return 'Needs Attention';
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4">
        {/* Header */}
        <View className="border-b border-dashed border-gray-300 pb-3 mb-4">
          <Text className="text-xs text-gray-500">
            Today · {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </Text>
          <View className="flex-row items-center gap-2 mt-1">
            <Text className="text-lg">Family Status:</Text>
            <View className={`px-2 py-1 rounded ${getStatusColor()}`}>
              <Text className="text-sm font-bold">{getStatusText()}</Text>
            </View>
          </View>
        </View>

        {/* Alert Summary */}
        {pendingAlerts.length > 0 && (
          <View className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
            <Text className="font-bold text-yellow-800">
              {pendingAlerts.length} item(s) need attention
            </Text>
          </View>
        )}

        {/* Alert List */}
        {pendingAlerts.length > 0 ? (
          <View className="space-y-3">
            {pendingAlerts.map((alert, idx) => (
              <TouchableOpacity
                key={alert.id}
                className="border border-gray-300 rounded-lg p-3 bg-white"
              >
                <Text className="font-medium">
                  {idx + 1}. {alert.title}
                </Text>
                <Text className="text-xs text-gray-500 mt-1">
                  {alert.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View className="items-center py-8">
            <Text className="text-4xl mb-2">🎉</Text>
            <Text className="text-gray-500">No issues today!</Text>
          </View>
        )}

        {/* Action Button */}
        {pendingAlerts.length > 0 && (
          <TouchableOpacity className="w-full bg-gray-800 py-3 rounded-lg mt-4">
            <Text className="text-white text-center font-medium">
              View Solutions
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}
