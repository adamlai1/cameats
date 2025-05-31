// app/tabs/ProfileScreen.js

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
  const router = useRouter();

  useEffect(() => {
    fetchProfile();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  const fetchProfile = async () => {
    try {
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
      const friends = friendDocs
        .filter(doc => doc.exists())
        .map(doc => ({
          username: doc.data().username,
          uid: doc.id
        }));
      setFriendsList(friends);

      // Fetch friend requests
      const requestPromises = (userData.friendRequests || []).map(async (requestId) => {
        const requestDoc = await getDoc(doc(db, 'users', requestId));
        return {
          username: requestDoc.data()?.username,
          uid: requestId
        };
      });
      const requests = await Promise.all(requestPromises);
      setFriendRequests(requests.filter(r => r.username));

      // Fetch both user's posts and posts where user is tagged
      const [ownPostsSnapshot, taggedPostsSnapshot] = await Promise.all([
        // Query for posts created by the user
        getDocs(query(
          collection(db, 'posts'),
          where('userId', '==', auth.currentUser.uid),
          orderBy('createdAt', 'desc')
        )),
        // Query for posts where user is tagged
        getDocs(query(
          collection(db, 'posts'),
          where('taggedFriendIds', 'array-contains', auth.currentUser.uid),
          orderBy('createdAt', 'desc')
        ))
      ]);

      // Combine and sort all posts
      const ownPosts = ownPostsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isOwnPost: true
      }));
      
      const taggedPosts = taggedPostsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isTagged: true
      }));

      // Merge posts and sort by createdAt
      const allPosts = [...ownPosts, ...taggedPosts].sort((a, b) => {
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB - dateA;
      });

      setPosts(allPosts);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const handleSendFriendRequest = async () => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', friendUsername));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        Alert.alert('User not found');
        return;
      }

      const targetUser = querySnapshot.docs[0];
      if (targetUser.id === auth.currentUser.uid) {
        Alert.alert('Cannot send friend request to yourself');
        return;
      }

      const targetUserData = targetUser.data();
      if (targetUserData.friendRequests?.includes(auth.currentUser.uid)) {
        Alert.alert('Friend request already sent');
        return;
      }

      if (targetUserData.friends?.includes(auth.currentUser.uid)) {
        Alert.alert('Already friends with this user');
        return;
      }

      await updateDoc(doc(db, 'users', targetUser.id), {
        friendRequests: [...(targetUserData.friendRequests || []), auth.currentUser.uid]
      });

      Alert.alert('Friend request sent!');
      setFriendUsername('');
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', error.message);
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

  const renderPost = ({ item }) => (
    <TouchableOpacity style={styles.gridPost}>
      <Image 
        source={{ uri: item.imageUrl }} 
        style={styles.gridImage}
      />
    </TouchableOpacity>
  );

  const Header = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={styles.username}>{username}</Text>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => setShowSettings(true)}
        >
          <Ionicons name="settings-outline" size={24} color="black" />
        </TouchableOpacity>
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

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={item => item.id}
        numColumns={3}
        ListHeaderComponent={Header}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />

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

          <FlatList
            data={friendsList}
            keyExtractor={(item) => item.uid}
            renderItem={({ item }) => (
              <View style={styles.friendItem}>
                <View style={styles.friendIcon}>
                  <Ionicons name="person-circle" size={40} color="#666" />
                </View>
                <Text style={styles.friendName}>{item.username}</Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No friends yet</Text>
            }
          />
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
  }
});
