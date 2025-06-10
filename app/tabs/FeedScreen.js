// app/FeedScreen.js

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  InteractionManager,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { PinchGestureHandler, State, TapGestureHandler } from 'react-native-gesture-handler';
import { auth } from '../../firebase';
import Cat from '../components/Cat';
import PostManagement from '../components/PostManagement';
import { PostSkeleton } from '../components/ui/SkeletonLoader';
import { useCat } from '../contexts/CatContext';
import { useTheme } from '../contexts/ThemeContext';
import * as postService from '../services/postService';
import { handleDeletePost as deletePostUtil } from '../utils/postOptionsUtils';

const POSTS_PER_PAGE = 5;
const WINDOW_WIDTH = Dimensions.get('window').width;

// Import bread slice images and preload them
const breadNormal = require('../../assets/images/bread-normal.png');
const breadBitten = require('../../assets/images/bread-bitten.png');
const biteAnimationImage = require('../../assets/images/bite-animation.png');

// Images are now preloaded in _layout.js to avoid redundant prefetching

// Define styles function before component
const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background
  },
  contentContainer: {
    paddingBottom: 20
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.surface,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text
  },
  viewModeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: theme.surfaceSecondary
  },
  postContainer: {
    marginBottom: 15,
    backgroundColor: theme.surface,
    width: '100%'
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border
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
    fontSize: 14,
    fontWeight: '500',
    color: theme.accent
  },
  usernameSeparator: {
    fontSize: 14,
    color: theme.textSecondary
  },
  imageGalleryContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    backgroundColor: theme.surfaceSecondary
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  biteButton: {
    padding: 4,
  },
  breadEmoji: {
    width: 38,
    height: 38,
  },
  biteCountContainer: {
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  biteCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  paginationDots: {
    position: 'absolute',
    bottom: 10,
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 3,
  },
  paginationDotActive: {
    backgroundColor: '#fff',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  postImage: {
    width: Dimensions.get('window').width,
    aspectRatio: 1,
    backgroundColor: theme.surfaceSecondary
  },
  postFooter: {
    padding: 12
  },
  caption: {
    fontSize: 14,
    marginBottom: 5,
    color: theme.text
  },
  postDate: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: -20
  },
  gridItem: {
    width: Dimensions.get('window').width / 3 - 2,
    aspectRatio: 1,
    margin: 1,
    position: 'relative'
  },
  gridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.surfaceSecondary
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
    borderRadius: 10,
  },
  gridBreadEmoji: {
    width: 19,
    height: 19,
    marginRight: 2,
  },
  gridBiteCount: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
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
  optionsButton: {
    padding: 8
  },
  loadingMore: {
    paddingVertical: 16,
    alignItems: 'center'
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 16,
    color: theme.textSecondary
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
  },
  biteMarkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  globalBiteAnimation: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 450,
    height: 450,
    zIndex: 1000, // Ensure it renders above everything
  },
});

// Memoized BreadButton component to prevent unnecessary re-renders
const BreadButton = React.memo(({ postId, hasUserBited, onPress, theme }) => {
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
        fadeDuration={0} // Disable fade animation for faster updates
      />
    </TouchableOpacity>
  );
});

const FeedScreen = forwardRef((props, ref) => {
  const { theme } = useTheme();
  const { triggerCatEating, getCatPosition } = useCat();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [lastVisible, setLastVisible] = useState(null);
  const [viewMode, setViewMode] = useState('detail'); // 'detail' or 'grid'
  const [currentImageIndices, setCurrentImageIndices] = useState({}); // Track current image index for each post
  const [biteAnimations, setBiteAnimations] = useState({});
  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostOptions, setShowPostOptions] = useState(false);
  const router = useRouter();
  const flatListRef = useRef(null);
  const [scale, setScale] = useState(1);
  const pinchRef = useRef();
  const biteMarkRefs = useRef({});
  const postImageRefs = useRef({}); // Add refs for post images

  // Expose scrollToTop function to parent component
  useImperativeHandle(ref, () => ({
    scrollToTop: () => {
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      }
    }
  }), []);

  const fetchPosts = async (lastPost = null) => {
    try {
      const newPosts = await postService.fetchPosts(null, lastPost, POSTS_PER_PAGE);
      
      // Instagram-style intelligent preloading
      InteractionManager.runAfterInteractions(() => {
        // Immediately preload first 2 post images for instant display
        const priorityPosts = newPosts.slice(0, 2);
        priorityPosts.forEach(post => {
          if (post.imageUrls?.[0]) {
            Image.prefetch(post.imageUrls[0]).catch(() => {});
          } else if (post.imageUrl) {
            Image.prefetch(post.imageUrl).catch(() => {});
          }
        });

        // Delay preload remaining images to avoid blocking
        setTimeout(() => {
          const remainingPosts = newPosts.slice(2);
          remainingPosts.forEach(post => {
            // Pre-fetch post images in background
            if (post.imageUrls) {
              post.imageUrls.forEach(url => Image.prefetch(url).catch(() => {}));
            } else if (post.imageUrl) {
              Image.prefetch(post.imageUrl).catch(() => {});
            }

            // Pre-fetch user profile pictures in background
            if (post.postOwners) {
              post.postOwners.forEach(owner => {
                if (owner.profilePicUrl) {
                  Image.prefetch(owner.profilePicUrl).catch(() => {});
                }
              });
            }
          });
        }, 1000);
      });

      // Update pagination state
      setHasMorePosts(newPosts.length === POSTS_PER_PAGE);
      if (newPosts.length > 0) {
        setLastVisible(newPosts[newPosts.length - 1]);
      }

      return newPosts;
    } catch (error) {
      console.error('Error fetching posts:', error);
      return [];
    }
  };

  const loadInitialPosts = async () => {
    setLoading(true);
    const initialPosts = await fetchPosts();
    setPosts(initialPosts);
    setLoading(false);
  };

  const loadMorePosts = async () => {
    if (loadingMore || !hasMorePosts) return;

    setLoadingMore(true);
    const morePosts = await fetchPosts(posts[posts.length - 1]);
    setPosts(prev => [...prev, ...morePosts]);
    setLoadingMore(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const refreshedPosts = await fetchPosts();
    setPosts(refreshedPosts);
    setRefreshing(false);
  };

  useEffect(() => {
    // Defer initial loading until after the component is mounted and UI is responsive
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        loadInitialPosts();
      }, 100); // Small delay to ensure smooth startup
    });
  }, []);

  const updatePostOptimistic = useCallback((postId, updateFn) => {
    setPosts(prevPosts => {
      const postIndex = prevPosts.findIndex(post => post.id === postId);
      if (postIndex === -1) return prevPosts;
      
      const currentPost = prevPosts[postIndex];
      const updatedPost = updateFn(currentPost);
      
      if (updatedPost === currentPost) return prevPosts;
      
      const newPosts = [...prevPosts];
      newPosts[postIndex] = updatedPost;
      return newPosts;
    });
  }, []);

  // Main feed bite handler with cat animation
  const handleBitePress = useCallback(async (postId) => {
    // Check if user has already bitten this post
    const post = posts.find(p => p.id === postId);
    const currentlyBited = post?.bitedBy?.includes(auth.currentUser.uid) || false;
    
    // Only trigger cat animations when ADDING a bite (not removing) - MAIN FEED ONLY
    if (!currentlyBited) {
      triggerCatEating();
      triggerBiteAnimation(postId);
    }
    
    try {
      const hasUserBited = await postService.toggleBite(postId);
      
      updatePostOptimistic(postId, (post) => ({
        ...post,
        bites: hasUserBited ? (post.bites || 0) + 1 : Math.max(0, (post.bites || 0) - 1),
        bitedBy: hasUserBited 
          ? [...(post.bitedBy || []), auth.currentUser.uid]
          : (post.bitedBy || []).filter(id => id !== auth.currentUser.uid)
      }));
    } catch (error) {
      console.error('Error toggling bite:', error);
    }
  }, [posts, updatePostOptimistic, triggerCatEating, triggerBiteAnimation]);

  const handleDoubleTapLike = useCallback(async (postId) => {
    const post = posts.find(p => p.id === postId);
    if (!post || post.bitedBy?.includes(auth.currentUser.uid)) return;

    // Trigger bite animation
    triggerBiteAnimation(postId);
    
    // Trigger cat eating
    triggerCatEating();

    try {
      await postService.toggleBite(postId);
      updatePostOptimistic(postId, (post) => ({
        ...post,
        bites: (post.bites || 0) + 1,
        bitedBy: [...(post.bitedBy || []), auth.currentUser.uid]
      }));
    } catch (error) {
      console.error('Error handling double tap like:', error);
    }
  }, [posts, updatePostOptimistic, triggerBiteAnimation, triggerCatEating]);

  const handleImageScroll = useCallback((event, postId) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const imageIndex = Math.round(contentOffset / WINDOW_WIDTH);
    setCurrentImageIndices(prev => ({
      ...prev,
      [postId]: imageIndex
    }));
  }, []);

  const triggerBiteAnimation = useCallback(async (postId) => {
    // Early return if animation system isn't ready
    if (!getCatPosition || !postImageRefs.current) return;

    // First, find the post to get its image position
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    // Get the current image index for this post (or default to 0)
    const currentImageIndex = currentImageIndices[postId] || 0;
    const imageRef = postImageRefs.current[`${postId}-${currentImageIndex}`];
    
    if (!imageRef) {
      console.warn('Post image ref not found for post:', postId);
      return;
    }

    // IMMEDIATELY show the bite mark with estimated position
    const biteMarkSize = 450;
    const estimatedStartX = Math.min(WINDOW_WIDTH - 100, WINDOW_WIDTH - biteMarkSize);
    const estimatedStartY = 100; // Rough estimate for header height

    // Create animated values and show immediately
    const animationObject = {
      opacity: new Animated.Value(0.8), // Start visible immediately
      translateX: new Animated.Value(0),
      translateY: new Animated.Value(0),
      scale: new Animated.Value(1),
      startX: estimatedStartX,
      startY: estimatedStartY,
    };
    
    // Show the bite mark immediately
    setBiteAnimations(prev => ({
      ...prev,
      [postId]: animationObject
    }));

    // Calculate actual positions in the background while bite mark is visible
    try {
      const [imagePosition, catPosition] = await Promise.race([
        Promise.all([
          new Promise(resolve => {
            imageRef.measureInWindow((x, y, width, height) => {
              resolve({ x, y, width, height });
            });
          }),
          getCatPosition()
        ]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 500))
      ]);

      // Update position if we got accurate measurements
      const actualStartX = Math.min(
        imagePosition.x + imagePosition.width - 50,
        WINDOW_WIDTH - biteMarkSize
      );
      const actualStartY = imagePosition.y;

      // Update the animation object with accurate positions
      animationObject.startX = actualStartX;
      animationObject.startY = actualStartY;

      // Calculate trajectory from actual starting position to cat
      const targetX = catPosition.x - (actualStartX + biteMarkSize / 2);
      const targetY = (catPosition.y + 5) - (actualStartY + biteMarkSize / 2);

      // Start the movement animation after the linger period
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(animationObject.opacity, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(animationObject.translateX, {
            toValue: targetX,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(animationObject.translateY, {
            toValue: targetY,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(animationObject.scale, {
            toValue: 0.02,
            duration: 800,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Final fade out
          Animated.timing(animationObject.opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            // Clean up animation after completion
            setBiteAnimations(prev => {
              const newAnimations = { ...prev };
              delete newAnimations[postId];
              return newAnimations;
            });
          });
        });
      }, 1000); // Linger for 1 second

    } catch (error) {
      // If position calculation fails, still do the animation with estimated positions
      console.warn('Position calculation failed, using estimates:', error);
      
      // Use estimated target (center-ish of screen for cat)
      const estimatedTargetX = (WINDOW_WIDTH / 2) - (estimatedStartX + biteMarkSize / 2);
      const estimatedTargetY = 50 - (estimatedStartY + biteMarkSize / 2);

      setTimeout(() => {
        Animated.parallel([
          Animated.timing(animationObject.opacity, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(animationObject.translateX, {
            toValue: estimatedTargetX,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(animationObject.translateY, {
            toValue: estimatedTargetY,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(animationObject.scale, {
            toValue: 0.02,
            duration: 800,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Final fade out
          Animated.timing(animationObject.opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            // Clean up animation after completion
            setBiteAnimations(prev => {
              const newAnimations = { ...prev };
              delete newAnimations[postId];
              return newAnimations;
            });
          });
        });
      }, 1000); // Linger for 1 second
    }
  }, [getCatPosition, posts, currentImageIndices]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  // Memoize toggleViewMode
  const toggleViewMode = useCallback(() => {
    setViewMode(prev => prev === 'detail' ? 'grid' : 'detail');
  }, []);

  const handleUsernamePress = (userId) => {
    router.push({
      pathname: '/FriendProfile',
      params: { userId }
    });
  };

  const handlePostOptionsPress = (post) => {
    setSelectedPost(post);
    setShowPostOptions(true);
  };

  const handleUpdatePost = (updatedPost) => {
    setPosts(prevPosts => prevPosts.map(post => 
      post.id === updatedPost.id ? updatedPost : post
    ));
  };

  const handleDeletePost = async (post) => {
    await deletePostUtil(post, (postId) => {
      setPosts(currentPosts => currentPosts.filter(p => p.id !== postId));
    });
  };

  const renderDetailPost = useCallback(({ item }) => {
    const userId = auth.currentUser.uid;
    const hasUserBited = item.bitedBy?.includes(userId) || false;

    const handleDoubleTap = () => {
      // Handle the like logic
      handleDoubleTapLike(item.id);
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
                {(item.postOwners || [{ id: item.userId, username: item.username || 'Unknown' }]).map((owner, index) => (
                  <View key={`${item.id}-owner-${owner.id}-${index}`} style={styles.usernameWrapper}>
                    <TouchableOpacity onPress={() => handleUsernamePress(owner.id)}>
                      <Text style={styles.username}>{owner.username}</Text>
                    </TouchableOpacity>
                    {index < (item.postOwners?.length || 1) - 1 && (
                      <Text style={styles.usernameSeparator}> • </Text>
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>
            {item.location && (
              <View style={styles.locationContainer}>
                <Ionicons name="location-outline" size={12} color="#666" />
                <Text style={styles.locationText}>{item.location.name}</Text>
              </View>
            )}
          </View>
          {(item.userId === auth.currentUser.uid || item.postOwners?.some(owner => owner.id === auth.currentUser.uid)) && (
            <TouchableOpacity 
              style={styles.optionsButton}
              onPress={() => handlePostOptionsPress(item)}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={theme.text} />
            </TouchableOpacity>
          )}
        </View>
        
        <TapGestureHandler
          onHandlerStateChange={({ nativeEvent }) => {
            if (nativeEvent.state === State.ACTIVE) {
              handleDoubleTap();
            }
          }}
          numberOfTaps={2}
        >
          <View style={styles.imageGalleryContainer}>
            <FlatList
              data={item.imageUrls || [item.imageUrl]}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(url, index) => `${item.id}-image-${index}-${url}`}
              renderItem={({ item: imageUrl, index }) => (
                <Image 
                  ref={(ref) => {
                    if (ref) {
                      postImageRefs.current[`${item.id}-${index}`] = ref;
                    }
                  }}
                  source={{ uri: imageUrl }} 
                  style={styles.postImage}
                  resizeMode="cover"
                />
              )}
              onScroll={(event) => handleImageScroll(event, item.id)}
              scrollEventThrottle={16}
            />
            {(item.imageUrls?.length > 1 || (item.imageUrl && item.imageUrls?.length !== 1)) && (
              <View style={styles.paginationDots}>
                {(item.imageUrls || [item.imageUrl]).map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.paginationDot,
                      currentImageIndices[item.id] === index && styles.paginationDotActive
                    ]}
                  />
                ))}
              </View>
            )}
            

          </View>
        </TapGestureHandler>

        {/* Combined action bar with bread button (left) and date (right) */}
        <View style={styles.actionBar}>
          <View style={styles.leftActions}>
            <BreadButton
              postId={item.id}
              hasUserBited={hasUserBited}
              onPress={handleBitePress}
              theme={theme}
            />
          </View>
          <View style={styles.rightActions}>
            <Text style={styles.postDate}>
              {item.createdAt?.toDate().toLocaleString() || ''}
            </Text>
          </View>
        </View>

        {/* Bite count */}
        <View style={styles.biteCountContainer}>
          <Text style={styles.biteCountText}>
            {item.bites || 0} {item.bites === 1 ? 'bite' : 'bites'}
          </Text>
        </View>

        <View style={styles.postFooter}>
          <Text style={styles.caption}>{item.caption}</Text>
        </View>
      </View>
    );
  }, [handleBitePress, handleDoubleTapLike, handleUsernamePress, handleImageScroll, currentImageIndices]);

  const renderGridPost = ({ item, index }) => {
    const userId = auth.currentUser.uid;
    const hasUserBited = item.bitedBy?.includes(userId) || false;

    const handleGridPostPress = () => {
      setViewMode('detail');
      // Wait for view mode change to take effect and list to re-render
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0
        });
      }, 100);
    };

    return (
      <TouchableOpacity 
        style={styles.gridItem}
        onPress={handleGridPostPress}
      >
        <Image 
          source={{ uri: item.imageUrls?.[0] || item.imageUrl }} 
          style={styles.gridImage} 
        />
        {item.owners?.length > 1 && (
          <View style={styles.coOwnedBadge}>
            <Ionicons name="people" size={12} color="white" />
          </View>
        )}
        {item.imageUrls?.length > 1 && (
          <View style={styles.multipleImagesBadge}>
            <Ionicons name="images" size={12} color="white" />
          </View>
        )}
        {/* Bite indicator for grid view */}
        <View style={styles.gridBiteCounter}>
          <Image 
            source={hasUserBited ? breadBitten : breadNormal}
            style={styles.gridBreadEmoji}
          />
          <Text style={styles.gridBiteCount}>{item.bites}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Add getItemLayout for more accurate scrolling
  const getItemLayout = useCallback((data, index) => ({
    length: viewMode === 'grid' ? WINDOW_WIDTH / 3 : 550, // Adjust 550 based on your post height
    offset: viewMode === 'grid' 
      ? Math.floor(index / 3) * (WINDOW_WIDTH / 3)
      : index * 550,
    index,
  }), [viewMode]);

  const Header = useCallback(() => (
    <View style={styles.header}>
      <Cat />
      <TouchableOpacity onPress={toggleViewMode} style={styles.viewModeButton}>
        <Ionicons 
          name={viewMode === 'detail' ? 'grid-outline' : 'list-outline'} 
          size={24} 
          color={theme.accent} 
        />
      </TouchableOpacity>
    </View>
  ), [viewMode, styles, theme.accent, toggleViewMode]);

  const onPinchGestureEvent = useCallback(({ nativeEvent }) => {
    setScale(nativeEvent.scale);
  }, []);

  const onPinchHandlerStateChange = useCallback(({ nativeEvent }) => {
    if (nativeEvent.oldState === State.ACTIVE) {
      // If scale is less than 0.7 (pinched out), switch to grid view
      if (scale < 0.7 && viewMode === 'detail') {
        setViewMode('grid');
      }
      // If scale is more than 1.3 (pinched in), switch to detail view
      else if (scale > 1.3 && viewMode === 'grid') {
        setViewMode('detail');
      }
      // Reset scale
      setScale(1);
    }
  }, [scale, viewMode]);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <FlatList
          data={[1, 2, 3]} // Show 3 skeleton loaders
          renderItem={() => <PostSkeleton />}
          keyExtractor={(_, index) => `skeleton-${index}`}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <PinchGestureHandler
        ref={pinchRef}
        onGestureEvent={onPinchGestureEvent}
        onHandlerStateChange={onPinchHandlerStateChange}
      >
        <View style={styles.container}>
          <ScrollView
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.accent}
              />
            }
            contentContainerStyle={{ flex: 1 }}
          >
            <Header />
            <View style={{ flex: 1 }}>
              <FlatList
                ref={flatListRef}
                data={posts}
                renderItem={viewMode === 'detail' ? renderDetailPost : renderGridPost}
                keyExtractor={item => item.id ? `post-${item.id}` : `generated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`}
                numColumns={viewMode === 'grid' ? 3 : 1}
                key={viewMode}
                contentContainerStyle={styles.contentContainer}
                onEndReached={loadMorePosts}
                onEndReachedThreshold={0.5}
                getItemLayout={getItemLayout}
                onScrollToIndexFailed={info => {
                  const wait = new Promise(resolve => setTimeout(resolve, 100));
                  wait.then(() => {
                    flatListRef.current?.scrollToIndex({
                      index: info.index,
                      animated: true,
                      viewPosition: 0
                    });
                  });
                }}
                ListFooterComponent={
                  loadingMore ? (
                    <View style={styles.loadingMore}>
                      <ActivityIndicator color={theme.accent} />
                    </View>
                  ) : null
                }
                ListEmptyComponent={
                  !loading && (
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>No posts yet</Text>
                    </View>
                  )
                }
              />
            </View>
          </ScrollView>
          <PostManagement
            selectedPost={selectedPost}
            onClose={() => {
              setSelectedPost(null);
              setShowPostOptions(false);
            }}
            onUpdatePost={handleUpdatePost}
            showPostOptions={showPostOptions}
            setShowPostOptions={setShowPostOptions}
            onDeletePost={handleDeletePost}
          />
        </View>
      </PinchGestureHandler>
      
      {/* Global Bite Mark Animations - render over everything */}
      {Object.entries(biteAnimations).map(([postId, animation]) => (
        <Animated.View
          key={`bite-${postId}`}
          style={[
            styles.globalBiteAnimation,
            {
              opacity: animation.opacity,
              left: animation.startX,
              top: animation.startY,
              transform: [
                { translateX: animation.translateX },
                { translateY: animation.translateY },
                { scale: animation.scale },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <Animated.Image
            ref={(ref) => {
              if (ref) {
                biteMarkRefs.current[postId] = ref;
              }
            }}
            source={biteAnimationImage}
            style={{
              width: '100%',
              height: '100%',
            }}
            resizeMode="contain"
          />
        </Animated.View>
      ))}
    </SafeAreaView>
  );
});

export default FeedScreen;
