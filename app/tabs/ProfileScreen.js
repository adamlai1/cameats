// app/tabs/ProfileScreen.js

import { useRouter } from 'expo-router';
import { arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, Button, FlatList, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebase';

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [showFriends, setShowFriends] = useState(false);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const router = useRouter();

  useEffect(() => {
    fetchProfile();
    fetchPosts();
  }, []);

  const fetchProfile = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setProfile(userData);

        // Fetch friends list
        const friendPromises = (userData.friends || []).map(friendId =>
          getDoc(doc(db, 'users', friendId))
        );
        const friendDocs = await Promise.all(friendPromises);
        const friendsList = friendDocs
          .filter(doc => doc.exists())
          .map(doc => ({
            id: doc.id,
            username: doc.data().username
          }));
        setFriends(friendsList);

        // Fetch friend requests
        const requestPromises = (userData.friendRequests || []).map(fromUid =>
          getDoc(doc(db, 'users', fromUid))
        );
        const requestDocs = await Promise.all(requestPromises);
        const requestsList = requestDocs
          .filter(doc => doc.exists())
          .map(doc => ({
            id: doc.id,
            username: doc.data().username
          }));
        setFriendRequests(requestsList);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchPosts = async () => {
    try {
      // Get posts where user is a collaborator (either creator or tagged)
      const postsQuery = query(
        collection(db, 'posts'),
        where('collaborators', 'array-contains', {
          id: auth.currentUser.uid,
          username: profile?.username || 'Unknown'
        })
      );
      
      const snapshot = await getDocs(postsQuery);
      const userPosts = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .sort((a, b) => b.createdAt - a.createdAt);

      setPosts(userPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.replace('/');
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert('Error', error.message);
    }
  };

  const handleAcceptFriendRequest = async (fromUid) => {
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const friendRef = doc(db, 'users', fromUid);

      await updateDoc(userRef, {
        friends: arrayUnion(fromUid),
        friendRequests: arrayRemove(fromUid)
      });

      await updateDoc(friendRef, {
        friends: arrayUnion(auth.currentUser.uid)
      });

      // Update local state
      setFriendRequests(prev => prev.filter(req => req.id !== fromUid));
      const friendDoc = await getDoc(friendRef);
      if (friendDoc.exists()) {
        setFriends(prev => [...prev, {
          id: fromUid,
          username: friendDoc.data().username
        }]);
      }

      Alert.alert('Friend request accepted!');
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', error.message);
    }
  };

  const renderPost = ({ item }) => (
    <View style={styles.postContainer}>
      <View style={styles.postHeader}>
        <Text style={styles.username}>{item.username}</Text>
        {item.collaborators && item.collaborators.length > 1 && (
          <Text style={styles.collaborators}>
            with {item.collaborators
              .filter(c => c.id !== item.userId)
              .map(c => c.username)
              .join(', ')}
          </Text>
        )}
      </View>
      <Image source={{ uri: item.imageUrl }} style={styles.postImage} />
      <Text style={styles.caption}>{item.caption}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.username}>{profile?.username || 'Loading...'}</Text>
        <TouchableOpacity onPress={() => setShowFriends(true)} style={styles.friendsCounter}>
          <Text style={styles.friendsText}>{friends.length} Friends</Text>
        </TouchableOpacity>
      </View>

      {friendRequests.length > 0 && (
        <View style={styles.requestsSection}>
          <Text style={styles.sectionTitle}>Friend Requests</Text>
          {friendRequests.map(request => (
            <View key={request.id} style={styles.requestItem}>
              <Text>{request.username}</Text>
              <Button
                title="Accept"
                onPress={() => handleAcceptFriendRequest(request.id)}
              />
            </View>
          ))}
        </View>
      )}

      <Modal
        visible={showFriends}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFriends(false)}
      >
        <View style={styles.modalView}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Friends</Text>
            <FlatList
              data={friends}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <Text style={styles.friendItem}>{item.username}</Text>
              )}
            />
            <Button title="Close" onPress={() => setShowFriends(false)} />
          </View>
        </View>
      </Modal>

      <Text style={styles.sectionTitle}>My Posts & Collaborations</Text>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={item => item.id}
        style={styles.feed}
      />

      <Button title="Logout" onPress={handleLogout} color="red" />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold'
  },
  friendsCounter: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 20
  },
  friendsText: {
    fontWeight: '500'
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 10
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
  modalView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 20,
    width: '80%',
    maxHeight: '80%'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center'
  },
  friendItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  feed: {
    flex: 1
  },
  postContainer: {
    marginBottom: 20,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    overflow: 'hidden'
  },
  postHeader: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  collaborators: {
    color: '#666',
    flex: 1
  },
  postImage: {
    width: '100%',
    height: 300,
    resizeMode: 'cover'
  },
  caption: {
    padding: 10
  }
});

