// app/PostScreen.js

import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { useEffect, useState } from 'react';
import { Alert, Button, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
      quality: 0.7 
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const takePhoto = async () => {
    let result = await ImagePicker.launchCameraAsync({ 
      allowsEditing: true, 
      quality: 0.7 
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
      const response = await fetch(image);
      const blob = await response.blob();

      if (blob.size > 10 * 1024 * 1024) {
        setUploading(false);
        return Alert.alert('Error', 'File too large. Max size is 10MB.');
      }

      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const username = userDoc.exists() ? userDoc.data().username : 'Unknown';

      const filename = `images/${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);
      const uploadTask = uploadBytesResumable(storageRef, blob);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = snapshot.bytesTransferred / snapshot.totalBytes;
          setProgress(progress);
          console.log(`Upload is ${(progress * 100).toFixed(2)}% done`);
        },
        (error) => {
          console.error('Upload failed:', error);
          Alert.alert('Upload error', error.message);
          setUploading(false);
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, 'posts'), {
            imageUrl: url,
            caption,
            taggedFriends: selectedFriends.map(friend => ({
              id: friend.id,
              username: friend.username
            })),
            userId: auth.currentUser.uid,
            username,
            createdAt: serverTimestamp(),
          });

          Alert.alert('Post uploaded!');
          setImage(null);
          setCaption('');
          setSelectedFriends([]);
          setProgress(0);
          setUploading(false);
          router.replace('/tabs/FeedScreen');
        }
      );
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error uploading post', error.message);
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create a Post</Text>
      
      <View style={styles.imageSection}>
        <View style={styles.buttonContainer}>
          <Button title="Take a Photo" onPress={takePhoto} />
          <Button title="Pick an Image" onPress={pickImage} />
        </View>
        {image && <Image source={{ uri: image }} style={styles.image} />}
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
          />
        ) : (
          <Text style={styles.noFriendsText}>Add some friends to tag them in your posts!</Text>
        )}
      </View>

      <Button 
        title={uploading ? 'Uploading...' : 'Post'} 
        onPress={uploadPost} 
        disabled={uploading} 
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
  image: {
    width: 250,
    height: 250,
    borderRadius: 10
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
    marginBottom: 20
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10
  },
  friendsList: {
    maxHeight: 200
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
  }
});
