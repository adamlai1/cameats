import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import * as Progress from 'react-native-progress';
import { auth, db, storage } from '../firebase';

export default function PostDetails() {
  const { imageUri } = useLocalSearchParams();
  const router = useRouter();
  
  const [caption, setCaption] = useState('');
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Fetch friends list
    const fetchFriends = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
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
        }
      } catch (error) {
        console.error('Error fetching friends:', error);
        Alert.alert('Error', 'Failed to load friends list');
      }
    };

    fetchFriends();
  }, []);

  const toggleFriend = (friend) => {
    setSelectedFriends(prev => {
      const isSelected = prev.some(f => f.id === friend.id);
      if (isSelected) {
        return prev.filter(f => f.id !== friend.id);
      } else {
        return [...prev, friend];
      }
    });
  };

  const uploadPost = async () => {
    if (!imageUri) return Alert.alert('Error', 'No image selected');
    setUploading(true);
    setProgress(0);

    try {
      // Get current user's details
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (!userDoc.exists()) {
        setUploading(false);
        return Alert.alert('Error', 'User profile not found');
      }

      // Upload image
      const response = await fetch(imageUri);
      const blob = await response.blob();

      if (blob.size > 10 * 1024 * 1024) {
        setUploading(false);
        return Alert.alert('Error', 'File too large. Max size is 10MB.');
      }

      const timestamp = Date.now();
      const filename = `images/${auth.currentUser.uid}_${timestamp}.jpg`;
      const storageRef = ref(storage, filename);

      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      // Get owner information
      const ownerPromises = [
        getDoc(doc(db, 'users', auth.currentUser.uid)),
        ...selectedFriends.map(friend => getDoc(doc(db, 'users', friend.id)))
      ];
      const ownerDocs = await Promise.all(ownerPromises);
      
      const owners = ownerDocs
        .filter(doc => doc.exists())
        .map(doc => ({
          id: doc.id,
          username: doc.data().username,
          displayName: doc.data().displayName || doc.data().username
        }));

      if (!owners.length) {
        setUploading(false);
        return Alert.alert('Error', 'Failed to create post');
      }

      // Create post
      const postData = {
        imageUrl: url,
        caption: caption || '',
        userId: auth.currentUser.uid,
        username: owners.find(owner => owner.id === auth.currentUser.uid)?.username || 'Unknown',
        owners: owners,
        postOwners: owners.map(owner => owner.id),
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'posts'), postData);

      Alert.alert('Success', 'Post uploaded successfully!');
      router.replace('/tabs/FeedScreen');
    } catch (error) {
      console.error('Error uploading post:', error);
      setUploading(false);
      Alert.alert('Error', 'Failed to upload post. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={24} color="#000" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>New Post</Text>
              <TouchableOpacity 
                onPress={uploadPost}
                disabled={uploading}
                style={[styles.postButton, uploading && styles.disabledButton]}
              >
                <Text style={styles.postButtonText}>
                  {uploading ? 'Posting...' : 'Post'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <Image source={{ uri: imageUri }} style={styles.image} />
              
              <TextInput
                placeholder="Write a caption..."
                value={caption}
                onChangeText={setCaption}
                style={styles.captionInput}
                multiline
              />

              <View style={styles.friendsSection}>
                <Text style={styles.sectionTitle}>Tag Friends</Text>
                {friends.length > 0 ? (
                  <FlatList
                    data={friends}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[
                          styles.friendItem,
                          selectedFriends.some(f => f.id === item.id) && styles.selectedFriend
                        ]}
                        onPress={() => toggleFriend(item)}
                      >
                        <Text style={styles.friendName}>{item.username}</Text>
                        {selectedFriends.some(f => f.id === item.id) && (
                          <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                        )}
                      </TouchableOpacity>
                    )}
                  />
                ) : (
                  <Text style={styles.noFriendsText}>
                    Add some friends to tag them in your posts!
                  </Text>
                )}
              </View>

              {uploading && (
                <View style={styles.progressContainer}>
                  <Progress.Bar progress={progress} width={200} />
                  <Text style={styles.progressText}>Uploading...</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff'
  },
  container: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600'
  },
  postButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 20
  },
  disabledButton: {
    opacity: 0.5
  },
  postButtonText: {
    color: '#fff',
    fontWeight: '600'
  },
  content: {
    flex: 1,
    padding: 16
  },
  image: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: 16
  },
  captionInput: {
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 12
  },
  friendsSection: {
    flex: 1
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f8f8f8',
    marginBottom: 8,
    borderRadius: 8
  },
  selectedFriend: {
    backgroundColor: '#e3f2fd'
  },
  friendName: {
    fontSize: 16
  },
  noFriendsText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    marginTop: 20
  },
  progressContainer: {
    alignItems: 'center',
    marginTop: 20
  },
  progressText: {
    marginTop: 8,
    color: '#666'
  }
}); 