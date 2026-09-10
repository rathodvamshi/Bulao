/**
 * Authentication Storage Module
 * 
 * Secure storage for session tokens using expo-secure-store.
 * This is the ONLY module that interacts with SecureStore for auth data.
 * 
 * SECURITY:
 * - Uses SecureStore for session tokens (encrypted on device)
 * - Never stores OTP
 * - Never stores MSG91 credentials
 * - Never stores sensitive secrets
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { SessionData } from './authTypes';

const SESSION_KEY = 'bulao_session_v1';
const inMemoryStorage = new Map<string, string>();

/**
 * Save session data to secure storage
 */
export async function saveSession(session: SessionData): Promise<void> {
  if (Platform.OS === 'web') {
    inMemoryStorage.set(SESSION_KEY, JSON.stringify(session));
    return;
  }

  try {
    await SecureStore.setItemAsync(
      SESSION_KEY,
      JSON.stringify(session),
      {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }
    );
  } catch (error) {
    console.error('Failed to save session:', error);
    throw new Error('Failed to save session');
  }
}

/**
 * Retrieve session data from secure storage
 */
export async function getSession(): Promise<SessionData | null> {
  if (Platform.OS === 'web') {
    const stored = inMemoryStorage.get(SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  }

  try {
    const stored = await SecureStore.getItemAsync(SESSION_KEY);
    if (!stored) return null;
    
    const session: SessionData = JSON.parse(stored);
    
    // Basic validation
    if (!session.token || !session.expiresAt || !session.userId) {
      console.warn('Invalid session structure in storage');
      await clearSession();
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
}

/**
 * Clear session data from secure storage
 */
export async function clearSession(): Promise<void> {
  if (Platform.OS === 'web') {
    inMemoryStorage.delete(SESSION_KEY);
    return;
  }

  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch (error) {
    // Silently handle - session may not exist
    console.debug('Clear session error (may be expected):', error);
  }
}

/**
 * Check if a session exists (without reading full data)
 */
export async function hasSession(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return inMemoryStorage.has(SESSION_KEY);
  }

  try {
    const stored = await SecureStore.getItemAsync(SESSION_KEY);
    return stored !== null;
  } catch {
    return false;
  }
}
