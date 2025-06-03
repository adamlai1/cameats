// app/tabs/PostScreen.js

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    Image,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const IMAGE_SIZE = SCREEN_WIDTH / 3;

export default function PostScreen() {
  const router = useRouter();
  const [selectedImages, setSelectedImages] = useState([]);

  useEffect(() => {
    (async () => {
      const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
      const mediaStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (cameraStatus.status !== 'granted') Alert.alert('Camera permission is required.');
      if (mediaStatus.status !== 'granted') Alert.alert('Media library permission is required.');
    })();
  }, []);

  const pickImages = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.2,
      allowsMultipleSelection: true,
      selectionLimit: 10,
      aspect: [1, 1]
    });
    
    if (!result.canceled) {
      const newImages = result.assets.map(asset => asset.uri);
      setSelectedImages(prev => [...prev, ...newImages].slice(0, 10));
    }
  };

  const takePhoto = async () => {
    let result = await ImagePicker.launchCameraAsync({ 
      allowsEditing: true,
      quality: 0.2,
      aspect: [1, 1]
    });
    
    if (!result.canceled) {
      setSelectedImages(prev => [...prev, result.assets[0].uri].slice(0, 10));
      }
  };

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };
        
  const handleNext = () => {
    if (selectedImages.length === 0) {
      Alert.alert('Error', 'Please select at least one image');
          return;
        }
        
    router.push({
      pathname: '/PostDetails',
      params: { imageUris: JSON.stringify(selectedImages) }
    });
  };

  const renderSelectedImage = ({ item, index }) => (
    <View style={styles.imageContainer}>
      <Image source={{ uri: item }} style={styles.selectedImage} />
      <TouchableOpacity 
        style={styles.removeButton}
        onPress={() => removeImage(index)}
      >
        <Ionicons name="close-circle" size={24} color="#ff3b30" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
    <View style={styles.container}>
      <Text style={styles.title}>Create a Post</Text>
              
        {selectedImages.length > 0 && (
          <View style={styles.selectedImagesContainer}>
            <FlatList
              data={selectedImages}
              renderItem={renderSelectedImage}
              keyExtractor={(_, index) => index.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.imageList}
            />
                  </View>
                )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={takePhoto}>
            <Ionicons name="camera" size={32} color="#fff" />
            <Text style={styles.buttonText}>Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={pickImages}>
            <Ionicons name="images" size={32} color="#fff" />
            <Text style={styles.buttonText}>Choose from Gallery</Text>
          </TouchableOpacity>

          {selectedImages.length > 0 && (
                      <TouchableOpacity
              style={[styles.button, styles.nextButton]} 
              onPress={handleNext}
                      >
              <Text style={styles.buttonText}>Next</Text>
              <Ionicons name="arrow-forward" size={24} color="#fff" />
                      </TouchableOpacity>
                    )}
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
    marginBottom: 20,
    color: '#333'
  },
  selectedImagesContainer: {
    width: '100%',
    marginBottom: 20
  },
  imageList: {
    gap: 10,
    paddingHorizontal: 10
  },
  imageContainer: {
    position: 'relative'
  },
  selectedImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 8
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12
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
  nextButton: {
    backgroundColor: '#34C759'
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600'
  }
});
