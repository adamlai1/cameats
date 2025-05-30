// app/ProfileScreen.js

import { useRouter } from 'expo-router';
import { arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, Button, FlatList, Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { auth, db } from '../firebase';

export default function ProfileScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [friendUsername, setFriendUsername] = useState('');
  const [friendsList, setFriendsList] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [posts, setPosts] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUsername(data.username || '');
          setEmail(data.email || '');

          // Fetch friends' usernames
          if (data.friends && data.friends.length > 0) {
            const friendDocs = await Promise.all(data.friends.map(uid => getDoc(doc(db, 'users', uid))));
            const friends = friendDocs
              .filter(doc => doc.exists())
              .map(doc => ({ uid: doc.id, username: doc.data().username }));
            setFriendsList(friends);
          }

          // Fetch friend requests' usernames
          if (data.friendRequests && data.friendRequests.length > 0) {
            const requestDocs = await Promise.all(data.friendRequests.map(uid => getDoc(doc(db, 'users', uid))));
            const requests = requestDocs
              .filter(doc => doc.exists())
              .map(doc => ({ uid: doc.id, username: doc.data().username }));
            setFriendRequests(requests);
          }

          // Fetch posts (own + tagged)
          const postsRef = collection(db, 'posts');
          const q = query(postsRef, where('userId', '==', auth.currentUser.uid));
          const q2 = query(postsRef, where('tags', 'array-contains', data.username));

          const [createdPostsSnapshot, taggedPostsSnapshot] = await Promise.all([getDocs(q), getDocs(q2)]);
          const createdPosts = createdPostsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const taggedPosts = taggedPostsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          const allPosts = [...createdPosts, ...taggedPosts].filter(
            (post, index, self) => index === self.findIndex(p => p.id === post.id)
          );

          // Sort posts chronologically (newest first)
          allPosts.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
          setPosts(allPosts);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };

    fetchProfile();
  }, []);

  const handleSendFriendRequest = async () => {
    try {
      if (friendUsername.trim() === '') return Alert.alert('Enter a username');
      const q = query(collection(db, 'users'), where('username', '==', friendUsername.trim()));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return Alert.alert('User not found');
      const friendDoc = snapshot.docs[0];
      const friendId = friendDoc.id;
      if (friendId === auth.currentUser.uid) return Alert.alert('You cannot add yourself');

      await updateDoc(doc(db, 'users', friendId), { friendRequests: arrayUnion(auth.currentUser.uid) });
      Alert.alert('Friend request sent!');
      setFriendUsername('');
    } catch (error) {
      console.error('Send friend request error:', error);
      Alert.alert('Error sending friend request', error.message);
    }
  };

  const handleAcceptFriendRequest = async (fromUid) => {
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        friends: arrayUnion(fromUid),
        friendRequests: arrayRemove(fromUid),
      });
      await updateDoc(doc(db, 'users', fromUid), { friends: arrayUnion(auth.currentUser.uid) });
      Alert.alert('Friend added!');
      setFriendRequests(prev => prev.filter(req => req.uid !== fromUid));
      setFriendsList(prev => [...prev, { uid: fromUid, username: friendRequests.find(r => r.uid === fromUid)?.username }]);
    } catch (error) {
      console.error('Accept friend error:', error);
      Alert.alert('Error accepting friend', error.message);
    }
  };

  const renderPost = ({ item }) => (
    <View style={styles.post}>
      <Image source={{ uri: item.imageUrl }} style={styles.image} />
      <Text style={styles.username}>By: {item.username || 'Unknown'}</Text>
      <Text>{item.caption}</Text>
      {item.tags && item.tags.length > 0 && <Text>Tags: {item.tags.join(', ')}</Text>}
      <Text style={styles.timestamp}>{item.createdAt?.toDate?.().toLocaleString() || ''}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Profile</Text>
      <Text>Username: {username}</Text>
      <Text>Email: {email}</Text>

      <Text style={styles.subtitle}>Friends:</Text>
      {friendsList.length > 0 ? (
        friendsList.map((f, i) => <Text key={i}>{f.username} (uid: {f.uid})</Text>)
      ) : <Text>No friends yet</Text>}

      <TextInput placeholder="Enter friend's username" value={friendUsername} onChangeText={setFriendUsername} style={styles.input} />
      <Button title="Send Friend Request" onPress={handleSendFriendRequest} />

      <Text style={styles.subtitle}>Pending Friend Requests:</Text>
      {friendRequests.length > 0 ? (
        friendRequests.map((r, i) => (
          <View key={i} style={styles.request}>
            <Text>Request from: {r.username}</Text>
            <Button title="Accept" onPress={() => handleAcceptFriendRequest(r.uid)} />
          </View>
        ))
      ) : <Text>No pending requests</Text>}

      <Text style={styles.subtitle}>Your Posts (Created or Tagged):</Text>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      <Button title="Back to Home" onPress={() => router.push('/')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', padding: 20 },
  title: { fontSize: 24, marginBottom: 20 },
  subtitle: { fontSize: 18, marginTop: 20, fontWeight: 'bold' },
  input: { borderWidth: 1, padding: 10, width: '80%', marginVertical: 10 },
  request: { marginVertical: 5, alignItems: 'center' },
  post: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 10, marginVertical: 10, width: '100%' },
  image: { width: '100%', height: 200, borderRadius: 10 },
  username: { fontWeight: 'bold', marginTop: 5 },
  timestamp: { fontSize: 12, color: 'gray', marginTop: 5 },
});
