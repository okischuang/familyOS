import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
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

  const canSubmit = name.trim().length > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.logoBlock}>
          <Text style={styles.emoji}>👨‍👩‍👧‍👦</Text>
          <Text style={styles.brand}>Laxie</Text>
          <Text style={styles.tagline}>家庭協調助手</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>你的名字</Text>
          <TextInput
            style={styles.input}
            placeholder="例如：小明"
            value={name}
            onChangeText={setName}
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity
          style={[styles.button, canSubmit ? styles.buttonActive : styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={!canSubmit}
        >
          <Text style={styles.buttonText}>開始使用</Text>
        </TouchableOpacity>

        <Text style={styles.footnote}>Demo 版本 - 無需真實登入</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoBlock: {
    alignItems: 'center',
    marginBottom: 32,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  brand: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1f2937',
  },
  tagline: {
    color: '#6b7280',
    marginTop: 8,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonActive: {
    backgroundColor: '#1f2937',
  },
  buttonDisabled: {
    backgroundColor: '#d1d5db',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  footnote: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 24,
  },
});
