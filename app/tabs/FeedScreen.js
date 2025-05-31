// app/tabs/FeedScreen.js

import { useRouter } from 'expo-router';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { auth, db } from '../../firebase';

export default function FeedScreen() {
  const [posts, setPosts] = useState([]);
  const router = useRouter();

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      // Get current user's friends
      const userDoc = await getDocs(query(collection(db, 'users'), where('friends', 'array-contains', auth.currentUser.uid)));
      const friendIds = userDoc.docs.map(doc => doc.id);
      
      // Get posts where:
      // 1. User is a collaborator (creator or tagged)
      // 2. Post creator is a friend
      const postsQuery = query(
        collection(db, 'posts'),
        where('collaborators', 'array-contains', { id: auth.currentUser.uid }),
        orderBy('createdAt', 'desc')
      );
      
      const friendPostsQuery = query(
        collection(db, 'posts'),
        where('userId', 'in', friendIds),
        orderBy('createdAt', 'desc')
      );

      const [userPosts, friendPosts] = await Promise.all([
        getDocs(postsQuery),
        getDocs(friendPostsQuery)
      ]);

      // Combine and deduplicate posts
      const allPosts = [...userPosts.docs, ...friendPosts.docs]
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter((post, index, self) => 
          index === self.findIndex(p => p.id === post.id)
        )
        .sort((a, b) => b.createdAt - a.createdAt);

      setPosts(allPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  };

  const renderItem = ({ item }) => (
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
      <Text style={styles.title}>Feed</Text>
      <FlatList
        data={posts}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        style={styles.feed}
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20
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
  username: {
    fontWeight: 'bold',
    marginRight: 5
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
