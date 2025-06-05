// app/FeedScreen.js

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
    arrayRemove,
    arrayUnion,
    collection,
    doc,
    getDoc,
    getDocs,
    increment,
    orderBy,
    query,
    updateDoc
} from 'firebase/firestore';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    RefreshControl,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { State, TapGestureHandler } from 'react-native-gesture-handler';
import { auth, db } from '../../firebase';

// Import bread slice images and preload them
const breadNormal = require('../../assets/images/bread-normal.png');
const breadBitten = require('../../assets/images/bread-bitten.png');
const biteAnimation = require('../../assets/images/bite-animation.png');

// Preload images on app start
Image.prefetch(Image.resolveAssetSource(breadNormal).uri);
Image.prefetch(Image.resolveAssetSource(breadBitten).uri);

// Memoized BreadButton component to prevent unnecessary re-renders
const BreadButton = React.memo(({ postId, hasUserBited, onPress }) => (
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
));

const FeedScreen = forwardRef((props, ref) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('detail'); // 'detail' or 'grid'
  const [currentImageIndices, setCurrentImageIndices] = useState({}); // Track current image index for each post
  const router = useRouter();
  const flatListRef = useRef(null);

  // Expose scrollToTop function to parent component
  useImperativeHandle(ref, () => ({
    scrollToTop: () => {
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      }
    }
  }), []);

  const fetchPosts = async () => {
    try {
      // Get current user's friends first
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (!userDoc.exists()) {
        console.error('User profile not found');
        return;
      }

      const friends = userDoc.data().friends || [];
      const relevantUserIds = [auth.currentUser.uid, ...friends];

      // Get all posts and filter client-side
      const postsQuery = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(postsQuery);
      const allPosts = await Promise.all(snapshot.docs.map(async docSnapshot => {
        const data = docSnapshot.data();
        
        // Handle old format posts by creating owners array
        let owners = [];
        if (data.postOwners && data.postOwners.length > 0) {
          // New format - fetch usernames for any unknown owners
          const ownerPromises = data.postOwners.map(async (ownerId) => {
            if (!ownerId) return { id: 'unknown', username: 'Unknown' };
            
            // If we already have the owner data, use it
            const existingOwner = data.owners?.find(o => o.id === ownerId);
            if (existingOwner && existingOwner.username !== 'Unknown') {
              return existingOwner;
            }
            
            // Otherwise fetch the user data
            try {
              const userRef = doc(db, 'users', ownerId);
              const userDoc = await getDoc(userRef);
              if (userDoc.exists()) {
                return { id: ownerId, username: userDoc.data().username };
              }
            } catch (error) {
              console.error('Error fetching owner data:', error);
            }
            return { id: ownerId, username: 'Unknown' };
          });
          owners = await Promise.all(ownerPromises);
        } else {
          // Old format - fetch username for creator
          try {
            // Check if we have a valid userId
            if (!data.userId) {
              owners = [{ id: 'unknown', username: 'Unknown' }];
            } else {
              const userRef = doc(db, 'users', data.userId);
              const userDoc = await getDoc(userRef);
              if (userDoc.exists()) {
                owners = [{ id: data.userId, username: userDoc.data().username }];
              } else {
                owners = [{ id: data.userId, username: data.username || 'Unknown' }];
              }
            }
          } catch (error) {
            console.error('Error fetching creator data:', error);
            owners = [{ id: data.userId || 'unknown', username: data.username || 'Unknown' }];
          }
        }
        
        return {
          id: docSnapshot.id || `generated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          owners: owners,
          // Ensure like state is always properly initialized
          bitedBy: Array.isArray(data.bitedBy) ? data.bitedBy : [],
          bites: typeof data.bites === 'number' ? data.bites : 0
        };
      }));

      // Filter posts that are relevant to the user (created by friends or self)
      const filteredPosts = await Promise.all(allPosts.map(async post => {
        // Check new format (postOwners)
        const isRelevantPostOwner = post.postOwners?.some(ownerId => 
          relevantUserIds.includes(ownerId)
        );

        // Check old format (taggedFriends and original poster)
        const isRelevantTagged = post.taggedFriendIds?.some(taggedId => 
          relevantUserIds.includes(taggedId)
        );
        const isRelevantCreator = relevantUserIds.includes(post.userId);

        const isRelevant = isRelevantPostOwner || isRelevantTagged || isRelevantCreator;

        return isRelevant ? post : null;
      }));

      setPosts(filteredPosts.filter(post => post !== null));
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePostOptimistic = useCallback((postId, updateFn) => {
    setPosts(prevPosts => {
      // Find the index once
      const postIndex = prevPosts.findIndex(post => post.id === postId);
      if (postIndex === -1) return prevPosts;
      
      const currentPost = prevPosts[postIndex];
      const updatedPost = updateFn(currentPost);
      
      // Only update if there's actually a change
      if (updatedPost === currentPost) return prevPosts;
      
      // Create new array with minimal changes
      const newPosts = [...prevPosts];
      newPosts[postIndex] = updatedPost;
      return newPosts;
    });
  }, []);

  const handleBitePress = useCallback((postId) => {
    const userId = auth.currentUser.uid;
    
    // First, update UI immediately for instant feedback
    updatePostOptimistic(postId, (post) => {
      const currentBitedBy = post.bitedBy || [];
      const hasUserBited = currentBitedBy.includes(userId);
      
      if (hasUserBited) {
        // Unlike
        return {
          ...post,
          bites: Math.max(0, (post.bites || 0) - 1),
          bitedBy: currentBitedBy.filter(id => id !== userId)
        };
      } else {
        // Like
        return {
          ...post,
          bites: (post.bites || 0) + 1,
          bitedBy: [...currentBitedBy, userId]
        };
      }
    });
    
    // Then, update Firebase in the background (don't wait for this)
    const updateFirebase = async () => {
      try {
        const postRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postRef);
        if (!postSnap.exists()) return;
        
        const currentData = postSnap.data();
        const currentBitedBy = currentData.bitedBy || [];
        const hasUserBited = currentBitedBy.includes(userId);
        
        if (hasUserBited) {
          await updateDoc(postRef, {
            bites: increment(-1),
            bitedBy: arrayRemove(userId)
          });
        } else {
          await updateDoc(postRef, {
            bites: increment(1),
            bitedBy: arrayUnion(userId)
          });
        }
      } catch (error) {
        console.error('Error updating bites:', error);
        // If Firebase fails, revert the optimistic update
        updatePostOptimistic(postId, (post) => {
          const currentBitedBy = post.bitedBy || [];
          const hasUserBited = currentBitedBy.includes(userId);
          
          // Revert the change
          if (hasUserBited) {
            return {
              ...post,
              bites: (post.bites || 0) + 1,
              bitedBy: [...currentBitedBy, userId]
            };
          } else {
            return {
              ...post,
              bites: Math.max(0, (post.bites || 0) - 1),
              bitedBy: currentBitedBy.filter(id => id !== userId)
            };
          }
        });
      }
    };
    
    updateFirebase();
  }, [updatePostOptimistic]);

  const handleDoubleTapLike = useCallback((postId) => {
    const userId = auth.currentUser.uid;
    
    // Double-tap should only LIKE, never unlike (Instagram behavior)
    updatePostOptimistic(postId, (post) => {
      const currentBitedBy = post.bitedBy || [];
      const hasUserBited = currentBitedBy.includes(userId);
      
      // If already liked, do nothing
      if (hasUserBited) return post;
      
      // If not liked, like it
      return {
        ...post,
        bites: (post.bites || 0) + 1,
        bitedBy: [...currentBitedBy, userId]
      };
    });
    
    // Update Firebase in background (only if not already liked)
    const updateFirebase = async () => {
      try {
        const postRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postRef);
        if (!postSnap.exists()) return;
        
        const currentData = postSnap.data();
        const currentBitedBy = currentData.bitedBy || [];
        const hasUserBited = currentBitedBy.includes(userId);
        
        // Only like if not already liked
        if (!hasUserBited) {
          await updateDoc(postRef, {
            bites: increment(1),
            bitedBy: arrayUnion(userId)
          });
        }
      } catch (error) {
        console.error('Error updating bites:', error);
        // If Firebase fails, revert the optimistic update
        updatePostOptimistic(postId, (post) => {
          const currentBitedBy = post.bitedBy || [];
          const hasUserBited = currentBitedBy.includes(userId);
          
          // Only revert if we had optimistically liked it
          if (hasUserBited) {
            return {
              ...post,
              bites: Math.max(0, (post.bites || 0) - 1),
              bitedBy: currentBitedBy.filter(id => id !== userId)
            };
          }
          return post;
        });
      }
    };
    
    updateFirebase();
  }, [updatePostOptimistic]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'detail' ? 'grid' : 'detail');
  };

  const handleScroll = (event, postId) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / Dimensions.get('window').width);
    setCurrentImageIndices(prev => ({
      ...prev,
      [postId]: index
    }));
  };

  const handleUsernamePress = (userId) => {
    router.push({
      pathname: '/FriendProfile',
      params: { userId }
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
          <View style={styles.usernameContainer}>
            {(item.owners || [{ id: item.userId, username: item.username || 'Unknown' }]).map((owner, index) => (
              <View key={`${item.id}-owner-${owner.id}-${index}`} style={styles.usernameWrapper}>
                <TouchableOpacity onPress={() => handleUsernamePress(owner.id)}>
                  <Text style={styles.username}>{owner.username}</Text>
                </TouchableOpacity>
                {index < (item.owners?.length || 1) - 1 && (
                  <Text style={styles.usernameSeparator}> • </Text>
                )}
              </View>
            ))}
          </View>
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
              data={item.imageUrls || [item.imageUrl]}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(url, index) => `${item.id}-image-${index}-${url}`}
              renderItem={({ item: imageUrl }) => (
                <Image 
                  source={{ uri: imageUrl }} 
                  style={styles.postImage}
                  resizeMode="cover"
                />
              )}
              onScroll={(e) => handleScroll(e, item.id)}
              scrollEventThrottle={16}
            />
            {(item.imageUrls?.length > 1 || false) && (
              <View style={styles.paginationDots}>
                {(item.imageUrls || []).map((_, index) => (
                  <View
                    key={`${item.id}-dot-${index}`}
                    style={[
                      styles.paginationDot,
                      index === (currentImageIndices[item.id] || 0) && styles.paginationDotActive
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        </TapGestureHandler>

        {/* Instagram-style action bar - positioned like Instagram */}
        <View style={styles.actionBar}>
          <View style={styles.leftActions}>
            <BreadButton postId={item.id} hasUserBited={hasUserBited} onPress={handleBitePress} />
          </View>
        </View>

        {/* Bite count */}
        <View style={styles.biteCountContainer}>
          <Text style={styles.biteCountText}>
            {item.bites} {item.bites === 1 ? 'bite' : 'bites'}
          </Text>
        </View>

        <View style={styles.postFooter}>
          <Text style={styles.caption}>{item.caption}</Text>
          <Text style={styles.postDate}>
            {item.createdAt?.toDate().toLocaleString() || ''}
          </Text>
        </View>
      </View>
    );
  }, [handleBitePress, handleDoubleTapLike, handleUsernamePress, handleScroll, currentImageIndices]);

  const renderGridPost = ({ item }) => {
    const userId = auth.currentUser.uid;
    const hasUserBited = item.bitedBy?.includes(userId) || false;

    return (
      <TouchableOpacity 
        style={styles.gridItem}
        onPress={() => setViewMode('detail')}
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

  const Header = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Feed</Text>
      <TouchableOpacity onPress={toggleViewMode} style={styles.viewModeButton}>
        <Ionicons 
          name={viewMode === 'detail' ? 'grid-outline' : 'list-outline'} 
          size={24} 
          color="#1976d2" 
        />
      </TouchableOpacity>
    </View>
  );

  useEffect(() => {
    setLoading(true);
    fetchPosts().finally(() => setLoading(false));
  }, []);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={posts}
        renderItem={viewMode === 'detail' ? renderDetailPost : renderGridPost}
        keyExtractor={item => item.id ? `post-${item.id}` : `generated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`}
        numColumns={viewMode === 'grid' ? 3 : 1}
        key={viewMode}
        ListHeaderComponent={Header}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1976d2"
          />
        }
        ref={flatListRef}
      />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
    marginBottom: 5
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000'
  },
  viewModeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5'
  },
  postContainer: {
    marginBottom: 15,
    backgroundColor: '#fff',
    width: '100%'
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  usernameContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    flex: 1
  },
  usernameWrapper: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  username: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1976d2'
  },
  usernameSeparator: {
    fontSize: 14,
    color: '#666'
  },
  imageGalleryContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    backgroundColor: '#f5f5f5'
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
    color: '#000',
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
    backgroundColor: '#f5f5f5'
  },
  postFooter: {
    padding: 12
  },
  caption: {
    fontSize: 14,
    marginBottom: 5
  },
  postDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 8
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
    backgroundColor: '#f5f5f5'
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
  }
});

export default FeedScreen;
