import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    FlatList,
    Image,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { db } from '../firebase';

export default function FriendProfile() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

        // Fetch user's posts
        const [ownPostsSnapshot, taggedPostsSnapshot] = await Promise.all([
          getDocs(query(
            collection(db, 'posts'),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
          )),
          getDocs(query(
            collection(db, 'posts'),
            where('taggedFriendIds', 'array-contains', userId),
            orderBy('createdAt', 'desc')
          ))
        ]);

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

        const allPosts = [...ownPosts, ...taggedPosts].sort((a, b) => {
          const dateA = a.createdAt?.toDate() || new Date(0);
          const dateB = b.createdAt?.toDate() || new Date(0);
          return dateB - dateA;
        });

        setPosts(allPosts);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching friend profile:', error);
        setLoading(false);
      }
    };

    fetchFriendProfile();
  }, [userId]);

  const renderPost = ({ item }) => (
    <View style={styles.postContainer}>
      <Image source={{ uri: item.imageUrl }} style={styles.postImage} />
      <Text style={styles.postCaption}>{item.caption}</Text>
    </View>
  );

  if (loading || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>@{profile.username}</Text>
        <View style={styles.headerRight} />
      </View>

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={() => (
          <View style={styles.profileHeader}>
            {profile.profilePicUrl ? (
              <Image source={{ uri: profile.profilePicUrl }} style={styles.profilePic} />
            ) : (
              <View style={[styles.profilePic, styles.defaultProfilePic]}>
                <Ionicons name="person" size={40} color="#666" />
              </View>
            )}
            <Text style={styles.displayName}>{profile.displayName || profile.username}</Text>
            <Text style={styles.username}>@{profile.username}</Text>
            {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

            <View style={styles.stats}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{posts.filter(p => p.isOwnPost).length}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{profile.friends?.length || 0}</Text>
                <Text style={styles.statLabel}>Friends</Text>
              </View>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  backButton: {
    padding: 5
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600'
  },
  headerRight: {
    width: 34 // Same width as back button for centering
  },
  profileHeader: {
    alignItems: 'center',
    padding: 20
  },
  profilePic: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15
  },
  defaultProfilePic: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  displayName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5
  },
  username: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15
  },
  bio: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 15,
    paddingHorizontal: 20
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee'
  },
  statItem: {
    alignItems: 'center'
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  statLabel: {
    fontSize: 14,
    color: '#666'
  },
  postContainer: {
    marginBottom: 15
  },
  postImage: {
    width: '100%',
    height: 300,
    resizeMode: 'cover'
  },
  postCaption: {
    padding: 15,
    fontSize: 14
  }
}); 