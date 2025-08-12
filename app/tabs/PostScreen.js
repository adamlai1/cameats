// app/tabs/PostScreen.js

import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    LogBox,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { useTheme } from '../contexts/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const IMAGE_SIZE = SCREEN_WIDTH; // Fill full width for a larger preview

const PostScreen = forwardRef((props, ref) => {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [selectedImages, setSelectedImages] = useState([]);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraType, setCameraType] = useState('back'); // 'back' | 'front'
  const [isCameraReady, setIsCameraReady] = useState(false);
  const cameraRef = useRef(null);

  // Expose takePhoto function to parent component
  useImperativeHandle(ref, () => ({
    takePhoto: takePhoto,
    clearImages: () => {
      setSelectedImages([]);
      setHasNavigated(false);
    }
  }), []);

  useEffect(() => {
    // Suppress VirtualizedLists warning using LogBox
    LogBox.ignoreLogs([
      'VirtualizedLists should never be nested inside plain ScrollViews',
      'VirtualizedLists should never be nested',
      'VirtualizedList',
      'ScrollView'
    ]);

    // Suppress VirtualizedLists warning for DraggableFlatList
    const originalWarn = console.warn;
    const originalError = console.error;
    
    console.warn = (...args) => {
      const message = args[0];
      if (
        message?.includes && (
          message.includes('VirtualizedLists should never be nested') ||
          message.includes('VirtualizedList') ||
          message.includes('ScrollView') ||
          message.includes('windowing and other functionality')
        )
      ) {
        return; // Suppress the warning
      }
      originalWarn(...args);
    };

    console.error = (...args) => {
      const message = args[0];
      if (
        message?.includes && (
          message.includes('VirtualizedLists should never be nested') ||
          message.includes('VirtualizedList') ||
          message.includes('ScrollView') ||
          message.includes('windowing and other functionality')
        )
      ) {
        return; // Suppress the error
      }
      originalError(...args);
    };

    (async () => {
      // Request camera permission on mount if not asked yet
      try {
        if (!permission) {
          await requestPermission();
        }
      } catch (e) {
        // ignore
      }
      // Media library
      const mediaStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (mediaStatus.status !== 'granted') Alert.alert('Media library permission is required.');
    })();

    return () => {
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  // Track focus/unfocus to detect navigation attempts
  useFocusEffect(
    useCallback(() => {
      // Reset navigation flag when screen comes into focus
      setHasNavigated(false);
      
      return () => {
        // Screen is losing focus
        if (selectedImages.length > 0 && !hasNavigated) {
          // User is trying to leave with unsaved images
          // Note: We can't prevent navigation here, but we could show a toast
          console.log('User left post screen with unsaved images');
        }
      };
    }, [selectedImages.length, hasNavigated])
  );

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
    try {
      if (!cameraRef.current || !isCameraReady) return;
      const photo = await cameraRef.current.takePictureAsync();
      if (photo?.uri) {
        setSelectedImages(prev => [photo.uri, ...prev].slice(0, 10));
      }
    } catch (e) {
      console.warn('Failed to capture photo:', e);
    }
  };

  const removeImage = (uri) => {
    setSelectedImages(prev => prev.filter(imageUri => imageUri !== uri));
  };
        
  const handleNext = () => {
    if (selectedImages.length === 0) {
      Alert.alert('Error', 'Please select at least one image');
      return;
    }
    
    // Mark that user intentionally navigated
    setHasNavigated(true);
        
    router.push({
      pathname: '/PostDetails',
      params: { imageUris: JSON.stringify(selectedImages) }
    });
    
    // Don't clear images immediately - preserve content for when user comes back
  };

  const renderSelectedImage = ({ item, index, drag, isActive }) => {
    const isFirst = index === 0;
    const isLast = index === selectedImages.length - 1;
    
    return (
      <View style={[
        styles.imageContainer, 
        isActive && styles.draggingImage,
        isFirst && styles.firstImage,
        isLast && styles.lastImage
      ]}>
        <TouchableOpacity
          style={styles.imageWrapper}
          onLongPress={drag}
          disabled={isActive}
          activeOpacity={1}
        >
          <Image source={{ uri: item.uri }} style={styles.selectedImage} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.removeButton}
          onPress={() => removeImage(item.uri)}
          activeOpacity={0.7}
        >
          <Ionicons name="close-circle" size={24} color="#ff3b30" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Create a Post</Text>
        <View style={styles.headerRight}>
          {selectedImages.length > 0 && (
            <>
              <TouchableOpacity 
                onPress={() => setSelectedImages([])}
                style={styles.clearButton}
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
              <Text style={styles.imageCount}>{selectedImages.length}/10</Text>
            </>
          )}
        </View>
      </View>
              
      <View style={styles.contentContainer}>
        {permission?.granted ? (
          <View style={styles.cameraWrapper}>
            <CameraView
              ref={cameraRef}
              facing={cameraType}
              style={styles.camera}
              onCameraReady={() => setIsCameraReady(true)}
            />
            {/* Overlay controls */}
            <View style={styles.cameraControls}>
              <TouchableOpacity onPress={pickImages} style={styles.smallControlButton}>
                <Ionicons name="images" size={24} color={theme.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={takePhoto} style={styles.shutterButton} />
              <TouchableOpacity
                onPress={() => setCameraType(prev => (prev === 'back' ? 'front' : 'back'))}
                style={styles.smallControlButton}
              >
                <Ionicons name="camera-reverse" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="camera" size={80} color={theme.textSecondary} />
            <Text style={styles.emptyText}>Camera permission needed</Text>
            <TouchableOpacity
              onPress={async () => { await requestPermission(); }}
              style={[styles.actionButton, { marginTop: 16 }]}
            >
              <Text style={styles.actionButtonText}>Enable Camera</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Selected images strip */}
        {selectedImages.length > 0 && (
          <View style={styles.selectedStrip}>
            <DraggableFlatList
              data={selectedImages.map((uri) => ({ uri, key: uri }))}
              renderItem={renderSelectedImage}
              keyExtractor={(item) => item.key}
              onDragEnd={({ data }) => {
                setSelectedImages(data.map(item => item.uri));
              }}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.imageList}
              scrollEnabled={true}
              nestedScrollEnabled={true}
              activationDistance={0}
              onActivateTimeoutMS={100}
              removeClippedSubviews={false}
              animationConfig={{
                damping: 100,
                mass: 0.1,
                stiffness: 500,
                restDisplacementThreshold: 0.001,
                restSpeedThreshold: 0.001,
              }}
              extraData={selectedImages.length}
            />
          </View>
        )}
      </View>

      <View style={styles.bottomActions}>
        {selectedImages.length > 0 && (
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
          >
            <Text style={styles.nextButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
});

const getStyles = (theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text
  },
  imageCount: {
    fontSize: 16,
    color: theme.textSecondary,
    fontWeight: '500'
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center'
  },
  selectedImagesContainer: {
    flex: 1,
    justifyContent: 'center'
  },
  cameraWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  camera: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 0,
    overflow: 'hidden'
  },
  cameraControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 24
  },
  shutterButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.6)'
  },
  smallControlButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  selectedStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 8,
    backgroundColor: theme.overlay
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40
  },
  emptyText: {
    fontSize: 18,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 16
  },
  imageList: {
    alignItems: 'center'
  },
  imageContainer: {
    position: 'relative',
    marginRight: 8,
    paddingTop: 12,
    paddingRight: 12
  },
  firstImage: {
    marginLeft: 0
  },
  lastImage: {
    marginRight: 0
  },
  imageWrapper: {
    position: 'relative'
  },
  selectedImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 12
  },
  removeButton: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: theme.surface,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2
  },
  draggingImage: {
    opacity: 0.9,
    zIndex: 1000,
    elevation: 5
  },
  bottomActions: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16
  },
  actionButton: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.surfaceSecondary,
    borderRadius: 12,
    minWidth: 100,
    borderWidth: 1,
    borderColor: theme.border
  },
  actionButtonText: {
    color: theme.primary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4
  },
  nextButton: {
    backgroundColor: theme.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600'
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  clearButton: {
    padding: 8,
    backgroundColor: theme.surfaceSecondary,
    borderRadius: 8
  },
  clearButtonText: {
    color: theme.primary,
    fontSize: 14,
    fontWeight: '600'
  }
});

export default PostScreen;
