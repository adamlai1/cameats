// app/tabs/PostScreen.js

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
    Alert,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

export default function PostScreen() {
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
    let result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.2,
      allowsEditing: true,
      aspect: [4, 3]
    });
    
    if (!result.canceled) {
      router.push({
        pathname: '/PostDetails',
        params: { imageUri: result.assets[0].uri }
      });
    }
  };

  const takePhoto = async () => {
    let result = await ImagePicker.launchCameraAsync({ 
      allowsEditing: true,
      quality: 0.2,
      aspect: [4, 3]
    });
    
    if (!result.canceled) {
      router.push({
        pathname: '/PostDetails',
        params: { imageUri: result.assets[0].uri }
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Create a Post</Text>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={takePhoto}>
            <Ionicons name="camera" size={32} color="#fff" />
            <Text style={styles.buttonText}>Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={pickImage}>
            <Ionicons name="images" size={32} color="#fff" />
            <Text style={styles.buttonText}>Choose from Gallery</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 40,
    color: '#333'
  },
  buttonContainer: {
    width: '100%',
    gap: 20,
    alignItems: 'center'
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 20,
    borderRadius: 15,
    width: '80%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600'
  }
});
