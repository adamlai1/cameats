// app/tabs/ProfileScreen.js

import { Ionicons } from '@expo/vector-icons';
import { manipulateAsync } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { usePathname, useRouter } from 'expo-router';
import { arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, increment, limit, query, updateDoc, where } from 'firebase/firestore';
import { deleteObject } from 'firebase/storage';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    Platform,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { auth, db, storage } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import * as postService from '../services/postService';
import { uploadProfilePicture } from '../utils/profilePicture';

// Import bread slice images and preload them
const breadNormal = require('../../assets/images/bread-normal.png');
const breadBitten = require('../../assets/images/bread-bitten.png');
const biteAnimation = require('../../assets/images/bite-animation.png');

// Images are now preloaded in _layout.js to avoid redundant prefetching

const WINDOW_WIDTH = Dimensions.get('window').width;
const POST_WIDTH = WINDOW_WIDTH / 3;

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

// Memoized ProfilePicture component to prevent unnecessary re-renders
const ProfilePicture = React.memo(({ profilePicUrl, uploadingPic, theme, onPress }) => {
  const styles = getStyles(theme);
  
  return (
    <TouchableOpacity 
      style={styles.profilePicContainer}
      onPress={onPress}
    >
      <View style={styles.profilePic}>
        {profilePicUrl ? (
          <Image 
            source={{ uri: profilePicUrl }} 
            style={styles.profilePicImage} 
          />
        ) : (
          <Ionicons name="person" size={40} color={theme.textSecondary} />
        )}
        {uploadingPic && (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.editIconContainer}>
        <Ionicons name="camera" size={14} color="#fff" />
      </View>
    </TouchableOpacity>
  );
});

// Memoized Header component to prevent unnecessary re-renders
const Header = React.memo(({ 
  username, 
  displayName, 
  bio, 
  profilePicUrl, 
  uploadingPic,
  postsCount,
  friendsCount,
  friendRequestsCount,
  theme,
  onProfilePicPress,
  onAddFriendPress,
  onFriendRequestsPress,
  onSettingsPress,
  onFriendsPress
}) => {
  const styles = getStyles(theme);
  
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={styles.username}>{username}</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.addFriendButton}
            onPress={onAddFriendPress}
          >
            <Ionicons name="person-add-outline" size={24} color="#0095f6" />
          </TouchableOpacity>
          {friendRequestsCount > 0 && (
            <TouchableOpacity 
              style={styles.requestButton}
              onPress={onFriendRequestsPress}
            >
              <Ionicons name="person-add" size={24} color="#0095f6" />
              <View style={styles.requestBadge}>
                <Text style={styles.requestCount}>{friendRequestsCount}</Text>
              </View>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={onSettingsPress}
          >
            <Ionicons name="settings-outline" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.profileInfo}>
        <ProfilePicture
          profilePicUrl={profilePicUrl}
          uploadingPic={uploadingPic}
          theme={theme}
          onPress={onProfilePicPress}
        />

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{postsCount}</Text>
            <Text style={styles.statLabel}>Meals</Text>
          </View>

          <TouchableOpacity 
            style={styles.statItem}
            onPress={onFriendsPress}
          >
            <Text style={styles.statNumber}>{friendsCount}</Text>
            <Text style={styles.statLabel}>Friends</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bioContainer}>
        {displayName && <Text style={styles.displayName}>{displayName}</Text>}
        {bio ? (
          <Text style={styles.bio}>{bio}</Text>
        ) : (
          <Text style={styles.noBio}>No bio yet</Text>
        )}
      </View>
    </View>
  );
});

const ProfileScreen = forwardRef((props, ref) => {
  const { logout } = useAuth();
  const { theme, themeMode, setTheme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [profilePicUrl, setProfilePicUrl] = useState(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [friendsList, setFriendsList] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [posts, setPosts] = useState([]);
  const [showFriendsList, setShowFriendsList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentImageIndices, setCurrentImageIndices] = useState({});
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const router = useRouter();
  const gridListRef = useRef(null);
  const swipeableRef = useRef(null);

  // Memoized callback functions to prevent unnecessary re-renders
  const handleAddFriendPress = useCallback(() => setShowAddFriend(true), []);
  const handleFriendRequestsPress = useCallback(() => setShowFriendRequests(true), []);
  const handleSettingsPress = useCallback(() => setShowSettings(true), []);
  const handleFriendsPress = useCallback(() => {
    router.push({
      pathname: '/FriendsList',
      params: { userId: auth.currentUser.uid }
    });
  }, [router]);

  const handleProfilePicPress = useCallback(async () => {
    const options = ['Take Photo', 'Choose from Library', 'Cancel'];
    Alert.alert(
      'Update Profile Picture',
      'Choose an option',
      [
        {
          text: options[0],
          onPress: () => pickProfilePic('camera')
        },
        {
          text: options[1],
          onPress: () => pickProfilePic('library')
        },
        {
          text: options[2],
          style: 'cancel'
        }
      ]
    );
  }, [pickProfilePic]);

  const pickProfilePic = useCallback(async (type) => {
    try {
      let result;
      const options = {
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        presentationStyle: 'overFullScreen'
      };

      // Add platform-specific options
      if (Platform.OS === 'android') {
        options.cropperCircleOverlay = true;
      } else {
        // On iOS, we'll handle the circular crop through image manipulation
        options.allowsEditing = true;
      }

      if (type === 'camera') {
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // For iOS, we'll handle the circular crop through image manipulation
        if (Platform.OS === 'ios') {
          const manipulateResult = await manipulateAsync(
            result.assets[0].uri,
            [
              { crop: {
                height: result.assets[0].height,
                width: result.assets[0].width,
                originX: 0,
                originY: 0
              }},
            ],
            { compress: 0.7, format: 'jpeg' }
          );
          await uploadProfilePic(manipulateResult.uri);
        } else {
          await uploadProfilePic(result.assets[0].uri);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  }, []);

  // Expose scrollToTop function to parent component
  useImperativeHandle(ref, () => ({
    scrollToTop: () => {
      if (gridListRef.current) {
        gridListRef.current.scrollToOffset({ offset: 0, animated: true });
      }
    }
  }), []);

  // Add this effect to handle tab press
  const pathname = usePathname();
  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (!userDoc.exists()) {
        console.error('User profile not found');
        return;
      }

      const userData = userDoc.data();
      setUsername(userData.username);
      setEmail(userData.email);
      setDisplayName(userData.displayName || '');
      setBio(userData.bio || '');
      setProfilePicUrl(userData.profilePicUrl);

      // Batch fetch friends' details if any exist
      if (userData.friends && userData.friends.length > 0) {
        try {
          const friendPromises = userData.friends.map(friendId =>
            getDoc(doc(db, 'users', friendId))
          );
          const friendDocs = await Promise.all(friendPromises);
          const friendsList = friendDocs
            .filter(doc => doc.exists())
            .map(doc => ({
              id: doc.id,
              username: doc.data().username,
              displayName: doc.data().displayName,
              profilePicUrl: doc.data().profilePicUrl
            }));
          setFriendsList(friendsList);
        } catch (error) {
          console.error('Error fetching friends:', error);
          setFriendsList([]);
        }
      } else {
        setFriendsList([]);
      }

      // Set friend requests
      setFriendRequests(userData.friendRequests || []);

      // Show profile info immediately, then load posts
      setLoading(false);

      // Defer post loading to improve perceived performance
      setTimeout(async () => {
        try {
          // Use optimized post service instead of fetching all posts
          const userPosts = await postService.fetchPosts([auth.currentUser.uid], null, 100);
          setPosts(userPosts);
        } catch (error) {
          console.error('Error fetching user posts:', error);
          // Fallback to old method if optimized fetch fails
          await fetchPostsLegacy();
        }
      }, 100);
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  // Fallback method for post fetching
  const fetchPostsLegacy = async () => {
    try {
      // Fetch posts more efficiently without composite index requirement
      const postsQuery = query(
        collection(db, 'posts'),
        where('userId', '==', auth.currentUser.uid), // Single user query - no composite index needed
        limit(50) // Limit to improve performance
      );
      
      const snapshot = await getDocs(postsQuery);
      let userPosts = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        
        // Use existing username from profile data to avoid extra fetches
        const owners = data.postOwners?.length > 0 
          ? data.postOwners.map(ownerId => ({
              id: ownerId,
              username: ownerId === auth.currentUser.uid ? username : 'Unknown'
            }))
          : [{ id: auth.currentUser.uid, username: username }];
        
        return {
          id: docSnapshot.id,
          ...data,
          owners: owners,
          bitedBy: Array.isArray(data.bitedBy) ? data.bitedBy : [],
          bites: typeof data.bites === 'number' ? data.bites : 0
        };
      });

      // Sort client-side since we can't use orderBy with where
      userPosts.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bTime - aTime; // Descending order
      });

      setPosts(userPosts);
    } catch (error) {
      console.error('Error in legacy post fetch:', error);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
  };

  const handleSearch = async (text) => {
    setSearchUsername(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('username', '>=', text),
        where('username', '<=', text + '\uf8ff'),
        limit(10)
      );
      const querySnapshot = await getDocs(q);

      // Get current user's friends list
      const currentUserDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const currentUserData = currentUserDoc.data();
      const currentUserFriends = currentUserData.friends || [];
      
      const results = querySnapshot.docs
        .map(doc => {
          const userData = doc.data();
          const isCurrentUser = doc.id === auth.currentUser.uid;
          
          // Check if this user's ID is in current user's friends array
          const isFriend = currentUserFriends.includes(doc.id);
          
          const hasPendingRequest = friendRequests.some(request => request.id === doc.id);
          
          return {
            id: doc.id,
            ...userData,
            isCurrentUser,
            isFriend,
            hasPendingRequest
          };
        })
        .filter(user => !user.isCurrentUser);
      
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Failed to search for users');
    }
    setSearching(false);
  };

  const handleSendFriendRequest = async (toUser) => {
    try {
      // Add to their friend requests
      const userRef = doc(db, 'users', toUser.id);
      await updateDoc(userRef, {
        friendRequests: arrayUnion({
          id: auth.currentUser.uid,
          username: username
        })
      });

      Alert.alert('Success', 'Friend request sent!');
      setSearchResults(searchResults.filter(user => user.id !== toUser.id));
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Failed to send friend request');
    }
  };

  const handleAcceptFriendRequest = async (fromUid) => {
    try {
      // Update current user's friends list and remove the request
      const currentUserRef = doc(db, 'users', auth.currentUser.uid);
      const currentUserDoc = await getDoc(currentUserRef);
      const currentUserData = currentUserDoc.data();

      await updateDoc(currentUserRef, {
        friends: [...(currentUserData.friends || []), fromUid],
        friendRequests: currentUserData.friendRequests.filter(id => id !== fromUid)
      });

      // Update the other user's friends list
      const otherUserRef = doc(db, 'users', fromUid);
      const otherUserDoc = await getDoc(otherUserRef);
      const otherUserData = otherUserDoc.data();

      await updateDoc(otherUserRef, {
        friends: [...(otherUserData.friends || []), auth.currentUser.uid]
      });

      Alert.alert('Friend request accepted!');
      fetchProfile(); // Refresh the profile data
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', error.message);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        displayName,
        username,
        bio
      });
      setShowSettings(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  const uploadProfilePic = async (uri) => {
    if (!uri) return;
    setUploadingPic(true);

    try {
      const downloadURL = await uploadProfilePicture(
        auth.currentUser.uid, 
        uri,
        (progress) => {
          console.log('Upload progress:', progress);
        }
      );
      
      // Update local state
      setProfilePicUrl(downloadURL);
      setUploadingPic(false);
    } catch (error) {
      console.error('Profile picture upload error:', error);
      Alert.alert('Error', error.message || 'Failed to upload profile picture. Please try again.');
      setUploadingPic(false);
    }
  };

  const handlePostPress = async (post) => {
    const postIndex = posts.findIndex(p => p.id === post.id);
    
    try {
      // Instead of passing all posts data through route params (which breaks images),
      // just pass the essential info and let ProfilePostsView fetch fresh data
      const essentialData = posts.map(p => ({
        id: p.id,
        userId: p.userId,
        username: p.username,
        postOwners: p.postOwners || []
      }));
      
      router.push({
        pathname: '/ProfilePostsView',
        params: { 
          postIds: JSON.stringify(essentialData),
          initialIndex: postIndex.toString(),
          username: username
        }
      });
    } catch (error) {
      console.error('Error navigating to posts:', error);
      Alert.alert('Error', 'Failed to open posts view');
    }
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
              // Delete the image from storage
              if (post.imageUrl) {
                const imageRef = ref(storage, post.imageUrl);
                await deleteObject(imageRef).catch(error => {
                  console.log('Image might have already been deleted:', error);
                });
              }

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

  const handleImageScroll = (event, postId) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / Dimensions.get('window').width);
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

  const renderContent = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      );
    }

    return (
      <FlatList
        key="grid"
        ref={gridListRef}
        data={posts}
        renderItem={renderGridPost}
        keyExtractor={item => item.id ? `post-${item.id}` : `generated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`}
        numColumns={3}
        ListHeaderComponent={
          <Header
            username={username}
            displayName={displayName}
            bio={bio}
            profilePicUrl={profilePicUrl}
            uploadingPic={uploadingPic}
            postsCount={posts.length}
            friendsCount={friendsList.length}
            friendRequestsCount={friendRequests.length}
            theme={theme}
            onProfilePicPress={handleProfilePicPress}
            onAddFriendPress={handleAddFriendPress}
            onFriendRequestsPress={handleFriendRequestsPress}
            onSettingsPress={handleSettingsPress}
            onFriendsPress={handleFriendsPress}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
          />
        }
      />
    );
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/');
            } catch (error) {
              console.error('Error logging out:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {renderContent()}
      </GestureHandlerRootView>

      {/* Add Friend Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showAddFriend}
        onRequestClose={() => setShowAddFriend(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Friend</Text>
              <TouchableOpacity onPress={() => {
                setShowAddFriend(false);
                setSearchUsername('');
                setSearchResults([]);
              }}>
                <Ionicons name="close" size={24} color="black" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by username"
                value={searchUsername}
                onChangeText={handleSearch}
                autoCapitalize="none"
              />
              {searching && (
                <ActivityIndicator style={styles.searchSpinner} color={theme.accent} />
              )}
            </View>

            <FlatList
              data={searchResults}
              keyExtractor={item => `search-${item.id}`}
              renderItem={({ item }) => (
                <View style={styles.searchResultItem}>
                  <Text style={styles.searchResultUsername}>{item.username}</Text>
                  {item.isFriend ? (
                    <View style={[styles.addButton, styles.addedButton]}>
                      <Text style={styles.addedButtonText}>Added</Text>
                    </View>
                  ) : item.hasPendingRequest ? (
                    <View style={[styles.addButton, styles.pendingButton]}>
                      <Text style={styles.pendingButtonText}>Pending</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => handleSendFriendRequest(item)}
                    >
                      <Text style={styles.addButtonText}>Add</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              ListEmptyComponent={
                searchUsername ? (
                  <Text style={styles.emptyText}>No users found</Text>
                ) : (
                  <Text style={styles.emptyText}>Search for users to add</Text>
                )
              }
            />
          </View>
        </View>
      </Modal>

      {/* Friend Requests Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showFriendRequests}
        onRequestClose={() => setShowFriendRequests(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Friend Requests</Text>
              <TouchableOpacity onPress={() => setShowFriendRequests(false)}>
                <Ionicons name="close" size={24} color="black" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={friendRequests}
              keyExtractor={item => `request-${item.id}`}
              renderItem={({ item }) => (
                <View style={styles.requestItem}>
                  <View style={styles.requestInfo}>
                    <Text style={styles.requestUsername}>{item.username}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAcceptFriendRequest(item.id)}
                  >
                    <Text style={styles.acceptButtonText}>Accept</Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No friend requests</Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showSettings}
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { width: '90%', maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollContent}>
              <Text style={styles.inputLabel}>Display Name</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter display name"
              />

              <Text style={styles.inputLabel}>Username</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Enter username"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Bio</Text>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={bio}
                onChangeText={setBio}
                placeholder="Write something about yourself"
                multiline
                maxLength={150}
              />
              <Text style={styles.charCount}>{bio.length}/150</Text>

              {/* Dark Mode Section */}
              <Text style={styles.inputLabel}>Appearance</Text>
              <View style={styles.themeContainer}>
                <TouchableOpacity
                  style={[
                    styles.themeOption,
                    themeMode === 'light' && styles.themeOptionSelected
                  ]}
                  onPress={() => setTheme('light')}
                >
                  <Ionicons 
                    name="sunny-outline" 
                    size={20} 
                    color={themeMode === 'light' ? '#007AFF' : theme.textSecondary} 
                  />
                  <Text style={[
                    styles.themeOptionText,
                    themeMode === 'light' && styles.themeOptionTextSelected
                  ]}>
                    Light
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.themeOption,
                    themeMode === 'dark' && styles.themeOptionSelected
                  ]}
                  onPress={() => setTheme('dark')}
                >
                  <Ionicons 
                    name="moon-outline" 
                    size={20} 
                    color={themeMode === 'dark' ? '#007AFF' : theme.textSecondary} 
                  />
                  <Text style={[
                    styles.themeOptionText,
                    themeMode === 'dark' && styles.themeOptionTextSelected
                  ]}>
                    Dark
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={styles.saveButton} 
                onPress={handleSaveSettings}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.saveButton, styles.logoutButton]} 
                onPress={handleLogout}
              >
                <Text style={styles.saveButtonText}>Logout</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
});

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background
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
  username: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text
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
    backgroundColor: theme.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  profilePicImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    resizeMode: 'cover'
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0095f6',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    fontWeight: 'bold',
    color: theme.text
  },
  statLabel: {
    color: theme.textSecondary
  },
  bioContainer: {
    paddingHorizontal: 15,
    marginTop: 10
  },
  displayName: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
    color: theme.text
  },
  bio: {
    fontSize: 14,
    color: theme.text,
    lineHeight: 20
  },
  noBio: {
    fontSize: 14,
    color: theme.textSecondary,
    fontStyle: 'italic'
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 10
  },
  charCount: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'right',
    marginTop: 4
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
    marginTop: 16,
    color: theme.text
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.overlay,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.border
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text
  },
  searchInput: {
    margin: 15,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 10
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  friendIcon: {
    marginRight: 15
  },
  friendName: {
    fontSize: 16
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    padding: 20
  },
  modalContent: {
    backgroundColor: theme.modal,
    padding: 20,
    borderRadius: 10,
    width: '80%'
  },
  modalScrollContent: {
    padding: 10
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: theme.inputBackground,
    color: theme.text
  },
  saveButton: {
    backgroundColor: '#0095f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  settingsButton: {
    padding: 10
  },
  gridPost: {
    width: POST_WIDTH,
    height: POST_WIDTH
  },
  gridImage: {
    width: Dimensions.get('window').width / 3 - 2,
    height: Dimensions.get('window').width / 3 - 2,
    margin: 1
  },
  backButton: {
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
  detailContainer: {
    paddingHorizontal: 15
  },
  detailPost: {
    marginBottom: 20,
    backgroundColor: '#fff',
    width: '100%',
    overflow: 'hidden'
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
  postContent: {
    padding: 15
  },
  postCaption: {
    fontSize: 16,
    marginBottom: 10
  },
  postDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 5
  },
  coOwnedBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#1976d2',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  postHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  postOwners: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1976d2'
  },
  deleteButton: {
    padding: 8,
  },
  gridDeleteButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  requestButton: {
    padding: 10,
    marginRight: 10,
    position: 'relative'
  },
  requestBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#ff3b30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4
  },
  requestCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  requestInfo: {
    flex: 1
  },
  requestUsername: {
    fontSize: 16,
    fontWeight: '500'
  },
  acceptButton: {
    backgroundColor: '#0095f6',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '600'
  },
  addFriendButton: {
    padding: 10,
    marginRight: 10
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 15
  },
  searchSpinner: {
    marginLeft: 10
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  searchResultUsername: {
    fontSize: 16,
    fontWeight: '500'
  },
  addButton: {
    backgroundColor: '#0095f6',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600'
  },
  addedButton: {
    backgroundColor: '#eee'
  },
  addedButtonText: {
    color: '#666',
    fontWeight: '600'
  },
  pendingButton: {
    backgroundColor: '#e3f2fd'
  },
  pendingButtonText: {
    color: '#0095f6',
    fontWeight: '600'
  },
  friendsContainer: {
    marginTop: 20,
    paddingHorizontal: 15
  },
  friendsList: {
    paddingVertical: 10
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15
  },
  friendInfo: {
    flex: 1
  },
  friendName: {
    fontSize: 16,
    fontWeight: '500'
  },
  friendUsername: {
    fontSize: 14,
    color: '#666'
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10
  },
  defaultAvatar: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  ownersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginVertical: 5
  },
  ownersLabel: {
    fontWeight: 'bold',
    color: '#666',
    marginRight: 5
  },
  owners: {
    color: '#1976d2',
    flex: 1
  },
  postCaption: {
    fontSize: 16,
    marginBottom: 10
  },
  ownersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginVertical: 5
  },
  ownersLabel: {
    fontWeight: 'bold',
    color: '#666',
    marginRight: 5
  },
  owners: {
    color: '#1976d2',
    flex: 1
  },
  postDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 5
  },
  coOwnedBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#1976d2',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  postHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  postOwners: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1976d2'
  },
  deleteButton: {
    padding: 8,
  },
  gridDeleteButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  usernameContainer: {
    flex: 1,
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
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  leftActions: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start'
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
  optionsButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center'
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
  captionInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginVertical: 15,
    minHeight: 100,
    textAlignVertical: 'top'
  },
  logoutButton: {
    backgroundColor: '#ff3b30',
    marginTop: 40
  },
  themeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10
  },
  themeOption: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: theme.surface
  },
  themeOptionSelected: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '10'
  },
  themeOptionText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 5,
    color: theme.textSecondary
  },
  themeOptionTextSelected: {
    fontWeight: 'bold',
    color: theme.primary
  }
});

export default ProfileScreen;
