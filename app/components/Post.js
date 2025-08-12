import { Ionicons } from '@expo/vector-icons';
import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { State, TapGestureHandler } from 'react-native-gesture-handler';
import { useTheme } from '../contexts/ThemeContext';

// Import bread slice images and bite animation
const breadNormal = require('../../assets/images/bread-normal.png');
const breadBitten = require('../../assets/images/bread-bitten.png');
const biteAnimationImage = require('../../assets/images/bite-animation.png');

const WINDOW_WIDTH = Dimensions.get('window').width;

// Memoized BreadButton component
const BreadButton = memo(({ postId, hasUserBited, onPress, theme }) => {
  const styles = getStyles(theme);
  return (
    <TouchableOpacity 
      style={styles.biteButton}
      onPress={() => onPress(postId)}
      activeOpacity={0.7}
    >
      <Image 
        source={hasUserBited ? breadBitten : breadNormal}
        style={styles.breadEmoji}
        fadeDuration={0}
      />
    </TouchableOpacity>
  );
});

// Grid Post Component
export const GridPost = memo(({ post, onPress }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  return (
    <TouchableOpacity onPress={() => onPress(post)} style={styles.gridItem}>
      <Image 
        source={{ uri: post.imageUrls?.[0] || post.imageUrl }} 
        style={styles.gridImage} 
      />
      {post.owners?.length > 1 && (
        <View style={styles.coOwnedBadge}>
          <Ionicons name="people" size={12} color="#fff" />
        </View>
      )}
      {post.imageUrls?.length > 1 && (
        <View style={styles.multipleImagesBadge}>
          <Ionicons name="images" size={12} color="#fff" />
        </View>
      )}
      <View style={styles.gridBiteCounter}>
        <Image 
          source={post.bitedBy?.includes(post.currentUserId) ? breadBitten : breadNormal}
          style={styles.gridBreadEmoji}
        />
        <Text style={styles.gridBiteCount}>{post.bites || 0}</Text>
      </View>
    </TouchableOpacity>
  );
});

// Detail Post Component
export const DetailPost = memo(({ 
  post, 
  currentImageIndex = 0,
  onBitePress,
  onDoubleTapLike,
  onUsernamePress,
  onOptionsPress,
  onImageScroll,
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [biteAnimations, setBiteAnimations] = useState({});
  const [previousBiteState, setPreviousBiteState] = useState(null);
  const hasUserBited = post.bitedBy?.includes(post.currentUserId) || false;

  // Effect to detect when bite state changes and trigger animation
  useEffect(() => {
    if (previousBiteState !== null && !previousBiteState && hasUserBited) {
      // User just added a bite (went from false to true)
      triggerBiteAnimation(post.id);
    }
    setPreviousBiteState(hasUserBited);
  }, [hasUserBited, post.id, triggerBiteAnimation]);

  const triggerBiteAnimation = useCallback((postId) => {
    // Create new animated value for this post - start visible immediately
    const animatedValue = new Animated.Value(1);
    
    setBiteAnimations(prev => ({
      ...prev,
      [postId]: animatedValue
    }));

    // Start animation sequence
    Animated.sequence([
      // Hold for 2 seconds (visible immediately)
      Animated.delay(2000),
      // Fade out
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Clean up animation after completion
      setBiteAnimations(prev => {
        const newAnimations = { ...prev };
        delete newAnimations[postId];
        return newAnimations;
      });
    });
  }, []);

  const handleDoubleTap = () => {
    // Trigger animation if user hasn't already bitten
    if (!hasUserBited) {
      triggerBiteAnimation(post.id);
    }
    onDoubleTapLike(post.id);
  };

  return (
    <View style={styles.postContainer}>
      <View style={styles.postHeader}>
        <View style={styles.headerContent}>
          <ScrollView 
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.usernameScrollContainer}
          >
            <View style={styles.usernameContainer}>
              {(post.owners || [{ id: post.userId, username: post.username || 'Unknown' }]).map((owner, index) => (
                <View key={`${post.id}-owner-${owner.id}-${index}`} style={styles.usernameWrapper}>
                  <TouchableOpacity onPress={() => onUsernamePress(owner.id)}>
                    <Text style={styles.username}>{owner.username}</Text>
                  </TouchableOpacity>
                  {index < (post.owners?.length || 1) - 1 && (
                    <Text style={styles.usernameSeparator}> • </Text>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
          {post.location && (
            <View style={styles.locationContainer}>
              <Ionicons name="location-outline" size={12} color={theme.textSecondary} />
              <Text style={styles.locationText}>{post.location.name}</Text>
            </View>
          )}
        </View>
        {(post.userId === post.currentUserId || post.postOwners?.includes(post.currentUserId)) && (
          <TouchableOpacity 
            style={styles.optionsButton}
            onPress={() => onOptionsPress(post)}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={theme.text} />
          </TouchableOpacity>
        )}
      </View>
      
      <TapGestureHandler
        numberOfTaps={2}
        onHandlerStateChange={(event) => {
          if (event.nativeEvent.state === State.ACTIVE) {
            handleDoubleTap();
          }
        }}
      >
        <View style={styles.imageGalleryContainer}>
          <FlatList
            data={post.imageUrls || [post.imageUrl]}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(url, index) => `${post.id}-image-${index}-${url}`}
            renderItem={({ item: imageUrl }) => (
              <Image 
                source={{ uri: imageUrl }} 
                style={styles.postImage}
                resizeMode="cover"
              />
            )}
            onScroll={(e) => onImageScroll(e, post.id)}
            scrollEventThrottle={16}
          />
          {(post.imageUrls?.length > 1 || false) && (
            <View style={styles.paginationDots}>
              {(post.imageUrls || []).map((_, index) => (
                <View
                  key={`${post.id}-dot-${index}`}
                  style={[
                    styles.paginationDot,
                    index === currentImageIndex && styles.paginationDotActive
                  ]}
                />
              ))}
            </View>
          )}
          
          {/* Bite Animation */}
          {biteAnimations[post.id] && (
            <Animated.Image
              source={biteAnimationImage}
              style={[
                styles.biteAnimation,
                {
                  opacity: biteAnimations[post.id],
                },
              ]}
            />
          )}
        </View>
      </TapGestureHandler>

      {/* Combined action bar with bread button (left) and date (right) */}
      <View style={styles.actionBar}>
        <View style={styles.leftActions}>
          <BreadButton postId={post.id} hasUserBited={hasUserBited} onPress={onBitePress} theme={theme} />
        </View>
        <View style={styles.rightActions}>
          <Text style={styles.postDate}>
            {post.createdAt?.toDate().toLocaleString() || ''}
          </Text>
        </View>
      </View>

      <View style={styles.biteCountContainer}>
        <Text style={styles.biteCountText}>
          {post.bites} {post.bites === 1 ? 'bite' : 'bites'}
        </Text>
      </View>

      <View style={styles.postFooter}>
        <Text style={styles.caption}>{post.caption}</Text>
      </View>
    </View>
  );
});

const getStyles = (theme) => StyleSheet.create({
  postContainer: {
    backgroundColor: theme.surface,
    marginBottom: 10
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12
  },
  headerContent: {
    flexDirection: 'column',
    flex: 1
  },
  usernameScrollContainer: {
    marginBottom: 4
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  usernameWrapper: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  username: {
    fontWeight: '600',
    fontSize: 14,
    color: theme.accent
  },
  usernameSeparator: {
    color: theme.textSecondary,
    marginHorizontal: 4
  },
  optionsButton: {
    padding: 8
  },
  imageGalleryContainer: {
    width: WINDOW_WIDTH,
    aspectRatio: 1,
    backgroundColor: theme.surfaceSecondary
  },
  postImage: {
    width: WINDOW_WIDTH,
    aspectRatio: 1,
    backgroundColor: theme.surfaceSecondary
  },
  paginationDots: {
    position: 'absolute',
    bottom: 10,
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center'
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 3
  },
  paginationDotActive: {
    backgroundColor: '#fff',
    width: 8,
    height: 8,
    borderRadius: 4
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  biteButton: {
    padding: 4
  },
  breadEmoji: {
    width: 38,
    height: 38
  },
  biteCountContainer: {
    paddingHorizontal: 12,
    marginBottom: 4
  },
  biteCountText: {
    fontWeight: '600',
    fontSize: 14,
    color: theme.text
  },
  postFooter: {
    padding: 12
  },
  caption: {
    fontSize: 14,
    marginBottom: 4,
    color: theme.text
  },
  postDate: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: -20
  },
  gridItem: {
    width: WINDOW_WIDTH / 3 - 2,
    aspectRatio: 1,
    margin: 1
  },
  gridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.surfaceSecondary
  },
  coOwnedBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(25, 118, 210, 0.8)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  multipleImagesBadge: {
    position: 'absolute',
    top: 5,
    right: 34,
    backgroundColor: 'rgba(25, 118, 210, 0.8)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  gridBiteCounter: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10
  },
  gridBreadEmoji: {
    width: 19,
    height: 19,
    marginRight: 2
  },
  gridBiteCount: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600'
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2
  },
  locationText: {
    fontSize: 12,
    color: theme.textSecondary,
    marginLeft: 4
  },
  biteAnimation: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 450,
    height: 450,
    opacity: 0.5,
  }
}); 