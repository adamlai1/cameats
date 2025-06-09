import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { arrayRemove, arrayUnion, doc, getDoc, increment, updateDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    FlatList,
    Image,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { State, TapGestureHandler } from 'react-native-gesture-handler';
import { auth, db, storage } from '../firebase';
import { useTheme } from './contexts/ThemeContext';
import { handleDeletePost as deletePostUtil } from './utils/postOptionsUtils';

// Import bread slice images and bite animation
const breadNormal = require('../assets/images/bread-normal.png');
const breadBitten = require('../assets/images/bread-bitten.png');
const biteAnimationImage = require('../assets/images/bite-animation.png');

const WINDOW_WIDTH = Dimensions.get('window').width;

export default function ProfilePostsView() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  
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
  const router = useRouter();
  const { postIds: postIdsParam, initialIndex, username } = useLocalSearchParams();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentImageIndices, setCurrentImageIndices] = useState({});
  const [biteAnimations, setBiteAnimations] = useState({});
  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostOptions, setShowPostOptions] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [newCaption, setNewCaption] = useState('');
  const [showAddCoOwners, setShowAddCoOwners] = useState(false);
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [searching, setSearching] = useState(false);
  const [friendsList, setFriendsList] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [showAddPhotos, setShowAddPhotos] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showManagePhotos, setShowManagePhotos] = useState(false);

  const fetchPostsData = async () => {
    try {
      setLoading(true);
      const postIds = JSON.parse(postIdsParam);
      
      // Fetch all posts in parallel
      const fetchedPosts = await Promise.all(
        postIds.map(async (postInfo) => {
          try {
            const postRef = doc(db, 'posts', postInfo.id);
            const postSnap = await getDoc(postRef);
            
            if (!postSnap.exists()) {
              console.log('Post not found:', postInfo.id);
              return null;
            }

            const postData = postSnap.data();

            // Fetch owners' data
            const owners = await Promise.all(
              (postData.postOwners || [postData.userId]).map(async (ownerId) => {
                const userRef = doc(db, 'users', ownerId);
                const userSnap = await getDoc(userRef);
                return {
                  id: ownerId,
                  username: userSnap.exists() ? userSnap.data().username : 'Unknown User'
                };
              })
            );

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

  useEffect(() => {
    fetchPostsData();
  }, [postIdsParam]);

  useEffect(() => {
    (async () => {
      const mediaStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
      const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
      if (mediaStatus.status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to your media library to add photos.');
      }
      if (cameraStatus.status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to your camera to take photos.');
      }
    })();
  }, []);

  const handleImageScroll = (event, postId) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const imageIndex = Math.round(contentOffset / WINDOW_WIDTH);
    setCurrentImageIndices(prev => ({
      ...prev,
      [postId]: imageIndex
    }));
  };

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
        // Trigger bite animation when ADDING a bite
        triggerBiteAnimation(postId);
        
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
      
      // Trigger bite animation
      triggerBiteAnimation(postId);
      
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
  }, [updatePostOptimistic, triggerBiteAnimation]);

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
    setShowPostOptions(false);
    setShowAddCoOwners(true);
    setSearchUsername('');
    setSearchResults([]);
    setSelectedFriends([]);
    fetchFriendsList();
  };

  const handleSearch = (text) => {
    setSearchUsername(text);
    if (!text.trim()) {
      // Show all friends when search is empty
      setSearchResults(friendsList.filter(friend => 
        !selectedPost?.postOwners?.includes(friend.id)
      ));
      return;
    }

    // Filter friends list based on search text
    const results = friendsList.filter(friend => 
      friend.username.toLowerCase().includes(text.toLowerCase()) &&
      !selectedPost?.postOwners?.includes(friend.id)
    );
    setSearchResults(results);
  };

  const toggleFriendSelection = (friend) => {
    setSelectedFriends(prev => {
      const isSelected = prev.some(f => f.id === friend.id);
      if (isSelected) {
        return prev.filter(f => f.id !== friend.id);
      } else {
        return [...prev, friend];
      }
    });
  };

  const handleSaveCoOwners = async () => {
    if (!selectedPost || selectedFriends.length === 0) return;

    try {
      // Update the post document
      const postRef = doc(db, 'posts', selectedPost.id);
      
      // Add new owners to both postOwners array and owners array
      const updates = {
        postOwners: arrayUnion(...selectedFriends.map(f => f.id)),
        owners: arrayUnion(...selectedFriends.map(f => ({
          id: f.id,
          username: f.username
        })))
      };

      await updateDoc(postRef, updates);

      // Update local state
      setPosts(prevPosts => prevPosts.map(post => {
        if (post.id === selectedPost.id) {
          return {
            ...post,
            postOwners: [...(post.postOwners || []), ...selectedFriends.map(f => f.id)],
            owners: [...(post.owners || []), ...selectedFriends.map(f => ({
              id: f.id,
              username: f.username
            }))]
          };
        }
        return post;
      }));

      setShowAddCoOwners(false);
      Alert.alert('Success', 'Co-owners added successfully!');
    } catch (error) {
      console.error('Error adding co-owners:', error);
      Alert.alert('Error', 'Failed to add co-owners. Please try again.');
    }
  };

  const handleAddPhotos = () => {
    setShowPostOptions(false);
    setSelectedImages([]);
    setShowAddPhotos(true);
  };

  const handleDeletePost = async (post) => {
    await deletePostUtil(post, (postId) => {
      setPosts(currentPosts => currentPosts.filter(p => p.id !== postId));
      router.back(); // Go back after deleting
    });
  };

  const fetchFriendsList = async () => {
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      
      if (userData?.friends?.length) {
        // Get all friends documents using Promise.all
        const friendPromises = userData.friends.map(friendId =>
          getDoc(doc(db, 'users', friendId))
        );
        const friendDocs = await Promise.all(friendPromises);
        const friendsData = friendDocs
          .filter(doc => doc.exists())
          .map(doc => ({
            id: doc.id,
            username: doc.data().username
          }));

        setFriendsList(friendsData);
        // Initially show all friends in search results when no search term
        setSearchResults(friendsData.filter(friend => 
          !selectedPost?.postOwners?.includes(friend.id)
        ));
      } else {
        setFriendsList([]);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
      Alert.alert('Error', 'Failed to load friends list');
    }
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({ 
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.2,
        aspect: [1, 1]
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImages(prev => [...prev, result.assets[0].uri].slice(0, 10));
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const pickImages = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.2,
        aspect: [1, 1],
        allowsEditing: false  // Set to false since we're allowing multiple selection
      });

      if (!result.canceled && result.assets) {
        setSelectedImages(prev => [...prev, ...result.assets.map(asset => asset.uri)].slice(0, 10));
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    }
  };

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadPhotos = async () => {
    if (!selectedPost || selectedImages.length === 0) {
      Alert.alert('Error', 'No post selected or no images to upload');
      return;
    }
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      const uploadPromises = selectedImages.map(async (uri, index) => {
        const response = await fetch(uri);
        const blob = await response.blob();
        
        const filename = `posts/${selectedPost.id}/image_${Date.now()}_${index}.jpg`;
        const storageRef = ref(storage, filename);
        
        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);
        
        // Update progress after each upload
        setUploadProgress((index + 1) / selectedImages.length);
        
        return downloadURL;
      });

      const downloadURLs = await Promise.all(uploadPromises);
      
      // Update Firestore with new image URLs
      const postRef = doc(db, 'posts', selectedPost.id);
      await updateDoc(postRef, {
        imageUrls: arrayUnion(...downloadURLs)
      });

      // Clear selected images and close modal
      setSelectedImages([]);
      setShowAddPhotos(false);
      
      // Refresh the posts data
      fetchPostsData();
      
      Alert.alert('Success', 'Photos uploaded successfully!');
      
    } catch (error) {
      console.error('Error uploading photos:', error);
      Alert.alert('Error', 'Failed to upload photos. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeletePhoto = async (photoUrl, postData) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
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
              // Get the storage reference from the URL
              const photoRef = ref(storage, photoUrl);
              
              // Delete from Storage
              await deleteObject(photoRef);
              
              // Update Firestore - remove the URL from the imageUrls array
              const postRef = doc(db, 'posts', postData.id);
              await updateDoc(postRef, {
                imageUrls: postData.imageUrls.filter(url => url !== photoUrl)
              });

              // Update local state
              setPosts(prevPosts => prevPosts.map(post => {
                if (post.id === postData.id) {
                  return {
                    ...post,
                    imageUrls: post.imageUrls.filter(url => url !== photoUrl)
                  };
                }
                return post;
              }));

              Alert.alert('Success', 'Photo deleted successfully');
            } catch (error) {
              console.error('Error deleting photo:', error);
              Alert.alert('Error', 'Failed to delete photo. Please try again.');
            }
          }
        }
      ]
    );
  };

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
          <View style={styles.headerContent}>
            <ScrollView 
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.usernameScrollContainer}
            >
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
            </ScrollView>
            {item.location && (
              <View style={styles.locationContainer}>
                <Ionicons name="location-outline" size={12} color="#666" />
                <Text style={styles.locationText}>{item.location.name}</Text>
              </View>
            )}
          </View>
          {(item.userId === auth.currentUser.uid || item.postOwners?.includes(auth.currentUser.uid)) && (
            <TouchableOpacity 
              style={styles.optionsButton}
              onPress={() => handlePostOptionsPress(item)}
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
            
            {/* Bite Animation */}
            {biteAnimations[item.id] && (
              <Animated.Image
                source={biteAnimationImage}
                style={[
                  styles.biteAnimation,
                  {
                    opacity: biteAnimations[item.id],
                  },
                ]}
              />
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
              {item.createdAt?.toDate ? 
                item.createdAt.toDate().toLocaleString() : 
                'Unknown date'
              }
            </Text>
          </View>
        </View>

        {/* Bite count - always show, even when 0 */}
        <View style={styles.biteCountContainer}>
          <Text style={styles.biteCountText}>
            {item.bites || 0} {(item.bites || 0) === 1 ? 'bite' : 'bites'}
          </Text>
        </View>

        <View style={styles.postFooter}>
          {item.caption && (
            <Text style={styles.caption}>{item.caption}</Text>
          )}
        </View>
      </View>
    );
  };

  const renderPostOptionsModal = () => (
    <Modal
      animationType="fade"
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
          <TouchableOpacity 
            style={styles.optionItem}
            onPress={() => {
              setShowPostOptions(false);
              setShowAddPhotos(true);
            }}
          >
            <Text style={styles.optionText}>Add More Photos</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.optionItem}
            onPress={() => {
              setShowPostOptions(false);
              setShowManagePhotos(true);
            }}
          >
            <Text style={styles.optionText}>Manage Photos</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.optionItem}
            onPress={() => {
              setShowPostOptions(false);
              setEditingCaption(true);
              setNewCaption(selectedPost?.caption || '');
            }}
          >
            <Text style={styles.optionText}>Edit Caption</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.optionItem}
            onPress={() => {
              setShowPostOptions(false);
              setShowAddCoOwners(true);
              fetchFriendsList();
            }}
          >
            <Text style={styles.optionText}>Add Co-owners</Text>
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
      animationType="fade"
      transparent={true}
      visible={editingCaption}
      onRequestClose={() => setEditingCaption(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Caption</Text>
            <TouchableOpacity onPress={() => setEditingCaption(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.captionInput}
            value={newCaption}
            onChangeText={setNewCaption}
            placeholder="Write a caption..."
            placeholderTextColor={theme.textSecondary}
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

  const renderAddCoOwnersModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showAddCoOwners}
      onRequestClose={() => setShowAddCoOwners(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Co-owners</Text>
            <TouchableOpacity onPress={() => setShowAddCoOwners(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search friends"
              placeholderTextColor={theme.textSecondary}
              value={searchUsername}
              onChangeText={handleSearch}
              autoCapitalize="none"
            />
          </View>

          {selectedFriends.length > 0 && (
            <View style={styles.selectedFriendsContainer}>
              <Text style={styles.selectedFriendsTitle}>Selected ({selectedFriends.length}):</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.selectedFriendsScroll}
              >
                {selectedFriends.map(friend => (
                  <View key={friend.id} style={styles.selectedFriendChip}>
                    <Text style={styles.selectedFriendUsername}>{friend.username}</Text>
                    <TouchableOpacity 
                      onPress={() => toggleFriendSelection(friend)}
                      style={styles.removeSelectedButton}
                    >
                      <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <FlatList
            data={searchResults}
            keyExtractor={item => `search-${item.id}`}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.searchResultItem}
                onPress={() => toggleFriendSelection(item)}
              >
                <Text style={styles.searchResultUsername}>{item.username}</Text>
                <View style={[
                  styles.checkBox,
                  selectedFriends.some(f => f.id === item.id) && styles.checkBoxSelected
                ]}>
                  {selectedFriends.some(f => f.id === item.id) && (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  )}
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {friendsList.length === 0 ? "You don't have any friends yet" : "No friends found"}
              </Text>
            }
          />

          {selectedFriends.length > 0 && (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveCoOwners}
            >
              <Text style={styles.saveButtonText}>Add Selected Co-owners</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderAddPhotosModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showAddPhotos}
      onRequestClose={() => setShowAddPhotos(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add More Photos</Text>
            <TouchableOpacity onPress={() => setShowAddPhotos(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {selectedImages.length > 0 ? (
            <View style={styles.selectedImagesContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {selectedImages.map((uri, index) => (
                  <View key={index} style={styles.selectedImageWrapper}>
                    <Image source={{ uri }} style={styles.selectedImage} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close-circle" size={24} color="#ff3b30" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.emptyImagesContainer}>
              <Text style={styles.emptyText}>No images selected</Text>
            </View>
          )}

          <View style={styles.photoButtonsContainer}>
            <TouchableOpacity
              style={[styles.photoButton, styles.cameraButton]}
              onPress={takePhoto}
            >
              <Ionicons name="camera" size={24} color="#fff" />
              <Text style={styles.buttonText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.photoButton, styles.galleryButton]}
              onPress={pickImages}
            >
              <Ionicons name="images" size={24} color="#fff" />
              <Text style={styles.buttonText}>Choose from Gallery</Text>
            </TouchableOpacity>
          </View>

          {selectedImages.length > 0 && (
            <TouchableOpacity
              style={[styles.saveButton, uploading && styles.disabledButton]}
              onPress={handleUploadPhotos}
              disabled={uploading}
            >
              <Text style={styles.saveButtonText}>
                {uploading ? 'Adding Photos...' : 'Add Selected Photos'}
              </Text>
            </TouchableOpacity>
          )}

          {uploading && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                Uploading... {Math.round(uploadProgress)}%
              </Text>
              <ActivityIndicator size="large" color={theme.accent} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderManagePhotosModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showManagePhotos}
      onRequestClose={() => setShowManagePhotos(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Manage Photos</Text>
            <TouchableOpacity onPress={() => setShowManagePhotos(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {selectedPost?.imageUrls?.length > 0 ? (
            <ScrollView style={styles.managePhotosContainer}>
              {selectedPost.imageUrls.map((photoUrl, index) => (
                <View key={index} style={styles.managePhotoItem}>
                  <Image 
                    source={{ uri: photoUrl }} 
                    style={styles.managePhotoImage} 
                  />
                  <TouchableOpacity
                    style={styles.deletePhotoButton}
                    onPress={() => handleDeletePhoto(photoUrl, selectedPost)}
                  >
                    <Ionicons name="trash-outline" size={24} color="#ff3b30" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyPhotosContainer}>
              <Text style={styles.emptyText}>No photos in this post</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
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
          <Ionicons name="arrow-back" size={24} color={theme.text} />
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
      {renderPostOptionsModal()}
      {renderEditCaptionModal()}
      {renderAddCoOwnersModal()}
      {renderAddPhotosModal()}
      {renderManagePhotosModal()}
    </SafeAreaView>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background
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
    borderBottomColor: theme.border,
    backgroundColor: theme.background
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text
  },
  placeholder: {
    width: 40
  },
  postContainer: {
    marginBottom: 15,
    backgroundColor: theme.background,
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
    color: '#1976d2'
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
  optionsButton: {
    padding: 8
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end'
  },
  optionsModalContent: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    paddingVertical: 20
  },
  optionItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.border
  },
  optionText: {
    fontSize: 16,
    color: theme.text
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  },
  modalContent: {
    backgroundColor: theme.background,
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.border
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text
  },
  captionInput: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 12,
    marginVertical: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    color: theme.text,
    backgroundColor: theme.surface
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 15
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  searchContainer: {
    marginBottom: 15
  },
  searchInput: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: theme.text,
    backgroundColor: theme.surface
  },
  selectedFriendsContainer: {
    maxHeight: 80,
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    paddingBottom: 15
  },
  selectedFriendsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    color: theme.textSecondary
  },
  selectedFriendsScroll: {
    flexDirection: 'row'
  },
  selectedFriendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8
  },
  selectedFriendUsername: {
    fontSize: 14,
    marginRight: 4,
    color: theme.text
  },
  removeSelectedButton: {
    marginLeft: 4
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.border
  },
  searchResultUsername: {
    fontSize: 16,
    color: theme.text
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.border,
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkBoxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF'
  },
  emptyText: {
    textAlign: 'center',
    color: theme.textSecondary,
    padding: 20
  },
  selectedImagesContainer: {
    height: 120,
    marginBottom: 20
  },
  selectedImageWrapper: {
    position: 'relative',
    marginRight: 10
  },
  selectedImage: {
    width: 100,
    height: 100,
    borderRadius: 8
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: theme.background,
    borderRadius: 12
  },
  emptyImagesContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 8,
    marginBottom: 20
  },
  photoButtonsContainer: {
    gap: 15,
    marginBottom: 20
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8
  },
  cameraButton: {
    backgroundColor: '#34C759' // Green color for camera
  },
  galleryButton: {
    backgroundColor: '#007AFF' // Blue color for gallery
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8
  },
  disabledButton: {
    opacity: 0.5
  },
  progressContainer: {
    alignItems: 'center',
    marginTop: 20
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    color: theme.textSecondary
  },
  managePhotosContainer: {
    maxHeight: '80%'
  },
  managePhotoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: theme.surface,
    borderRadius: 8,
    padding: 10
  },
  managePhotoImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 15
  },
  deletePhotoButton: {
    padding: 10
  },
  emptyPhotosContainer: {
    padding: 20,
    alignItems: 'center'
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
  },
}); 