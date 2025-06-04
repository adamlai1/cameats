import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import * as Progress from 'react-native-progress';
import { auth, db, storage } from '../firebase';

const SCREEN_WIDTH = Dimensions.get('window').width;
const IMAGE_SIZE = SCREEN_WIDTH;

export default function PostDetails() {
  const { imageUris } = useLocalSearchParams();
  const router = useRouter();
  const scrollViewRef = useRef(null);
  
  const [caption, setCaption] = useState('');
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const images = JSON.parse(imageUris);

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
    if (!images || images.length === 0) return Alert.alert('Error', 'No images selected');
    setUploading(true);
    setProgress(0);

    try {
      // Get current user's details
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (!userDoc.exists()) {
        setUploading(false);
        return Alert.alert('Error', 'User profile not found');
      }

      // Upload all images
      const uploadPromises = images.map(async (imageUri, index) => {
        const response = await fetch(imageUri);
        const blob = await response.blob();

        if (blob.size > 10 * 1024 * 1024) {
          throw new Error(`Image ${index + 1} is too large. Max size is 10MB.`);
        }

        const timestamp = Date.now();
        const filename = `images/${auth.currentUser.uid}/${timestamp}_${index}.jpg`;
        const storageRef = ref(storage, filename);

        await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(storageRef);
        
        // Update progress
        setProgress((index + 1) / images.length);
        
        return url;
      });

      const imageUrls = await Promise.all(uploadPromises);

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
        imageUrls: imageUrls,
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

  const handleScroll = (event) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / SCREEN_WIDTH);
    setCurrentImageIndex(index);
    Keyboard.dismiss();
  };

  const handleCaptionFocus = () => {
    // Wait for keyboard to appear before scrolling
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: IMAGE_SIZE + 20,
        animated: true
      });
    }, 100);
  };

  const renderHeader = () => (
    <>
      <View style={styles.imageGalleryContainer}>
        <FlatList
          data={images}
          renderItem={({ item }) => (
            <Image source={{ uri: item }} style={styles.image} />
          )}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyExtractor={(_, index) => index.toString()}
        />
        {images.length > 1 && (
          <View style={styles.paginationDots}>
            {images.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  index === currentImageIndex && styles.paginationDotActive
                ]}
              />
            ))}
          </View>
        )}
      </View>
      
      <View style={styles.captionContainer}>
        <TextInput
          placeholder="Write a caption..."
          value={caption}
          onChangeText={setCaption}
          onFocus={handleCaptionFocus}
          style={styles.captionInput}
          multiline
          maxLength={2200}
        />
      </View>

      <Text style={styles.sectionTitle}>Tag Friends</Text>
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
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

        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={styles.scrollContent}
        >
          {renderHeader()}
          
          {friends.map(item => (
            <TouchableOpacity
              key={item.id}
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
          ))}
        </ScrollView>

        {uploading && (
          <View style={styles.progressContainer}>
            <Progress.Bar progress={progress} width={200} />
            <Text style={styles.progressText}>
              Uploading {Math.round(progress * 100)}%
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff'
  },
  keyboardAvoidingView: {
    flex: 1,
    backgroundColor: '#fff'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff'
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
    backgroundColor: '#fff'
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#fff'
  },
  imageGalleryContainer: {
    width: '100%',
    height: IMAGE_SIZE,
    position: 'relative'
  },
  image: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE
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
  captionContainer: {
    backgroundColor: '#fff',
    marginVertical: 10,
    marginHorizontal: 16,
    borderRadius: 8
  },
  captionInput: {
    fontSize: 16,
    minHeight: 100,
    maxHeight: 200,
    textAlignVertical: 'top',
    padding: 8
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    marginHorizontal: 16,
    marginTop: 10
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  selectedFriend: {
    backgroundColor: '#f0f0f0'
  },
  friendName: {
    fontSize: 16
  },
  noFriendsText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic'
  },
  progressContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -100 }, { translateY: -20 }],
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 20,
    borderRadius: 10
  },
  progressText: {
    color: '#fff',
    marginTop: 10
  }
}); 