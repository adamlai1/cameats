import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { db } from '../firebase';
import { useTheme } from './contexts/ThemeContext';

export default function FriendsList() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        console.error('User not found');
        return;
      }

      const userData = userDoc.data();
      const friendPromises = (userData.friends || []).map(friendId =>
        getDoc(doc(db, 'users', friendId))
      );
      const friendDocs = await Promise.all(friendPromises);
      const friendsList = friendDocs
        .filter(doc => doc.exists())
        .map(doc => ({
          id: doc.id,
          username: doc.data().username,
          displayName: doc.data().displayName,
          profilePicUrl: doc.data().profilePicUrl
        }));
      setFriends(friendsList);
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredFriends = friends.filter(friend =>
    (friend.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (friend.displayName && friend.displayName.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Friends</Text>
          <View style={styles.headerRight} />
        </View>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search friends..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredFriends}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.friendItem}
            onPress={() => {
              router.push({
                pathname: '/FriendProfile',
                params: { userId: item.id }
              });
            }}
          >
            {item.profilePicUrl ? (
              <Image
                source={{ uri: item.profilePicUrl }}
                style={styles.friendAvatar}
              />
            ) : (
              <View style={[styles.friendAvatar, styles.defaultAvatar]}>
                <Ionicons name="person" size={30} color={theme.textSecondary} />
              </View>
            )}
            <View style={styles.friendInfo}>
              <Text style={styles.friendName}>{item.displayName || item.username}</Text>
              <Text style={styles.friendUsername}>@{item.username}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.friendsList}
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
    borderBottomWidth: 1,
    borderBottomColor: theme.border
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15
  },
  backButton: {
    padding: 5
  },
  headerRight: {
    width: 34
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text
  },
  searchContainer: {
    padding: 15
  },
  searchInput: {
    backgroundColor: theme.surface,
    padding: 12,
    borderRadius: 10,
    fontSize: 16,
    color: theme.text
  },
  friendsList: {
    paddingHorizontal: 15
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border
  },
  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15
  },
  defaultAvatar: {
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center'
  },
  friendInfo: {
    flex: 1
  },
  friendName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.text
  },
  friendUsername: {
    fontSize: 14,
    color: theme.textSecondary
  }
}); 