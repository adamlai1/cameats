// app/FeedScreen.js

import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../../firebase';

export default function FeedScreen() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('detail'); // 'detail' or 'grid'

  const fetchPosts = async () => {
    try {
      // Get current user's friends first
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (!userDoc.exists()) {
        console.error('User profile not found');
        return;
      }

      const friends = userDoc.data().friends || [];
      const relevantUserIds = [auth.currentUser.uid, ...friends];
      console.log('Relevant user IDs:', relevantUserIds);

      // Get all posts and filter client-side
      const postsQuery = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(postsQuery);
      const allPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('All posts:', allPosts);

      // Filter posts that are relevant to the user (created by friends or self)
      const filteredPosts = allPosts.filter(post => {
        // Check new format (postOwners)
        const isRelevantPostOwner = post.postOwners?.some(ownerId => 
          relevantUserIds.includes(ownerId)
        );

        // Check old format (taggedFriends and original poster)
        const isRelevantTagged = post.taggedFriendIds?.some(taggedId => 
          relevantUserIds.includes(taggedId)
        );
        const isRelevantCreator = relevantUserIds.includes(post.userId);

        const isRelevant = isRelevantPostOwner || isRelevantTagged || isRelevantCreator;

        console.log('Post', post.id, {
          postOwners: post.postOwners,
          taggedFriendIds: post.taggedFriendIds,
          userId: post.userId,
          isRelevantPostOwner,
          isRelevantTagged,
          isRelevantCreator,
          isRelevant
        });

        return isRelevant;
      });

      console.log('Filtered posts:', filteredPosts);
      setPosts(filteredPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'detail' ? 'grid' : 'detail');
  };

  const renderDetailPost = ({ item }) => (
    <View style={styles.postContainer}>
      <View style={styles.postHeader}>
        <Text style={styles.username}>{item.username}</Text>
      </View>
      <Image 
        source={{ uri: item.imageUrl }} 
        style={styles.postImage}
        resizeMode="cover"
      />
      <View style={styles.postFooter}>
        <Text style={styles.caption}>{item.caption}</Text>
        {item.postOwners?.length > 1 ? (
          <Text style={styles.coOwners}>
            Co-owned with: {item.owners
              ?.filter(owner => owner.id !== item.userId)
              ?.map(owner => owner.username)
              ?.join(', ') || 'others'}
          </Text>
        ) : item.taggedFriendIds?.length > 0 ? (
          <Text style={styles.coOwners}>
            Tagged: {item.taggedFriends
              ?.map(friend => friend.username)
              ?.join(', ') || 'others'}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const renderGridPost = ({ item }) => (
    <TouchableOpacity 
      style={styles.gridItem}
      onPress={() => setViewMode('detail')}
    >
      <Image source={{ uri: item.imageUrl }} style={styles.gridImage} />
      {(item.postOwners?.length > 1 || item.taggedFriendIds?.length > 0) && (
        <View style={styles.coOwnedBadge}>
          <Ionicons name="people" size={12} color="white" />
        </View>
      )}
    </TouchableOpacity>
  );

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

  useEffect(() => {
    setLoading(true);
    fetchPosts().finally(() => setLoading(false));
  }, []);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={posts}
        renderItem={viewMode === 'detail' ? renderDetailPost : renderGridPost}
        keyExtractor={item => item.id}
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
      />
    </SafeAreaView>
  );
}

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
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10
  },
  username: {
    fontWeight: 'bold',
    fontSize: 16
  },
  postImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f5f5f5'
  },
  postFooter: {
    padding: 10
  },
  caption: {
    fontSize: 14,
    marginBottom: 5
  },
  coOwners: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic'
  },
  gridItem: {
    flex: 1/3,
    aspectRatio: 1,
    margin: 1,
    position: 'relative'
  },
  gridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f5f5f5'
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
  }
});
