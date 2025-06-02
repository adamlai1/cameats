// app/FeedScreen.js

import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
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
  const [currentImageIndices, setCurrentImageIndices] = useState({}); // Track current image index for each post

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

        return isRelevant;
      });

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

  const handleScroll = (event, postId) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / Dimensions.get('window').width);
    setCurrentImageIndices(prev => ({
      ...prev,
      [postId]: index
    }));
  };

  const renderDetailPost = ({ item }) => (
    <View style={styles.postContainer}>
      <View style={styles.postHeader}>
        <Text style={styles.username}>
          {item.owners?.map(owner => owner.username).join(' • ')}
        </Text>
      </View>
      
      <View style={styles.imageGalleryContainer}>
        <FlatList
          data={item.imageUrls || [item.imageUrl]} // Support both old and new format
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
          onScroll={(e) => handleScroll(e, item.id)}
          scrollEventThrottle={16}
        />
        {(item.imageUrls?.length > 1 || false) && (
          <View style={styles.paginationDots}>
            {(item.imageUrls || []).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  index === (currentImageIndices[item.id] || 0) && styles.paginationDotActive
                ]}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.postFooter}>
        <Text style={styles.caption}>{item.caption}</Text>
        <Text style={styles.postDate}>
          {item.createdAt?.toDate().toLocaleString() || ''}
        </Text>
      </View>
    </View>
  );

  const renderGridPost = ({ item }) => (
    <TouchableOpacity 
      style={styles.gridItem}
      onPress={() => setViewMode('detail')}
    >
      <Image 
        source={{ uri: item.imageUrls?.[0] || item.imageUrl }} 
        style={styles.gridImage} 
      />
      {item.owners?.length > 1 && (
        <View style={styles.coOwnedBadge}>
          <Ionicons name="people" size={12} color="white" />
        </View>
      )}
      {item.imageUrls?.length > 1 && (
        <View style={styles.multipleImagesBadge}>
          <Ionicons name="images" size={12} color="white" />
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
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  username: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1976d2'
  },
  imageGalleryContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    backgroundColor: '#f5f5f5'
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
  postImage: {
    width: Dimensions.get('window').width,
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
  postDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 8
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
  }
});
