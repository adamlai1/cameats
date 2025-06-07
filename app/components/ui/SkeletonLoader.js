import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

const WINDOW_WIDTH = Dimensions.get('window').width;

export const PostSkeleton = () => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmer.start();

    return () => shimmer.stop();
  }, []);

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-WINDOW_WIDTH, WINDOW_WIDTH],
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.profilePicSkeleton}>
          <Animated.View
            style={[
              styles.shimmer,
              {
                transform: [{ translateX: shimmerTranslate }],
              },
            ]}
          />
        </View>
        <View style={styles.usernameSkeleton}>
          <Animated.View
            style={[
              styles.shimmer,
              {
                transform: [{ translateX: shimmerTranslate }],
              },
            ]}
          />
        </View>
      </View>
      <View style={styles.imageSkeleton}>
        <Animated.View
          style={[
            styles.shimmer,
            {
              transform: [{ translateX: shimmerTranslate }],
            },
          ]}
        />
      </View>
      <View style={styles.actionsSkeleton}>
        <View style={styles.actionIconSkeleton}>
          <Animated.View
            style={[
              styles.shimmer,
              {
                transform: [{ translateX: shimmerTranslate }],
              },
            ]}
          />
        </View>
      </View>
      <View style={styles.captionSkeleton}>
        <Animated.View
          style={[
            styles.shimmer,
            {
              transform: [{ translateX: shimmerTranslate }],
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  profilePicSkeleton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E1E9EE',
    overflow: 'hidden',
  },
  usernameSkeleton: {
    width: 100,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#E1E9EE',
    marginLeft: 12,
    overflow: 'hidden',
  },
  imageSkeleton: {
    width: WINDOW_WIDTH,
    aspectRatio: 1,
    backgroundColor: '#E1E9EE',
    overflow: 'hidden',
  },
  actionsSkeleton: {
    padding: 12,
  },
  actionIconSkeleton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E1E9EE',
    overflow: 'hidden',
  },
  captionSkeleton: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  captionLine: {
    height: 10,
    borderRadius: 4,
    backgroundColor: '#E1E9EE',
    marginBottom: 6,
    overflow: 'hidden',
  },
  shimmer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F2F8FC',
    opacity: 0.5,
  },
}); 