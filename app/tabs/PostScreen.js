// app/tabs/PostScreen.js

import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  LogBox,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { PinchGestureHandler, State } from 'react-native-gesture-handler';
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
  const focusPoint = useRef(new Animated.Value(0)).current; // 0 hidden, 1 visible
  const [focusCoords, setFocusCoords] = useState({ x: IMAGE_SIZE / 2, y: IMAGE_SIZE / 2 });
  // Display zoom shown to the user in optical-equivalent scale (0.5x .. 50x)
  const [displayZoom, setDisplayZoom] = useState(1);
  const pinchStartDisplayZoomRef = useRef(1);
  // Convert display (0.5x..50x) to CameraView zoom 0..1 using logarithmic mapping
  const displayToCameraZoom = useCallback((dz) => {
    const maxDz = cameraType === 'front' ? 1 : 50;
    const clampedDz = Math.max(0.5, Math.min(maxDz, dz || 1));
    const denom = Math.log(maxDz / 0.5) || 1; // prevent divide-by-zero
    return Math.max(0, Math.min(1, Math.log(clampedDz / 0.5) / denom));
  }, [cameraType]);

  // When switching to front camera, lock zoom to 1.0x and disable any accumulated pinch state
  useEffect(() => {
    if (cameraType === 'front') {
      setDisplayZoom(1);
      pinchStartDisplayZoomRef.current = 1;
    }
  }, [cameraType]);

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
        // Screen is losing focus. Previously logged a debug message here; removed for cleaner logs.
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
        {selectedImages.length > 0 && (
          <View style={styles.headerRight}>
            <Text style={styles.imageCount}>{selectedImages.length}/10</Text>
          </View>
        )}
      </View>
              
      <View style={styles.contentContainer}>
        {permission?.granted ? (
          <View style={styles.cameraWrapper}>
            <PinchGestureHandler
              enabled={cameraType !== 'front'}
              onHandlerStateChange={({ nativeEvent }) => {
                if (nativeEvent.state === State.BEGAN) {
                  pinchStartDisplayZoomRef.current = displayZoom;
                } else if (
                  nativeEvent.state === State.END ||
                  nativeEvent.state === State.CANCELLED ||
                  nativeEvent.state === State.FAILED
                ) {
                  pinchStartDisplayZoomRef.current = displayZoom;
                }
              }}
              onGestureEvent={({ nativeEvent }) => {
                if (cameraType === 'front') return;
                const scale = nativeEvent.scale || 1;
                // Multiplicative pinch on display zoom (log scale): clamp 0.5x..50x
                const maxDz = cameraType === 'front' ? 1 : 50;
                const newDisplayZoom = Math.max(0.5, Math.min(maxDz, pinchStartDisplayZoomRef.current * Math.pow(scale, 1)));
                setDisplayZoom(newDisplayZoom);
              }}
            >
              <Pressable
                onPress={({ nativeEvent }) => {
                  if (!cameraRef.current) return;
                  // Get tap within camera view
                  const { locationX, locationY } = nativeEvent;
                  setFocusCoords({ x: locationX, y: locationY });
                  // Normalize to 0..1 for focus API if available
                  const normX = Math.max(0, Math.min(1, locationX / IMAGE_SIZE));
                  const normY = Math.max(0, Math.min(1, locationY / IMAGE_SIZE));
                  try {
                    if (cameraRef.current.setFocus) {
                      cameraRef.current.setFocus({ x: normX, y: normY });
                    }
                  } catch {}
                  // Animate focus indicator
                  focusPoint.setValue(0);
                  Animated.sequence([
                    Animated.timing(focusPoint, { toValue: 1, duration: 80, useNativeDriver: true }),
                    Animated.delay(500),
                    Animated.timing(focusPoint, { toValue: 0, duration: 180, useNativeDriver: true })
                  ]).start();
                }}
              >
                <View>
                  <CameraView
                    ref={cameraRef}
                    facing={cameraType}
                    zoom={cameraType === 'front' ? 0.05 : displayToCameraZoom(displayZoom)}
                    style={styles.camera}
                    onCameraReady={() => setIsCameraReady(true)}
                  />
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.focusRing,
                      {
                        left: focusCoords.x - 30,
                        top: focusCoords.y - 30,
                        opacity: focusPoint,
                        transform: [{ scale: focusPoint.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }]
                      }
                    ]}
                  />
                </View>
              </Pressable>
            </PinchGestureHandler>
            {/* Overlay controls */}
            <View style={styles.cameraControls}>
              <View style={styles.controlsLeft}>
                <TouchableOpacity onPress={pickImages} style={styles.smallControlButton}>
                  <Ionicons name="images" size={24} color={'#fff'} />
                </TouchableOpacity>
              </View>
              <View style={styles.controlsCenter}>
                <TouchableOpacity onPress={takePhoto} style={styles.shutterButton} />
              </View>
              <View style={styles.controlsRight}>
                <TouchableOpacity
                  onPress={() => setCameraType(prev => (prev === 'back' ? 'front' : 'back'))}
                  style={styles.smallControlButton}
                >
                  <Ionicons name="camera-reverse" size={24} color={'#fff'} />
                </TouchableOpacity>
              </View>
            </View>
            {/* Bottom-center zoom pill */}
            <View style={styles.bottomZoomContainer}>
              <TouchableOpacity
                onPress={() => {
                  if (cameraType === 'front') {
                    setDisplayZoom(1);
                  } else {
                    const isNearOneX = Math.abs(displayZoom - 1) < 0.05;
                    setDisplayZoom(isNearOneX ? 0.5 : 1);
                  }
                }}
                activeOpacity={0.7}
                style={styles.zoomInfoContainer}
              >
                <Text style={styles.zoomLabel}>{displayZoom.toFixed(1)}x</Text>
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
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  title: {
    display: 'none'
  },
  imageCount: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600'
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
  focusRing: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'transparent'
  },
  cameraControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24
  },
  controlsLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start'
  },
  controlsCenter: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  controlsRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12
  },
  zoomInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 16
  },
  zoomLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700'
  },
  bottomZoomContainer: {
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5
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
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  selectedStrip: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 8
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
    padding: 6
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
    width: 72,
    height: 72,
    borderRadius: 8
  },
  removeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 10,
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
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    position: 'absolute',
    bottom: 16,
    right: 16
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 14,
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
