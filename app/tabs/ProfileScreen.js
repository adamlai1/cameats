// app/tabs/ProfileScreen.js

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { arrayUnion, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { GestureHandlerRootView, PanGestureHandler } from 'react-native-gesture-handler';
import { auth, db } from '../../firebase';

const WINDOW_WIDTH = Dimensions.get('window').width;
const POST_WIDTH = WINDOW_WIDTH / 3;

export default function ProfileScreen() {
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
  const [viewMode, setViewMode] = useState('grid');
  const [initialScrollIndex, setInitialScrollIndex] = useState(0);
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const router = useRouter();
  const flatListRef = useRef(null);
  const swipeableRef = useRef(null);

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

      // Fetch friends' details
      const friendPromises = (userData.friends || []).map(friendId =>
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

      // Set friend requests
      setFriendRequests(userData.friendRequests || []);

      // Fetch all posts and filter for user's posts
      const postsQuery = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(postsQuery);
      const allPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter posts where this user is an owner
      console.log('Filtering posts for user:', auth.currentUser.uid);
      const userPosts = allPosts.filter(post => {
        // Check if user is in postOwners array (new format)
        const isOwner = post.postOwners?.includes(auth.currentUser.uid);
        
        // Check if user is in taggedFriends array (old format)
        const isTagged = post.taggedFriendIds?.includes(auth.currentUser.uid);
        
        // Check if user is the original creator
        const isCreator = post.userId === auth.currentUser.uid;
        
        console.log('Post', post.id, {
          postOwners: post.postOwners,
          taggedFriendIds: post.taggedFriendIds,
          userId: post.userId,
          isOwner,
          isTagged,
          isCreator
        });
        
        // Post should show if user is either an owner, tagged, or creator
        return isOwner || isTagged || isCreator;
      });
      console.log('Filtered posts:', userPosts);

      setPosts(userPosts);
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
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

  const handleProfilePicPress = async () => {
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
  };

  const pickProfilePic = async (type) => {
    try {
      let result;
      if (type === 'camera') {
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7
        });
      }

      if (!result.canceled) {
        await uploadProfilePic(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const uploadProfilePic = async (uri) => {
    if (!uri) return;
    setUploadingPic(true);

    try {
      const response = await fetch(uri);
      const blob = await response.blob();

      if (blob.size > 5 * 1024 * 1024) { // 5MB limit
        Alert.alert('Error', 'Image too large. Please choose a smaller image.');
        return;
      }

      const filename = `profile_pictures/${auth.currentUser.uid}_${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);
      const uploadTask = uploadBytesResumable(storageRef, blob);

      uploadTask.on(
        'state_changed',
        null,
        (error) => {
          console.error('Upload error:', error);
          Alert.alert('Error', 'Failed to upload image. Please try again.');
          setUploadingPic(false);
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          await updateDoc(doc(db, 'users', auth.currentUser.uid), {
            profilePicUrl: url
          });
          setProfilePicUrl(url);
          setUploadingPic(false);
        }
      );
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      Alert.alert('Error', 'Failed to update profile picture. Please try again.');
      setUploadingPic(false);
    }
  };

  const handlePostPress = (post) => {
    const postIndex = posts.findIndex(p => p.id === post.id);
    setInitialScrollIndex(postIndex);
    setViewMode('detail');
  };

  const renderDetailPost = ({ item }) => (
    <View style={styles.detailPost}>
      <Image source={{ uri: item.imageUrl }} style={styles.detailImage} />
      <View style={styles.detailContent}>
        <Text style={styles.postCaption}>{item.caption}</Text>
        <View style={styles.ownersContainer}>
          <Text style={styles.ownersLabel}>Posted by: </Text>
          <Text style={styles.owners}>
            {item.owners?.map(owner => owner.username).join(', ')}
          </Text>
        </View>
        <Text style={styles.postDate}>
          {item.createdAt?.toDate().toLocaleString() || ''}
        </Text>
      </View>
    </View>
  );

  const renderGridPost = ({ item }) => (
    <TouchableOpacity onPress={() => handlePostPress(item)}>
      <Image source={{ uri: item.imageUrl }} style={styles.gridImage} />
      {item.owners?.length > 1 && (
        <View style={styles.coOwnedBadge}>
          <Ionicons name="people" size={12} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );

  const Header = () => (
    <View style={styles.header}>
      {viewMode === 'detail' && (
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            setViewMode('grid');
            setInitialScrollIndex(0);
          }}
        >
          <Ionicons name="arrow-back" size={24} color="black" />
          <Text style={styles.backButtonText}>Back to Grid</Text>
        </TouchableOpacity>
      )}
      
      <View style={styles.headerTop}>
        <Text style={styles.username}>{username}</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.addFriendButton}
            onPress={() => setShowAddFriend(true)}
          >
            <Ionicons name="person-add-outline" size={24} color="#0095f6" />
          </TouchableOpacity>
          {friendRequests.length > 0 && (
            <TouchableOpacity 
              style={styles.requestButton}
              onPress={() => setShowFriendRequests(true)}
            >
              <Ionicons name="person-add" size={24} color="#0095f6" />
              <View style={styles.requestBadge}>
                <Text style={styles.requestCount}>{friendRequests.length}</Text>
              </View>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => setShowSettings(true)}
          >
            <Ionicons name="settings-outline" size={24} color="black" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.profileInfo}>
        <TouchableOpacity 
          style={styles.profilePicContainer}
          onPress={handleProfilePicPress}
        >
          <View style={styles.profilePic}>
            {profilePicUrl ? (
              <Image 
                source={{ uri: profilePicUrl }} 
                style={styles.profilePicImage} 
              />
            ) : (
              <Ionicons name="person" size={40} color="#666" />
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

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{posts.length}</Text>
            <Text style={styles.statLabel}>Meals</Text>
          </View>

          <TouchableOpacity 
            style={styles.statItem}
            onPress={() => setShowFriendsList(true)}
          >
            <Text style={styles.statNumber}>{friendsList.length}</Text>
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

  const onGestureEvent = (event) => {
    const { translationX } = event.nativeEvent;
    if (translationX > 50 && viewMode === 'detail') { // Threshold of 50px
      setViewMode('grid');
      setInitialScrollIndex(0);
    }
  };

  const renderDetailView = () => (
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      activeOffsetX={[-20, 20]} // Detect swipes in both directions after 20px
    >
      <View style={{ flex: 1 }}>
        <FlatList
          data={posts}
          renderItem={renderDetailPost}
          keyExtractor={item => item.id}
          ListHeaderComponent={Header}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.detailContainer}
          initialScrollIndex={initialScrollIndex}
          getItemLayout={(data, index) => ({
            length: 500,
            offset: index * 500,
            index,
          })}
          onScrollToIndexFailed={info => {
            const wait = new Promise(resolve => setTimeout(resolve, 500));
            wait.then(() => {
              flatListRef.current?.scrollToIndex({ 
                index: initialScrollIndex,
                animated: true
              });
            });
          }}
          ref={flatListRef}
        />
      </View>
    </PanGestureHandler>
  );

  const renderGridView = () => (
    <FlatList
      data={posts}
      renderItem={renderGridPost}
      keyExtractor={item => item.id}
      numColumns={3}
      ListHeaderComponent={Header}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    />
  );

  const FriendsList = () => (
    <View style={styles.friendsContainer}>
      <Text style={styles.sectionTitle}>Friends ({friendsList.length})</Text>
      <FlatList
        data={friendsList}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.friendItem}
            onPress={() => {
              setShowFriendsList(false); // Close friends list modal first
              router.push({
                pathname: '/FriendProfile',
                params: { userId: item.id }
              });
            }}
          >
            {item.profilePicUrl ? (
              <Image
                source={{ uri: item.profilePicUrl }}
                style={styles.friendAvatar}
              />
            ) : (
              <View style={[styles.friendAvatar, styles.defaultAvatar]}>
                <Ionicons name="person" size={30} color="#666" />
              </View>
            )}
            <View style={styles.friendInfo}>
              <Text style={styles.friendName}>{item.displayName || item.username}</Text>
              <Text style={styles.friendUsername}>@{item.username}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.friendsList}
      />
    </View>
  );

  const renderContent = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

    return (
      <FlatList
        data={posts}
        renderItem={viewMode === 'grid' ? renderGridPost : renderDetailPost}
        keyExtractor={item => item.id}
        numColumns={viewMode === 'grid' ? 3 : 1}
        key={viewMode} // This forces a re-render when view mode changes
        ListHeaderComponent={Header}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {renderContent()}
      </GestureHandlerRootView>

      {/* Add Friend Modal */}
      <Modal
        animationType="slide"
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
                <ActivityIndicator style={styles.searchSpinner} />
              )}
            </View>

            <FlatList
              data={searchResults}
              keyExtractor={item => item.id}
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
        animationType="slide"
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
              keyExtractor={item => item.id}
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

      {/* Friends List Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showFriendsList}
        onRequestClose={() => setShowFriendsList(false)}
      >
        <SafeAreaView style={styles.modalView}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Friends</Text>
            <TouchableOpacity onPress={() => setShowFriendsList(false)}>
              <Ionicons name="close" size={24} color="black" />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search friends..."
            placeholderTextColor="#666"
          />

          <FriendsList />
        </SafeAreaView>
      </Modal>

      {/* Settings Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showSettings}
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={24} color="black" />
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
              />

              <Text style={styles.inputLabel}>Bio</Text>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={bio}
                onChangeText={setBio}
                placeholder="Write a bio..."
                multiline
                numberOfLines={4}
                maxLength={150}
              />
              <Text style={styles.charCount}>{bio.length}/150</Text>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveSettings}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
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
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 10
  },
  charCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 4
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
    marginTop: 16,
    color: '#262626'
  },
  modalView: {
    flex: 1,
    backgroundColor: '#fff'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold'
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
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: '80%'
  },
  modalScrollContent: {
    padding: 10
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 16
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
    width: POST_WIDTH,
    height: POST_WIDTH,
    borderWidth: 1,
    borderColor: '#fff'
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
  detailImage: {
    width: '100%',
    height: 400,
    resizeMode: 'cover'
  },
  detailContent: {
    padding: 15
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  detailUsername: {
    fontSize: 16,
    fontWeight: 'bold'
  },
  detailDate: {
    color: '#666',
    fontSize: 14
  },
  detailCaption: {
    fontSize: 16,
    marginBottom: 10,
    lineHeight: 22
  },
  detailTags: {
    color: '#0095f6',
    fontSize: 14
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
  }
});
