// app/tabs/TabsLayout.js

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';

import FeedScreen from './FeedScreen';
import PostScreen from './PostScreen';
import ProfileScreen from './ProfileScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function TabsLayout() {
  const pathname = usePathname();
  const localSearchParams = useLocalSearchParams();
  const { theme } = useTheme();
  const [currentTabIndex, setCurrentTabIndex] = useState(0);
  const translateX = useSharedValue(0);
  const feedScreenRef = useRef(null);
  const postScreenRef = useRef(null);
  const profileScreenRef = useRef(null);

  const tabs = [
    { name: 'FeedScreen', component: FeedScreen, label: 'Feed', icon: 'home' },
    { name: 'PostScreen', component: PostScreen, label: 'Post', icon: 'add-circle' },
    { name: 'ProfileScreen', component: ProfileScreen, label: 'Profile', icon: 'person' },
  ];

  useEffect(() => {
    const index = tabs.findIndex((tab) => pathname.includes(tab.name));
    if (index !== -1) {
      setCurrentTabIndex(index);
      translateX.value = -index * SCREEN_WIDTH;
    }
  }, []);

  useEffect(() => {
    if (localSearchParams.clearPostImages === 'true' && postScreenRef.current) {
      postScreenRef.current.clearImages();
    }
  }, [localSearchParams.clearPostImages]);

  const updateTabIndex = (index) => {
    setCurrentTabIndex(index);
  };

  const navigateToTab = (index) => {
    if (index === 0 && currentTabIndex === 0 && feedScreenRef.current) {
      feedScreenRef.current.scrollToTop();
      return;
    }
    if (index === 1 && currentTabIndex === 1 && postScreenRef.current) {
      postScreenRef.current.takePhoto();
      return;
    }
    if (index === 2 && currentTabIndex === 2 && profileScreenRef.current) {
      profileScreenRef.current.scrollToTop();
      return;
    }

    setCurrentTabIndex(index);
    translateX.value = withTiming(-index * SCREEN_WIDTH, { duration: 200 });
  };

  const handleSwipe = (event) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      const basePosition = -currentTabIndex * SCREEN_WIDTH;
      const newTranslateX = basePosition + event.nativeEvent.translationX;
      const minPosition = -(tabs.length - 1) * SCREEN_WIDTH;
      const maxPosition = 0;
      const constrainedTranslateX = Math.max(minPosition, Math.min(maxPosition, newTranslateX));
      translateX.value = constrainedTranslateX;
    } else if (event.nativeEvent.state === State.END) {
      const { translationX, velocityX } = event.nativeEvent;
      const swipeThreshold = SCREEN_WIDTH * 0.25;
      const velocityThreshold = 300;
      let targetIndex = currentTabIndex;
      if ((translationX > swipeThreshold || velocityX > velocityThreshold) && currentTabIndex > 0) {
        targetIndex = currentTabIndex - 1;
      } else if ((translationX < -swipeThreshold || velocityX < -velocityThreshold) && currentTabIndex < tabs.length - 1) {
        targetIndex = currentTabIndex + 1;
      }
      const targetPosition = -targetIndex * SCREEN_WIDTH;
      translateX.value = withTiming(targetPosition, { duration: 200 });
      runOnJS(updateTabIndex)(targetIndex);
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const TabBar = () => (
    <View style={[styles.tabBar, { backgroundColor: theme.tabBarBackground, borderTopColor: theme.border }]}>
      {tabs.map((tab, index) => {
        const isFocused = currentTabIndex === index;
        return (
          <TouchableOpacity key={tab.name} style={styles.tabItem} onPress={() => navigateToTab(index)}>
            <Ionicons name={tab.icon} size={24} color={isFocused ? theme.tabBarActive : theme.tabBarInactive} />
            <Text style={[styles.tabLabel, { color: isFocused ? theme.tabBarActive : theme.tabBarInactive }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={styles.container}>
      <PanGestureHandler onHandlerStateChange={handleSwipe} onGestureEvent={handleSwipe} minDeltaX={10} maxDeltaY={100} activeOffsetX={[-10, 10]} failOffsetY={[-50, 50]}>
        <View style={styles.screensWrapper}>
          <Animated.View style={[styles.screensContainer, animatedStyle]}>
            {tabs.map((tab) => {
              const Component = tab.component;
              return (
                <View key={tab.name} style={styles.screen}>
                  <Component
                    ref={(el) => {
                      if (tab.name === 'FeedScreen') feedScreenRef.current = el;
                      if (tab.name === 'PostScreen') postScreenRef.current = el;
                      if (tab.name === 'ProfileScreen') profileScreenRef.current = el;
                    }}
                  />
                </View>
              );
            })}
          </Animated.View>
        </View>
      </PanGestureHandler>
      <TabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  screensWrapper: { flex: 1, overflow: 'hidden' },
  screensContainer: { flex: 1, flexDirection: 'row', width: SCREEN_WIDTH * 3 },
  screen: { width: SCREEN_WIDTH, flex: 1 },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, paddingBottom: 34, paddingTop: 8 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  tabLabel: { fontSize: 12, marginTop: 4 },
});


