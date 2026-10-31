import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import Icon from '@react-native-vector-icons/ionicons';
import { COLORS } from '../../src/theme';
import { useT } from '../../src/i18n/LanguageProvider';
import { COMMUNITY_ENABLED } from '../../src/communityFeature';

export default function TabsLayout() {
  const { t } = useT();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.brand,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarItemStyle: { alignSelf: 'center' },
        tabBarStyle: {
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#FFFFFFF2',
          borderTopColor: COLORS.border,
          ...(Platform.OS === 'web' ? { height: 64 } : {}),
        },
        tabBarBackground: Platform.OS === 'ios' ? () => (
          <BlurView intensity={90} tint="light" style={{ flex: 1 }} />
        ) : undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.calc,
          tabBarIcon: ({ color, size }) => <Icon name="calculator" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: t.tabs.feed,
          href: COMMUNITY_ENABLED ? undefined : null,
          tabBarIcon: ({ color, size }) => <Icon name="pizza" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: t.tabs.planner,
          tabBarIcon: ({ color, size }) => <Icon name="time" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.tabs.profile,
          tabBarIcon: ({ color, size }) => <Icon name="person-circle" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
