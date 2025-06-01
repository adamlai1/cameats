// app/PostScreen.js

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
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
import { auth, db, storage } from '../../firebase';

export default function PostScreen() {
  const [image, setImage] = useState(null);
  const [caption, setCaption] = useState('');
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const router = useRouter();

  useEffect(() => {
    (async () => {
      // Request permissions
      const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
      const mediaStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (cameraStatus.status !== 'granted') Alert.alert('Camera permission is required.');
      if (mediaStatus.status !== 'granted') Alert.alert('Media library permission is required.');

      // Fetch friends list
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
      }
    })();
  }, []);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.2,  // Reduced quality
      allowsEditing: true,
      aspect: [4, 3]
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const takePhoto = async () => {
    let result = await ImagePicker.launchCameraAsync({ 
      allowsEditing: true,
      quality: 0.2,  // Reduced quality
      aspect: [4, 3]
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

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
    if (!image) return Alert.alert('No image selected.');
    setUploading(true);
    setProgress(0);
    try {
      // Get current user's details first
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (!userDoc.exists()) {
        setUploading(false);
        return Alert.alert('Error', 'User profile not found');
      }
      const username = userDoc.data().username;

      // Handle image upload
      console.log('Fetching image...');
      const response = await fetch(image);
      console.log('Converting to blob...');
      const blob = await response.blob();
      console.log('Blob size:', blob.size);

      if (blob.size > 10 * 1024 * 1024) {
        setUploading(false);
        return Alert.alert('Error', 'File too large. Max size is 10MB.');
      }

      // Create unique filename with user ID
      const timestamp = Date.now();
      const filename = `images/${auth.currentUser.uid}_${timestamp}.jpg`;
      console.log('Creating storage reference:', filename);
      const storageRef = ref(storage, filename);

      try {
        // Upload the blob directly
        console.log('Starting upload...');
        await uploadBytes(storageRef, blob);
        console.log('Upload completed');

        // Get the download URL
        console.log('Getting download URL...');
        const url = await getDownloadURL(storageRef);
        console.log('Got download URL:', url);

        // Create the post
        console.log('Creating post document...');
        
        // Get all owners' user data
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
            displayName: doc.data().displayName || doc.data().username // Fallback to username if displayName is undefined
          }));

        // Validate that we have at least the current user as an owner
        if (!owners.length) {
          console.error('No valid owners found for post');
          setUploading(false);
          Alert.alert('Error', 'Failed to create post. Please try again.');
          return;
        }

        const postData = {
          imageUrl: url,
          caption: caption || '', // Ensure caption is never undefined
          userId: auth.currentUser.uid, // Keep the original creator's ID
          username: owners.find(owner => owner.id === auth.currentUser.uid)?.username || 'Unknown', // Fallback username
          owners: owners, // Store full owner info
          postOwners: owners.map(owner => owner.id), // Keep array of IDs for querying
          createdAt: serverTimestamp(),
        };
        
        // Validate post data
        const hasRequiredFields = postData.imageUrl && postData.userId && postData.username && 
                                Array.isArray(postData.postOwners) && postData.postOwners.length > 0;
        
        if (!hasRequiredFields) {
          console.error('Invalid post data:', postData);
          setUploading(false);
          Alert.alert('Error', 'Missing required post information. Please try again.');
          return;
        }
        
        console.log('Post data:', postData);
        await addDoc(collection(db, 'posts'), postData);

        Alert.alert('Success', 'Post uploaded successfully!');
        setImage(null);
        setCaption('');
        setSelectedFriends([]);
        setProgress(0);
        setUploading(false);
        router.replace('/tabs/FeedScreen');
      } catch (uploadError) {
        console.error('Upload/Post creation error:', uploadError);
        console.error('Error code:', uploadError.code);
        console.error('Error message:', uploadError.message);
        setUploading(false);
        Alert.alert('Error', 'Failed to upload image. Please check your internet connection and try again.');
      }
    } catch (error) {
      console.error('Initial setup error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      setUploading(false);
      Alert.alert('Error', 'Failed to prepare upload. Please try again.');
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
            <View style={styles.scrollContainer}>
      <Text style={styles.title}>Create a Post</Text>
              
              <View style={styles.imageSection}>
                <View style={styles.buttonContainer}>
      <Button title="Take a Photo" onPress={takePhoto} />
      <Button title="Pick an Image" onPress={pickImage} />
                </View>
                {image && (
                  <View style={styles.imageContainer}>
                    <Image source={{ uri: image }} style={styles.image} />
                    <TouchableOpacity 
                      style={styles.closeButton}
                      onPress={() => setImage(null)}
                    >
                      <Ionicons name="close-circle" size={32} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

      {uploading && (
                <Progress.Bar progress={progress} width={200} style={styles.progressBar} />
      )}

              <TextInput 
                placeholder="Add a caption..." 
                value={caption} 
                onChangeText={setCaption} 
                style={styles.input}
                multiline
              />

              <View style={styles.friendsSection}>
                <Text style={styles.subtitle}>Tag Friends:</Text>
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
                        <Text style={[
                          styles.friendName,
                          selectedFriends.some(f => f.id === item.id) && styles.selectedText
                        ]}>
                          {item.username}
                        </Text>
                      </TouchableOpacity>
                    )}
                    style={styles.friendsList}
                    scrollEnabled={true}
                    nestedScrollEnabled={true}
                  />
                ) : (
                  <Text style={styles.noFriendsText}>Add some friends to tag them in your posts!</Text>
                )}
              </View>
            </View>

            <View style={styles.bottomButton}>
              <Button 
                title={uploading ? 'Uploading...' : 'Post'} 
                onPress={uploadPost} 
                disabled={uploading} 
              />
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
    flex: 1,
    backgroundColor: '#fff'
  },
  scrollContainer: {
    flex: 1,
    padding: 20,
    paddingBottom: 80 // Add padding to avoid overlap with bottom button
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center'
  },
  imageSection: {
    alignItems: 'center',
    marginBottom: 20
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 10
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: 250,
    height: 250,
    borderRadius: 10
  },
  closeButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    padding: 0,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  progressBar: {
    alignSelf: 'center',
    marginVertical: 10
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 10,
    marginBottom: 20,
    minHeight: 100,
    textAlignVertical: 'top'
  },
  friendsSection: {
    marginBottom: 20,
    maxHeight: 200 // Limit the height of the friends section
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10
  },
  friendsList: {
    flexGrow: 0 // Prevent the list from expanding indefinitely
  },
  friendItem: {
    padding: 10,
    borderRadius: 8,
    marginVertical: 4,
    backgroundColor: '#f5f5f5'
  },
  selectedFriend: {
    backgroundColor: '#e3f2fd'
  },
  friendName: {
    fontSize: 16
  },
  selectedText: {
    color: '#1976d2',
    fontWeight: 'bold'
  },
  noFriendsText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic'
  },
  bottomButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#ddd'
  }
});
