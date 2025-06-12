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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  loadingText: {
    fontSize: 16,
    color: theme.text,
    marginTop: 15,
    textAlign: 'center'
  },
  debugText: {
    fontSize: 11,
    color: '#fff',
    textAlign: 'center',
    fontFamily: 'monospace'
  },
  disabledButton: {
    opacity: 0.5
  },
  pressedBread: {
    transform: [{ scale: 0.95 }]
  },
  debugOverlay: {
    position: 'absolute',
    bottom: 50,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 8,
    zIndex: 1000
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

// Memoized BreadButton component with instant visual feedback
const BreadButton = React.memo(({ postId, hasUserBited, onPress, theme, disabled = false }) => {
  const styles = getStyles(theme);
  const [isPressed, setIsPressed] = useState(false);
  
  const handlePress = useCallback(() => {
    if (disabled) return;
    
    // Instant visual feedback
    setIsPressed(true);
    onPress(postId);
    
    // Reset pressed state
    setTimeout(() => setIsPressed(false), 150);
  }, [postId, onPress, disabled]);
  
  return (
    <TouchableOpacity 
      style={[styles.biteButton, disabled && styles.disabledButton]}
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <Image 
        source={hasUserBited ? breadBitten : breadNormal}
        style={[
          styles.breadEmoji,
          isPressed && styles.pressedBread
        ]}
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
  
  // Readiness tracking - only render posts when everything is ready
  const [systemsReady, setSystemsReady] = useState({
    breadImages: false,
    catFunctions: false,
    postsLoaded: false,
    biteAnimationImage: false
  });
  
  const allSystemsReady = Object.values(systemsReady).every(ready => ready);

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
      
      // Immediate preloading - no delays
      const priorityPosts = newPosts.slice(0, 3); // Load first 3 immediately
      priorityPosts.forEach(post => {
        if (post.imageUrls?.[0]) {
          Image.prefetch(post.imageUrls[0]).catch(() => {});
        } else if (post.imageUrl) {
          Image.prefetch(post.imageUrl).catch(() => {});
        }
      });

      // Background preload remaining after shorter delay
      setTimeout(() => {
        const remainingPosts = newPosts.slice(3);
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
      }, 200); // Much shorter delay

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

  // Check bread images readiness - actually preload them
  useEffect(() => {
    const preloadBreadImages = async () => {
      try {
        const breadNormalSource = Image.resolveAssetSource(breadNormal);
        const breadBittenSource = Image.resolveAssetSource(breadBitten);
        
        // Actually preload the images into memory
        await Promise.all([
          Image.prefetch(breadNormalSource.uri),
          Image.prefetch(breadBittenSource.uri),
          Image.prefetch(Image.resolveAssetSource(biteAnimationImage).uri)
        ]);
        
        // Longer delay to ensure images are truly in memory and ready
        setTimeout(() => {
          setSystemsReady(prev => ({ 
            ...prev, 
            breadImages: true,
            biteAnimationImage: true 
          }));
        }, 300); // Increased delay for true readiness
      } catch (error) {
        console.warn('Bread images failed to preload:', error);
        // Still mark as ready to not block the UI
        setSystemsReady(prev => ({ 
          ...prev, 
          breadImages: true,
          biteAnimationImage: true 
        }));
      }
    };
    
    preloadBreadImages();
  }, []);
  
  // Check cat functions readiness with additional verification
  useEffect(() => {
    if (triggerCatEating && getCatPosition) {
      // Test that cat functions actually work before marking ready
      setTimeout(() => {
        try {
          // Test getCatPosition function
          getCatPosition().then(() => {
            setSystemsReady(prev => ({ ...prev, catFunctions: true }));
          }).catch(() => {
            // Still mark as ready to not block forever
            setSystemsReady(prev => ({ ...prev, catFunctions: true }));
          });
        } catch (error) {
          // Still mark as ready to not block forever
          setSystemsReady(prev => ({ ...prev, catFunctions: true }));
        }
      }, 200); // Small delay to ensure cat context is fully initialized
    }
  }, [triggerCatEating, getCatPosition]);

  useEffect(() => {
    // Only initialize when critical systems are ready
    if (systemsReady.breadImages && systemsReady.catFunctions) {
      loadInitialPosts();
    }
  }, [systemsReady.breadImages, systemsReady.catFunctions]);

  const preloadPostImages = async (posts) => {
    if (!posts || posts.length === 0) return;
    
    // Extract all image URLs from posts
    const imageUrls = posts.flatMap(post => 
      post.imageUrls || [post.imageUrl]
    ).filter(Boolean);
    
    // Preload all images in parallel
    const imagePromises = imageUrls.map(url => 
      new Promise((resolve) => {
        Image.prefetch(url)
          .then(() => resolve())
          .catch(() => resolve()); // Don't fail if one image fails
      })
    );
    
    // Wait for all images to preload (or timeout after 5 seconds)
    await Promise.race([
      Promise.all(imagePromises),
      new Promise(resolve => setTimeout(resolve, 5000))
    ]);
  };

  const loadInitialPosts = async () => {
    setLoading(true);
    
    try {
      // Fetch posts first
      const initialPosts = await fetchPosts();
      
      // Preload all post images before showing posts
      await preloadPostImages(initialPosts);
      
      // Only set posts after images are preloaded
      setPosts(initialPosts);
      
      // Mark systems as ready
      setTimeout(() => {
        setSystemsReady(prev => ({ ...prev, postsLoaded: true }));
        // Only stop loading after everything is truly ready
        setTimeout(() => {
          setLoading(false);
        }, 200); // Extra buffer to ensure smooth transition
      }, 100); // Reduced delay since images are already loaded
    } catch (error) {
      console.error('Error loading initial posts:', error);
      setPosts([]); // Set empty array to allow animations to work
      // Even on error, mark as loaded so UI doesn't hang
      setTimeout(() => {
        setSystemsReady(prev => ({ ...prev, postsLoaded: true }));
        setLoading(false);
      }, 300);
    }
  };

  const loadMorePosts = async () => {
    if (loadingMore || !hasMorePosts) return;

    setLoadingMore(true);
    const morePosts = await fetchPosts(posts[posts.length - 1]);
    setPosts(prev => [...prev, ...morePosts]);
    setLoadingMore(false);
  };

  const handleRefresh = async () => {
    if (!allSystemsReady) return; // Don't allow refresh until systems are ready
    
    setRefreshing(true);
    const refreshedPosts = await fetchPosts();
    setPosts(refreshedPosts);
    setRefreshing(false);
  };

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

  // Main feed bite handler with cat animation - with optimistic updates
  const handleBitePress = useCallback(async (postId) => {
    if (!allSystemsReady) return; // Safety check
    
    // Check if user has already bitten this post
    const post = posts.find(p => p.id === postId);
    const currentlyBited = post?.bitedBy?.includes(auth.currentUser.uid) || false;
    
    // IMMEDIATE optimistic update for instant UI response
    updatePostOptimistic(postId, (post) => ({
      ...post,
      bites: !currentlyBited ? (post.bites || 0) + 1 : Math.max(0, (post.bites || 0) - 1),
      bitedBy: !currentlyBited 
        ? [...(post.bitedBy || []), auth.currentUser.uid]
        : (post.bitedBy || []).filter(id => id !== auth.currentUser.uid)
    }));
    
    // Only trigger cat animations when ADDING a bite - non-blocking
    if (!currentlyBited) {
      // Trigger immediately without waiting
      triggerCatEating();
      // Trigger bite animation without awaiting
      triggerBiteAnimation(postId).catch(() => {}); // Catch any errors silently
    }
    
    // Background server update - don't block UI
    try {
      const hasUserBited = await postService.toggleBite(postId);
      
      // Update with server response (in case of discrepancy)
      updatePostOptimistic(postId, (post) => ({
        ...post,
        bites: hasUserBited ? (post.bites || 0) : Math.max(0, (post.bites || 1) - 1),
        bitedBy: hasUserBited 
          ? [...(post.bitedBy || []).filter(id => id !== auth.currentUser.uid), auth.currentUser.uid]
          : (post.bitedBy || []).filter(id => id !== auth.currentUser.uid)
      }));
    } catch (error) {
      console.error('Error toggling bite, reverting:', error);
      // Revert optimistic update on error
      updatePostOptimistic(postId, (post) => ({
        ...post,
        bites: currentlyBited ? (post.bites || 0) + 1 : Math.max(0, (post.bites || 0) - 1),
        bitedBy: currentlyBited 
          ? [...(post.bitedBy || []), auth.currentUser.uid]
          : (post.bitedBy || []).filter(id => id !== auth.currentUser.uid)
      }));
    }
  }, [posts, updatePostOptimistic, triggerCatEating, triggerBiteAnimation, allSystemsReady]);

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

    // Don't create bite animation until we have accurate positions
    const biteMarkSize = 450;

    // Calculate actual positions first - no estimated positioning
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

      // Calculate positions from actual measurements
      const actualStartX = Math.min(
        imagePosition.x + imagePosition.width - 50,
        WINDOW_WIDTH - biteMarkSize
      );
      const actualStartY = imagePosition.y;

      // Only NOW create the animation object with accurate positions
      const animationObject = {
        opacity: new Animated.Value(0.8), // Start visible since we have accurate position
        translateX: new Animated.Value(0),
        translateY: new Animated.Value(0),
        scale: new Animated.Value(1),
        startX: actualStartX,
        startY: actualStartY,
      };
      
      // Add to animations with accurate positions
      setBiteAnimations(prev => ({
        ...prev,
        [postId]: animationObject
      }));

      // Calculate trajectory from actual starting position to cat
      const targetX = catPosition.x - (actualStartX + biteMarkSize / 2);
      const targetY = (catPosition.y + 5) - (actualStartY + biteMarkSize / 2);

      // Start the movement animation after the linger period
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(animationObject.opacity, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(animationObject.translateX, {
            toValue: targetX,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(animationObject.translateY, {
            toValue: targetY,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(animationObject.scale, {
            toValue: 0.02,
            duration: 500,
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
      }, 500); // Linger for 0.5 seconds

    } catch (error) {
      // If position calculation fails, don't show the bite mark at all
      console.warn('Position calculation failed, skipping bite animation:', error);
      
      // Clean up the animation object since we won't use it
      setBiteAnimations(prev => {
        const newAnimations = { ...prev };
        delete newAnimations[postId];
        return newAnimations;
      });
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header stays persistent - never unmounts */}
      <Header />
      
      {/* Conditional content below header */}
      {(loading || !allSystemsReady || posts.length === 0) ? (
        // Skeleton loading state
        <>
          <FlatList
            data={[1, 2, 3, 4, 5]} // Show more skeleton loaders for longer loading
            renderItem={() => <PostSkeleton />}
            keyExtractor={(_, index) => `skeleton-${index}`}
          />
          {/* Debug overlay - remove in production */}
          <View style={styles.debugOverlay}>
            <Text style={styles.debugText}>
              Loading: {loading ? '⏳' : '✓'} | 
              Bread: {systemsReady.breadImages ? '✓' : '⏳'} | 
              Cat: {systemsReady.catFunctions ? '✓' : '⏳'} | 
              Posts: {systemsReady.postsLoaded ? '✓' : '⏳'} | 
              Bite: {systemsReady.biteAnimationImage ? '✓' : '⏳'} |
              HasPosts: {posts.length > 0 ? '✓' : '⏳'} |
              Images: Preloaded
            </Text>
          </View>
        </>
      ) : (
        // Main content state
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
      )}
      
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
