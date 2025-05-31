// app/FeedScreen.js

import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { FlatList, Image, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { auth, db } from '../../firebase';

export default function FeedScreen() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPosts = async () => {
    try {
      const currentUserId = auth.currentUser.uid;
      const userDoc = await getDoc(doc(db, 'users', currentUserId));

      if (!userDoc.exists()) {
        console.error('User profile not found');
        return;
      }

      const friends = userDoc.data().friends || [];
      const filterIds = [currentUserId, ...friends];

      if (filterIds.length === 0) {
        setPosts([]);
        return;
      }

      const chunkSize = 10;
      let allPosts = [];

      for (let i = 0; i < filterIds.length; i += chunkSize) {
        const chunk = filterIds.slice(i, i + chunkSize);
        const q = query(collection(db, 'posts'), where('userId', 'in', chunk), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const postsChunk = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allPosts = [...allPosts, ...postsChunk];
      }

      setPosts(allPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  useEffect(() => {
    setLoading(true);
    fetchPosts().finally(() => setLoading(false));
  }, []);

  const renderItem = ({ item }) => (
    <View style={styles.postContainer}>
      <Image source={{ uri: item.imageUrl }} style={styles.image} />
      <Text style={styles.username}>{item.username || 'Unknown'} - {item.createdAt?.toDate().toLocaleString() || ''}</Text>
      <Text style={styles.caption}>{item.caption}</Text>
      {item.taggedFriends && item.taggedFriends.length > 0 && (
        <Text style={styles.tags}>
          With: {item.taggedFriends.map(friend => friend.username).join(', ')}
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Feed</Text>
      {loading ? <Text>Loading...</Text> : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#000"
              title="Pull to refresh"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 50, paddingHorizontal: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  postContainer: { marginBottom: 20, borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 10 },
  image: { width: '100%', height: 200, borderRadius: 10 },
  username: { fontWeight: 'bold', marginTop: 5 },
  caption: { fontSize: 16, marginTop: 10 },
  tags: { fontSize: 14, marginTop: 5, color: 'gray' },
});
