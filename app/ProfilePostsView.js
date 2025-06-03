import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { arrayRemove, arrayUnion, doc, getDoc, increment, updateDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
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

const WINDOW_WIDTH = Dimensions.get('window').width;

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
      fadeDuration={0}
    />
  </TouchableOpacity>
));

export default function ProfilePostsView() {
  const router = useRouter();
  const { postIds: postIdsParam, initialIndex, username } = useLocalSearchParams();
  const [posts, setPosts] = useState([]);
  const [currentImageIndices, setCurrentImageIndices] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPostsData = async () => {
      if (!postIdsParam) return;
      
      try {
        const postIds = JSON.parse(postIdsParam);
        console.log('Fetching fresh post data for:', postIds.length, 'posts');
        
        // Fetch fresh post data from Firestore
        const fetchedPosts = await Promise.all(
          postIds.map(async (postInfo) => {
            try {
              const postDoc = await getDoc(doc(db, 'posts', postInfo.id));
              if (!postDoc.exists()) {
                console.warn('Post not found:', postInfo.id);
                return null;
              }
              
              const postData = postDoc.data();
              
              // Fetch owners data
              let owners = [];
              if (postData.postOwners && postData.postOwners.length > 0) {
                const ownerPromises = postData.postOwners.map(async (ownerId) => {
                  try {
                    const userDoc = await getDoc(doc(db, 'users', ownerId));
                    if (userDoc.exists()) {
                      const userData = userDoc.data();
                      return { id: ownerId, username: userData.username };
                    }
                    return { id: ownerId, username: 'Unknown' };
                  } catch (error) {
                    console.error('Error fetching owner data:', error);
                    return { id: ownerId, username: 'Unknown' };
                  }
                });
                owners = await Promise.all(ownerPromises);
              } else {
                // Fallback to original creator
                owners = [{ id: postData.userId, username: postData.username || 'Unknown' }];
              }
              
              return {
                id: postInfo.id,
                ...postData,
                owners: owners,
                // Ensure like state is properly initialized
                bitedBy: Array.isArray(postData.bitedBy) ? postData.bitedBy : [],
                bites: typeof postData.bites === 'number' ? postData.bites : 0
              };
            } catch (error) {
              console.error('Error fetching post:', postInfo.id, error);
              return null;
            }
          })
        );
        
        // Filter out null posts and set the data
        const validPosts = fetchedPosts.filter(post => post !== null);
        console.log('Successfully fetched', validPosts.length, 'posts');
        setPosts(validPosts);
      } catch (error) {
        console.error('Error fetching posts data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPostsData();
  }, [postIdsParam]);

  const handleImageScroll = (event, postId) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / WINDOW_WIDTH);
    setCurrentImageIndices(prev => ({
      ...prev,
      [postId]: index
    }));
  };

  const handleUsernamePress = (ownerId) => {
    if (ownerId === auth.currentUser.uid) return; // Don't navigate if clicking own profile
    router.push({
      pathname: '/FriendProfile',
      params: { userId: ownerId }
    });
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

  const handleBitePress = useCallback((postId) => {
    const userId = auth.currentUser.uid;
    
    updatePostOptimistic(postId, (post) => {
      const currentBitedBy = post.bitedBy || [];
      const hasUserBited = currentBitedBy.includes(userId);
      
      if (hasUserBited) {
        return {
          ...post,
          bites: Math.max(0, (post.bites || 0) - 1),
          bitedBy: currentBitedBy.filter(id => id !== userId)
        };
      } else {
        return {
          ...post,
          bites: (post.bites || 0) + 1,
          bitedBy: [...currentBitedBy, userId]
        };
      }
    });
    
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
        updatePostOptimistic(postId, (post) => {
          const currentBitedBy = post.bitedBy || [];
          const hasUserBited = currentBitedBy.includes(userId);
          
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
    
    updatePostOptimistic(postId, (post) => {
      const currentBitedBy = post.bitedBy || [];
      const hasUserBited = currentBitedBy.includes(userId);
      
      if (hasUserBited) return post;
      
      return {
        ...post,
        bites: (post.bites || 0) + 1,
        bitedBy: [...currentBitedBy, userId]
      };
    });
    
    const updateFirebase = async () => {
      try {
        const postRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postRef);
        if (!postSnap.exists()) return;
        
        const currentData = postSnap.data();
        const currentBitedBy = currentData.bitedBy || [];
        const hasUserBited = currentBitedBy.includes(userId);
        
        if (!hasUserBited) {
          await updateDoc(postRef, {
            bites: increment(1),
            bitedBy: arrayUnion(userId)
          });
        }
      } catch (error) {
        console.error('Error updating bites:', error);
      }
    };
    
    updateFirebase();
  }, [updatePostOptimistic]);

  const renderPost = ({ item }) => {
    const handleDoubleTap = () => {
      handleDoubleTapLike(item.id);
    };

    const currentImageIndex = currentImageIndices[item.id] || 0;
    const hasUserBited = item.bitedBy?.includes(auth.currentUser.uid);
    
    // Get image data - handle both imageUrls (new format) and imageUrl (old format)
    const imageData = item.imageUrls || (item.imageUrl ? [item.imageUrl] : []);

    return (
      <View style={styles.postContainer}>
        <View style={styles.postHeader}>
          <View style={styles.usernameContainer}>
            {item.owners?.map((owner, index) => (
              <View key={owner.id} style={styles.usernameWrapper}>
                <TouchableOpacity onPress={() => handleUsernamePress(owner.id)}>
                  <Text style={styles.username}>{owner.username}</Text>
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
              data={imageData}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, index) => `${item.id}-image-${index}`}
              renderItem={({ item: imageUrl }) => (
                <Image 
                  source={{ uri: imageUrl }}
                  style={styles.postImage}
                  resizeMode="cover"
                />
              )}
              onScroll={(event) => handleImageScroll(event, item.id)}
              scrollEventThrottle={16}
            />
            {(imageData.length > 1) && (
              <View style={styles.paginationDots}>
                {imageData.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.paginationDot,
                      index === currentImageIndex && styles.paginationDotActive
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
            <BreadButton
              postId={item.id}
              hasUserBited={hasUserBited}
              onPress={handleBitePress}
            />
          </View>
        </View>

        {/* Bite count */}
        {item.bites > 0 && (
          <View style={styles.biteCountContainer}>
            <Text style={styles.biteCountText}>
              {item.bites} {item.bites === 1 ? 'bite' : 'bites'}
            </Text>
          </View>
        )}

        <View style={styles.postFooter}>
          {item.caption && (
            <Text style={styles.caption}>{item.caption}</Text>
          )}
          <Text style={styles.postDate}>
            {item.createdAt?.toDate ? 
              item.createdAt.toDate().toLocaleString() : 
              'Unknown date'
            }
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
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
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{username}'s Posts</Text>
        <View style={styles.placeholder} />
      </View>

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={item => item.id}
        initialScrollIndex={parseInt(initialIndex) || 0}
        onScrollToIndexFailed={info => {
          const wait = new Promise(resolve => setTimeout(resolve, 500));
          wait.then(() => {
            // Retry scroll after a short delay
          });
        }}
        getItemLayout={(data, index) => ({
          length: 550,
          offset: 550 * index,
          index,
        })}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff'
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000'
  },
  placeholder: {
    width: 40
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
  postImage: {
    width: WINDOW_WIDTH,
    aspectRatio: 1,
    backgroundColor: '#f5f5f5'
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
  }
}); 