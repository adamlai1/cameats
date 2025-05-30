// app/PostScreen.js

import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { useEffect, useState } from 'react';
import { Alert, Button, FlatList, Image, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Progress from 'react-native-progress';
import { auth, db, storage } from '../firebase';

export default function PostScreen() {
  const [image, setImage] = useState(null);
  const [caption, setCaption] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const router = useRouter();

  useEffect(() => {
    (async () => {
      const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
      const mediaStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (cameraStatus.status !== 'granted') Alert.alert('Camera permission is required.');
      if (mediaStatus.status !== 'granted') Alert.alert('Media library permission is required.');
    })();
  }, []);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const takePhoto = async () => {
    let result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const addTag = () => {
    if (tagInput.trim() !== '') {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (index) => {
    const updatedTags = [...tags];
    updatedTags.splice(index, 1);
    setTags(updatedTags);
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
            tags,
            userId: auth.currentUser.uid,
            username,
            createdAt: serverTimestamp(),
          });

          Alert.alert('Post uploaded!');
          setImage(null);
          setCaption('');
          setTags([]);
          setProgress(0);
          setUploading(false);
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
      <Button title="Take a Photo" onPress={takePhoto} />
      <Button title="Pick an Image" onPress={pickImage} />
      {image && <Image source={{ uri: image }} style={styles.image} />}

      {uploading && (
        <Progress.Bar progress={progress} width={200} style={{ marginVertical: 10 }} />
      )}

      <TextInput placeholder="Add a caption..." value={caption} onChangeText={setCaption} style={styles.input} />
      <TextInput placeholder="Tag a friend (type name)" value={tagInput} onChangeText={setTagInput} style={styles.input} />
      <Button title="Add Tag" onPress={addTag} />

      <FlatList
        data={tags}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item, index }) => (
          <View style={styles.tagItem}>
            <Text>{item}</Text>
            <Button title="Remove" onPress={() => removeTag(index)} />
          </View>
        )}
      />

      <Button title={uploading ? 'Uploading...' : 'Post'} onPress={uploadPost} disabled={uploading} />
      <Button title="Back to Home" onPress={() => router.push('/')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 20, marginBottom: 10 },
  image: { width: 250, height: 250, marginVertical: 10, borderRadius: 10 },
  input: { borderWidth: 1, padding: 10, width: '80%', marginVertical: 10 },
  tagItem: { flexDirection: 'row', alignItems: 'center', marginVertical: 5 },
});
