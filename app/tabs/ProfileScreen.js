// app/tabs/ProfileScreen.js

import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, Button, FlatList, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebase';

export default function ProfileScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [friendsList, setFriendsList] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friendUsername, setFriendUsername] = useState('');
  const [posts, setPosts] = useState([]);
  const [showFriendsList, setShowFriendsList] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

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

      // Fetch posts
      const postsQuery = query(
        collection(db, 'posts'),
        where('userId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const postsSnapshot = await getDocs(postsQuery);
      const postsData = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(postsData);
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

  const renderPost = ({ item }) => (
    <View style={styles.postContainer}>
      <Image source={{ uri: item.imageUrl }} style={styles.postImage} />
      <Text style={styles.postCaption}>{item.caption}</Text>
      {item.tags && item.tags.length > 0 && (
        <Text style={styles.postTags}>Tags: {item.tags.join(', ')}</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Profile</Text>
        <Text style={styles.username}>{username}</Text>
        <Text style={styles.email}>{email}</Text>
        
        <TouchableOpacity 
          style={styles.friendCounter}
          onPress={() => setShowFriendsList(true)}
        >
          <Text style={styles.friendCountText}>
            {friendsList.length} {friendsList.length === 1 ? 'Friend' : 'Friends'}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={showFriendsList}
        onRequestClose={() => setShowFriendsList(false)}
      >
        <View style={styles.modalView}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Friends List</Text>
            <FlatList
              data={friendsList}
              keyExtractor={(item) => item.uid}
              renderItem={({ item }) => (
                <Text style={styles.friendItem}>{item.username}</Text>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No friends yet</Text>
              }
            />
            <Button title="Close" onPress={() => setShowFriendsList(false)} />
          </View>
        </View>
      </Modal>

      {friendRequests.length > 0 && (
        <View style={styles.requestsSection}>
          <Text style={styles.subtitle}>Friend Requests ({friendRequests.length})</Text>
          {friendRequests.map((request, index) => (
            <View key={index} style={styles.requestItem}>
              <Text style={styles.requestUsername}>{request.username}</Text>
              <Button title="Accept" onPress={() => handleAcceptFriendRequest(request.uid)} />
            </View>
          ))}
        </View>
      )}

      <View style={styles.addFriendSection}>
        <TextInput
          placeholder="Add friend by username"
          value={friendUsername}
          onChangeText={setFriendUsername}
          style={styles.input}
        />
        <Button title="Send Request" onPress={handleSendFriendRequest} />
      </View>

      <Text style={styles.subtitle}>Your Posts</Text>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        contentContainerStyle={styles.postsContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff'
  },
  header: {
    alignItems: 'center',
    marginBottom: 20
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10
  },
  username: {
    fontSize: 18,
    marginBottom: 5
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10
  },
  friendCounter: {
    backgroundColor: '#e1e1e1',
    padding: 10,
    borderRadius: 20,
    marginTop: 10
  },
  friendCountText: {
    fontSize: 16,
    fontWeight: '500'
  },
  modalView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '80%',
    maxHeight: '70%'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center'
  },
  friendItem: {
    fontSize: 16,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    padding: 20
  },
  requestsSection: {
    marginBottom: 20
  },
  requestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    marginVertical: 5
  },
  requestUsername: {
    fontSize: 16
  },
  addFriendSection: {
    marginBottom: 20
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10
  },
  postsContainer: {
    paddingBottom: 20
  },
  postContainer: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    overflow: 'hidden'
  },
  postImage: {
    width: '100%',
    height: 200
  },
  postCaption: {
    padding: 10,
    fontSize: 16
  },
  postTags: {
    padding: 10,
    color: '#666'
  }
});
