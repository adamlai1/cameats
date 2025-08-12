import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { db } from '../firebase';
import { useTheme } from './contexts/ThemeContext';

export default function FriendProfile() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFriendProfile = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        console.error('User profile not found');
        return;
      }

      const userData = userDoc.data();
      setProfile({
        id: userDoc.id,
        ...userData
      });

      // Show profile immediately, then load posts
      setLoading(false);

      // Fetch all posts and filter client-side
      const postsQuery = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(postsQuery);
      const allPosts = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Ensure like state is always properly initialized
          bitedBy: Array.isArray(data.bitedBy) ? data.bitedBy : [],
          bites: typeof data.bites === 'number' ? data.bites : 0
        };
      });

      // Filter posts where this user is either an owner or creator
      const userPosts = allPosts.filter(post => {
        const isOwner = post.postOwners?.includes(userId);
        const isCreator = post.userId === userId;
        return isOwner || isCreator;
      });

      // Deduplicate posts by ID to prevent duplicate keys
      const deduplicatedPosts = userPosts.filter((post, index, self) => 
        self.findIndex(p => p.id === post.id) === index
      );

      setPosts(deduplicatedPosts);
    } catch (error) {
      console.error('Error fetching friend profile:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFriendProfile();
  }, [userId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFriendProfile();
  };

  const handlePostPress = async (post) => {
    const postIndex = posts.findIndex(p => p.id === post.id);
    
    try {
      // Pass essential data to ProfilePostsView for fresh data fetching
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
          username: profile?.username || 'Unknown'
        }
      });
    } catch (error) {
      console.error('Error navigating to posts:', error);
      Alert.alert('Error', 'Failed to open posts view');
    }
  };

  const handleUsernamePress = (ownerId) => {
    if (ownerId === userId) return; // Don't navigate if clicking current profile
    router.push({
      pathname: '/FriendProfile',
      params: { userId: ownerId }
    });
  };

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

  const Header = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.username}>@{profile?.username}</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.profileInfo}>
        <View style={styles.profilePicContainer}>
          <View style={styles.profilePic}>
            {profile?.profilePicUrl ? (
              <Image 
                source={{ uri: profile.profilePicUrl }} 
                style={styles.profilePicImage} 
              />
            ) : (
              <View style={[styles.profilePic, styles.defaultProfilePic]}>
                <Ionicons name="person" size={40} color={theme.textSecondary} />
              </View>
            )}
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{posts.length}</Text>
            <Text style={styles.statLabel}>Meals</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{profile?.friends?.length || 0}</Text>
            <Text style={styles.statLabel}>Friends</Text>
          </View>
        </View>
      </View>

      <View style={styles.bioContainer}>
        {profile?.displayName && (
          <Text style={styles.displayName}>{profile.displayName}</Text>
        )}
        {profile?.bio ? (
          <Text style={styles.bio}>{profile.bio}</Text>
        ) : (
          <Text style={styles.noBio}>No bio yet</Text>
        )}
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={posts}
        renderItem={renderGridPost}
        keyExtractor={item => item.id}
        numColumns={3}
        ListHeaderComponent={Header}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
      />
    </SafeAreaView>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
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
  backButton: {
    padding: 5
  },
  headerRight: {
    width: 34 // Same width as back button for centering
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
    resizeMode: 'cover'
  },
  defaultProfilePic: {
    backgroundColor: theme.surfaceSecondary,
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
  gridImage: {
    width: Dimensions.get('window').width / 3 - 2,
    height: Dimensions.get('window').width / 3 - 2,
    margin: 1
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
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
    color: theme.text,
  }
}); 