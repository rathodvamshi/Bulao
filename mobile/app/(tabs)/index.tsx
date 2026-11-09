import { useCallback, useState } from 'react';
import { StyleSheet, View, RefreshControl, Platform, Vibration, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Screen } from '../../src/components/ui';
import { t } from '../../src/i18n/en';
import { useLocation } from '../../src/store/location';
import { BulaoWordmark } from '../../src/components/BulaoWordmark';
import { AppPressable } from '../../src/components/AppPressable';
import { AppText as Text } from '../../src/components/AppText';
import { useAuth } from '../../src/auth';

const actions = [
  {
    title: 'findWork',
    hint: 'Look for a job near you',
    icon: 'briefcase-outline',
    tint: '#E4F1E9',
    iconColor: '#176342',
    path: '/find-work',
  },
  {
    title: 'hire',
    hint: 'Find a person to do your work',
    icon: 'people-outline',
    tint: '#F7EDDE',
    iconColor: '#90632D',
    path: '/provider-home',
  },
  {
    title: 'findService',
    hint: 'Find help for a task',
    icon: 'construct-outline',
    tint: '#E7F0F0',
    iconColor: '#397277',
    path: '/find-service',
  },
] as const;

export default function Home() {
  const { width } = useWindowDimensions();
  const auth = useAuth();
  const location = useLocation((state) => state.location);
  const areaName = location?.area;
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (Platform.OS === 'android') {
      Vibration.vibrate(15);
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
    setRefreshing(false);
  }, []);

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#176342"
          colors={['#176342']}
        />
      }
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <AppPressable
            accessibilityRole="button"
            accessibilityLabel={t('location')}
            accessibilityHint="Opens location selector"
            onPress={() => useLocation.getState().setLocationSheetVisible(true)}
            style={styles.locationButton}
          >
            <View style={styles.locationIcon}>
              <Ionicons name="location-outline" size={15} color="#176342" />
            </View>
            <Text style={styles.locationText} numberOfLines={1}>
              {areaName || t('location')}
            </Text>
            <Ionicons name="chevron-down" size={14} color="#52705E" />
          </AppPressable>

          <View style={styles.headerRight}>
            <AppPressable
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              accessibilityHint="Opens notification screen"
              onPress={() => router.push('/notifications')}
              style={styles.iconButton}
            >
              <Ionicons name="notifications-outline" size={20} color="#173627" />
            </AppPressable>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.brandRow}>
            <BulaoWordmark size={26} color="#0D3B27" />
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeText}>LOCAL WORK</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>Local work, solved together</Text>
          <Text style={styles.heroSubtitle}>
            Connect with verified local workers and employers in your neighborhood.
          </Text>
        </View>

        <View style={styles.actionsList}>
          {actions.map((action) => (
            <AppPressable
              key={action.title}
              accessibilityRole="button"
              accessibilityLabel={t(action.title)}
              accessibilityHint={action.hint}
              onPress={() => router.push(action.path as any)}
              style={({ pressed }) => [
                styles.actionCard,
                pressed && styles.actionCardPressed,
              ]}
            >
              <View style={[styles.actionIcon, { backgroundColor: action.tint }]}>
                <Ionicons name={action.icon} size={23} color={action.iconColor} />
              </View>
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>{t(action.title)}</Text>
                <Text style={styles.actionHint}>{action.hint}</Text>
              </View>
              <View style={styles.arrowCircle}>
                <Ionicons name="arrow-forward" size={16} color="#176342" />
              </View>
            </AppPressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 22, marginTop: -4, paddingBottom: 8 },
  header: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  locationButton: {
    maxWidth: '64%',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 7,
    paddingRight: 12,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E9E3',
  },
  locationIcon: {
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: '#E4F1E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#153928',
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E9E3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E4EBE6',
    gap: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  brandBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#E7F2EB',
  },
  brandBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#155739',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0E291C',
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#4E6B5D',
    lineHeight: 18,
  },
  actionsList: {
    gap: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E4ECE7',
  },
  actionCardPressed: {
    backgroundColor: '#F7FAF8',
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: {
    flex: 1,
    gap: 3,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#113324',
  },
  actionHint: {
    fontSize: 12,
    color: '#557264',
  },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EBF4EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
