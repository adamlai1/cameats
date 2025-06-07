// app/FeedScreen.js

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
    deleteDoc,
    doc,
    updateDoc
} from 'firebase/firestore';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    RefreshControl,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { PinchGestureHandler, State, TapGestureHandler } from 'react-native-gesture-handler';
import { auth, db } from '../../firebase';
import { PostSkeleton } from '../components/ui/SkeletonLoader';
import * as postService from '../services/postService';

const POSTS_PER_PAGE = 5;
const WINDOW_WIDTH = Dimensions.get('window').width;

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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [lastVisible, setLastVisible] = useState(null);
  const [viewMode, setViewMode] = useState('detail'); // 'detail' or 'grid'
  const [currentImageIndices, setCurrentImageIndices] = useState({}); // Track current image index for each post
  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostOptions, setShowPostOptions] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [newCaption, setNewCaption] = useState('');
  const router = useRouter();
  const flatListRef = useRef(null);
  const [scale, setScale] = useState(1);
  const pinchRef = useRef();

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
      
      // Pre-fetch images for smoother loading
      newPosts.forEach(post => {
        // Pre-fetch post images
        if (post.imageUrls) {
          post.imageUrls.forEach(url => Image.prefetch(url));
        } else if (post.imageUrl) {
          Image.prefetch(post.imageUrl);
        }

        // Pre-fetch user profile pictures
        if (post.postOwners) {
          post.postOwners.forEach(owner => {
            if (owner.profilePicUrl) {
              Image.prefetch(owner.profilePicUrl);
            }
          });
        }
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
    loadInitialPosts();
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

  const handleBitePress = useCallback(async (postId) => {
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
  }, [updatePostOptimistic]);

  const handleDoubleTapLike = useCallback(async (postId) => {
    const post = posts.find(p => p.id === postId);
    if (!post || post.bitedBy?.includes(auth.currentUser.uid)) return;

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
  }, [posts, updatePostOptimistic]);

  const handleImageScroll = useCallback((event, postId) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const imageIndex = Math.round(contentOffset / WINDOW_WIDTH);
    setCurrentImageIndices(prev => ({
      ...prev,
      [postId]: imageIndex
    }));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'detail' ? 'grid' : 'detail');
  };

  const handleUsernamePress = (userId) => {
    router.push({
      pathname: '/FriendProfile',
      params: { userId }
    });
  };

  const handlePostOptionsPress = (post) => {
    setSelectedPost(post);
    setNewCaption(post.caption || '');
    setShowPostOptions(true);
  };

  const handleEditCaption = async () => {
    if (!selectedPost) return;
    setShowPostOptions(false);
    setEditingCaption(true);
  };

  const handleAddCoOwners = () => {
    // We'll implement this next
    setShowPostOptions(false);
  };

  const handleAddPhotos = () => {
    // We'll implement this next
    setShowPostOptions(false);
  };

  const handleDeletePost = async (post) => {
    // Only allow deletion if user is the creator
    if (post.userId !== auth.currentUser.uid) {
      Alert.alert('Cannot Delete', 'You can only delete posts that you created.');
      return;
    }

    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete the post document
              await deleteDoc(doc(db, 'posts', post.id));

              // Update local state
              setPosts(currentPosts => currentPosts.filter(p => p.id !== post.id));
              Alert.alert('Success', 'Post deleted successfully');
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('Error', 'Failed to delete post. Please try again.');
            }
          }
        }
      ]
    );
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
          {(item.userId === auth.currentUser.uid || item.postOwners?.some(owner => owner.id === auth.currentUser.uid)) && (
            <TouchableOpacity 
              style={styles.optionsButton}
              onPress={() => handlePostOptionsPress(item)}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color="#000" />
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

        {/* Instagram-style action bar - positioned like Instagram */}
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
        <View style={styles.biteCountContainer}>
          <Text style={styles.biteCountText}>
            {item.bites || 0} {item.bites === 1 ? 'bite' : 'bites'}
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

  const renderPostOptionsModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showPostOptions}
      onRequestClose={() => setShowPostOptions(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowPostOptions(false)}
      >
        <View style={styles.optionsModalContent}>
          <TouchableOpacity style={styles.optionItem} onPress={handleEditCaption}>
            <Text style={styles.optionText}>Edit Caption</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.optionItem} onPress={handleAddCoOwners}>
            <Text style={styles.optionText}>Add Co-owners</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.optionItem} onPress={handleAddPhotos}>
            <Text style={styles.optionText}>Add Photos</Text>
          </TouchableOpacity>
          
          {selectedPost?.userId === auth.currentUser.uid && (
            <TouchableOpacity 
              style={[styles.optionItem, styles.deleteOption]} 
              onPress={() => {
                setShowPostOptions(false);
                handleDeletePost(selectedPost);
              }}
            >
              <Text style={styles.deleteOptionText}>Delete Post</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderEditCaptionModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={editingCaption}
      onRequestClose={() => setEditingCaption(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Caption</Text>
            <TouchableOpacity onPress={() => setEditingCaption(false)}>
              <Ionicons name="close" size={24} color="black" />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.captionInput}
            value={newCaption}
            onChangeText={setNewCaption}
            placeholder="Write a caption..."
            multiline
            maxLength={2200}
          />

          <TouchableOpacity
            style={styles.saveButton}
            onPress={async () => {
              if (!selectedPost) return;
              try {
                await updateDoc(doc(db, 'posts', selectedPost.id), {
                  caption: newCaption
                });
                // Update local state
                setPosts(prevPosts => prevPosts.map(post => 
                  post.id === selectedPost.id 
                    ? { ...post, caption: newCaption }
                    : post
                ));
                setEditingCaption(false);
                Alert.alert('Success', 'Caption updated successfully!');
              } catch (error) {
                console.error('Error updating caption:', error);
                Alert.alert('Error', 'Failed to update caption');
              }
            }}
          >
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

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
          <FlatList
            ref={flatListRef}
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
                  <ActivityIndicator color="#1976d2" />
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
          {renderPostOptionsModal()}
          {renderEditCaptionModal()}
        </View>
      </PinchGestureHandler>
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
  },
  optionsButton: {
    padding: 8
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end'
  },
  optionsModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    paddingVertical: 20
  },
  optionItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  optionText: {
    fontSize: 16,
    color: '#000'
  },
  deleteOption: {
    borderBottomWidth: 0
  },
  deleteOptionText: {
    fontSize: 16,
    color: '#ff3b30'
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  captionInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginVertical: 15,
    minHeight: 100,
    textAlignVertical: 'top'
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 10
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
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
    color: '#666'
  }
});

export default FeedScreen;
