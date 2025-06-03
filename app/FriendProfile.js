import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, increment, orderBy, query, updateDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
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
import { auth, db } from '../firebase';

// Import bread slice images and preload them
const breadNormal = require('../assets/images/bread-normal.png');
const breadBitten = require('../assets/images/bread-bitten.png');
const biteAnimation = require('../assets/images/bite-animation.png');

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

export default function FriendProfile() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'detail'

  const fetchFriendProfile = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        console.error('User profile not found');
        return;
      }

      const userData = userDoc.data();
      setProfile({
        id: userDoc.id,
        ...userData
      });

      // Show profile immediately, then load posts
      setLoading(false);

      // Fetch all posts and filter client-side
      const postsQuery = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(postsQuery);
      const allPosts = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Ensure like state is always properly initialized
          bitedBy: Array.isArray(data.bitedBy) ? data.bitedBy : [],
          bites: typeof data.bites === 'number' ? data.bites : 0
        };
      });

      // Filter posts where this user is either an owner or creator
      const userPosts = allPosts.filter(post => {
        const isOwner = post.postOwners?.includes(userId);
        const isCreator = post.userId === userId;
        return isOwner || isCreator;
      });

      setPosts(userPosts);
    } catch (error) {
      console.error('Error fetching friend profile:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFriendProfile();
  }, [userId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFriendProfile();
  };

  const handlePostPress = (post) => {
    setViewMode('detail');
  };

  const handleUsernamePress = (ownerId) => {
    if (ownerId === userId) return; // Don't navigate if clicking current profile
    router.push({
      pathname: '/FriendProfile',
      params: { userId: ownerId }
    });
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
    const currentUserId = auth.currentUser.uid;
    
    // First, update UI immediately for instant feedback
    updatePostOptimistic(postId, (post) => {
      const currentBitedBy = post.bitedBy || [];
      const hasUserBited = currentBitedBy.includes(currentUserId);
      
      if (hasUserBited) {
        // Unlike
        return {
          ...post,
          bites: Math.max(0, (post.bites || 0) - 1),
          bitedBy: currentBitedBy.filter(id => id !== currentUserId)
        };
      } else {
        // Like
        return {
          ...post,
          bites: (post.bites || 0) + 1,
          bitedBy: [...currentBitedBy, currentUserId]
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
        const hasUserBited = currentBitedBy.includes(currentUserId);
        
        if (hasUserBited) {
          await updateDoc(postRef, {
            bites: increment(-1),
            bitedBy: arrayRemove(currentUserId)
          });
        } else {
          await updateDoc(postRef, {
            bites: increment(1),
            bitedBy: arrayUnion(currentUserId)
          });
        }
      } catch (error) {
        console.error('Error updating bites:', error);
        // If Firebase fails, revert the optimistic update
        updatePostOptimistic(postId, (post) => {
          const currentBitedBy = post.bitedBy || [];
          const hasUserBited = currentBitedBy.includes(currentUserId);
          
          // Revert the change
          if (hasUserBited) {
            return {
              ...post,
              bites: (post.bites || 0) + 1,
              bitedBy: [...currentBitedBy, currentUserId]
            };
          } else {
            return {
              ...post,
              bites: Math.max(0, (post.bites || 0) - 1),
              bitedBy: currentBitedBy.filter(id => id !== currentUserId)
            };
          }
        });
      }
    };
    
    updateFirebase();
  }, [updatePostOptimistic]);

  const handleDoubleTapLike = useCallback((postId) => {
    const currentUserId = auth.currentUser.uid;
    
    // Double-tap should only LIKE, never unlike (Instagram behavior)
    updatePostOptimistic(postId, (post) => {
      const currentBitedBy = post.bitedBy || [];
      const hasUserBited = currentBitedBy.includes(currentUserId);
      
      // If already liked, do nothing
      if (hasUserBited) return post;
      
      // If not liked, like it
      return {
        ...post,
        bites: (post.bites || 0) + 1,
        bitedBy: [...currentBitedBy, currentUserId]
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
        const hasUserBited = currentBitedBy.includes(currentUserId);
        
        // Only like if not already liked
        if (!hasUserBited) {
          await updateDoc(postRef, {
            bites: increment(1),
            bitedBy: arrayUnion(currentUserId)
          });
        }
      } catch (error) {
        console.error('Error updating bites:', error);
        // If Firebase fails, revert the optimistic update
        updatePostOptimistic(postId, (post) => {
          const currentBitedBy = post.bitedBy || [];
          const hasUserBited = currentBitedBy.includes(currentUserId);
          
          // Only revert if we had optimistically liked it
          if (hasUserBited) {
            return {
              ...post,
              bites: Math.max(0, (post.bites || 0) - 1),
              bitedBy: currentBitedBy.filter(id => id !== currentUserId)
            };
          }
          return post;
        });
      }
    };
    
    updateFirebase();
  }, [updatePostOptimistic]);

  const renderDetailPost = ({ item }) => {
    const currentUserId = auth.currentUser.uid;
    const hasUserBited = item.bitedBy?.includes(currentUserId) || false;

    const handleDoubleTap = () => {
      // Handle the like logic
      handleDoubleTapLike(item.id);
    };

    return (
      <View style={styles.detailPost}>
        <View style={styles.postHeader}>
          <View style={styles.usernameContainer}>
            {item.owners?.map((owner, index) => (
              <View key={owner.id} style={styles.usernameWrapper}>
                <TouchableOpacity onPress={() => handleUsernamePress(owner.id)}>
                  <Text style={styles.postOwners}>{owner.username}</Text>
                </TouchableOpacity>
                {index < item.owners.length - 1 && (
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
              keyExtractor={(_, index) => `${item.id}-image-${index}`}
              renderItem={({ item: imageUrl }) => (
                <Image source={{ uri: imageUrl }} style={styles.detailImage} />
              )}
            />
            {(item.imageUrls?.length > 1) && (
              <View style={styles.paginationDots}>
                {(item.imageUrls).map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.paginationDot,
                      index === 0 && styles.paginationDotActive
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        </TapGestureHandler>

        {/* Instagram-style action bar */}
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

        <View style={styles.postContent}>
          <Text style={styles.postCaption}>{item.caption}</Text>
          <Text style={styles.postDate}>
            {item.createdAt?.toDate().toLocaleString() || ''}
          </Text>
        </View>
      </View>
    );
  };

  const renderGridPost = ({ item }) => (
    <TouchableOpacity onPress={() => handlePostPress(item)}>
      <Image 
        source={{ uri: item.imageUrls?.[0] || item.imageUrl }} 
        style={styles.gridImage} 
      />
      {item.owners?.length > 1 && (
        <View style={styles.coOwnedBadge}>
          <Ionicons name="people" size={12} color="#fff" />
        </View>
      )}
      {item.imageUrls?.length > 1 && (
        <View style={styles.multipleImagesBadge}>
          <Ionicons name="images" size={12} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );

  const Header = () => (
    <View style={styles.header}>
      {viewMode === 'detail' && (
        <TouchableOpacity 
          style={styles.backToGridButton}
          onPress={() => setViewMode('grid')}
        >
          <Ionicons name="arrow-back" size={24} color="black" />
          <Text style={styles.backButtonText}>Back to Grid</Text>
        </TouchableOpacity>
      )}
      
      <View style={styles.headerTop}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.username}>@{profile?.username}</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.profileInfo}>
        <View style={styles.profilePicContainer}>
          <View style={styles.profilePic}>
            {profile?.profilePicUrl ? (
              <Image 
                source={{ uri: profile.profilePicUrl }} 
                style={styles.profilePicImage} 
              />
            ) : (
              <View style={[styles.profilePic, styles.defaultProfilePic]}>
                <Ionicons name="person" size={40} color="#666" />
              </View>
            )}
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{posts.length}</Text>
            <Text style={styles.statLabel}>Meals</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{profile?.friends?.length || 0}</Text>
            <Text style={styles.statLabel}>Friends</Text>
          </View>
        </View>
      </View>

      <View style={styles.bioContainer}>
        {profile?.displayName && (
          <Text style={styles.displayName}>{profile.displayName}</Text>
        )}
        {profile?.bio ? (
          <Text style={styles.bio}>{profile.bio}</Text>
        ) : (
          <Text style={styles.noBio}>No bio yet</Text>
        )}
      </View>

      <TouchableOpacity 
        style={styles.viewModeButton}
        onPress={() => setViewMode(prev => prev === 'grid' ? 'detail' : 'grid')}
      >
        <Ionicons 
          name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'} 
          size={24} 
          color="#1976d2" 
        />
      </TouchableOpacity>
    </View>
  );

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
        renderItem={viewMode === 'grid' ? renderGridPost : renderDetailPost}
        keyExtractor={item => item.id}
        numColumns={viewMode === 'grid' ? 3 : 1}
        key={viewMode}
        ListHeaderComponent={Header}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1976d2"
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  header: {
    padding: 15
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15
  },
  backButton: {
    padding: 5
  },
  headerRight: {
    width: 34 // Same width as back button for centering
  },
  username: {
    fontSize: 20,
    fontWeight: 'bold'
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15
  },
  profilePicContainer: {
    marginRight: 30
  },
  profilePic: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  profilePicImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  defaultProfilePic: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  statsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  statItem: {
    alignItems: 'center'
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  statLabel: {
    color: '#666'
  },
  bioContainer: {
    paddingHorizontal: 15,
    marginTop: 10
  },
  displayName: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4
  },
  bio: {
    fontSize: 14,
    color: '#262626',
    lineHeight: 20
  },
  noBio: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic'
  },
  viewModeButton: {
    alignSelf: 'flex-end',
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginTop: 10
  },
  backToGridButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginBottom: 10
  },
  backButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: 'black'
  },
  detailPost: {
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  imageGalleryContainer: {
    width: '100%',
    height: 400,
    position: 'relative'
  },
  detailImage: {
    width: Dimensions.get('window').width,
    height: 400,
    resizeMode: 'cover'
  },
  postHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  usernameContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  usernameWrapper: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  usernameSeparator: {
    fontSize: 14,
    color: '#666'
  },
  postOwners: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1976d2'
  },
  postContent: {
    padding: 15
  },
  postCaption: {
    fontSize: 14,
    marginBottom: 10
  },
  postDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 5
  },
  gridImage: {
    width: Dimensions.get('window').width / 3 - 2,
    height: Dimensions.get('window').width / 3 - 2,
    margin: 1
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
  actionBar: {
    flexDirection: 'row',
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
  }
}); 