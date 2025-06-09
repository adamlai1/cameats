import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
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
import LocationPicker from './components/LocationPicker';

const SCREEN_WIDTH = Dimensions.get('window').width;
const IMAGE_SIZE = SCREEN_WIDTH;

export default function PostDetails() {
  const { imageUris } = useLocalSearchParams();
  const router = useRouter();
  const scrollViewRef = useRef(null);
  
  const [caption, setCaption] = useState('');
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [hasScrolledToFriends, setHasScrolledToFriends] = useState(false);

  const images = JSON.parse(imageUris);

  useEffect(() => {
    // Suppress VirtualizedLists warnings
    const originalWarn = console.warn;
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

    // Auto-fetch nearest restaurant on component mount
    const autoSelectNearestRestaurant = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          
          // Mock nearest restaurant (you can replace with real API call)
          const nearestRestaurant = {
            id: 'nearest_1',
            name: 'The Local Bistro',
            vicinity: '123 Main St, Downtown',
            rating: 4.5,
            types: ['restaurant', 'fine_dining'],
            distance: 0.2
          };
          
          setSelectedLocation(nearestRestaurant);
        }
      } catch (error) {
        console.error('Error auto-selecting location:', error);
        // Don't show error to user, just silently fail
      }
    };

    autoSelectNearestRestaurant();

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
          
          // Get tagging frequency data
          const taggingFrequency = userData.friendTaggingFrequency || {};
          
          const friendsList = friendDocs
            .filter(doc => doc.exists())
            .map(doc => ({
              id: doc.id,
              username: doc.data().username,
              tagCount: taggingFrequency[doc.id] || 0
            }))
            .sort((a, b) => b.tagCount - a.tagCount); // Sort by tag frequency (most tagged first)
          
          setFriends(friendsList);
          setFilteredFriends(friendsList); // Initialize filtered list with all friends
        }
      } catch (error) {
        console.error('Error fetching friends:', error);
        Alert.alert('Error', 'Failed to load friends list');
      }
    };

    fetchFriends();

    return () => {
      console.warn = originalWarn;
    };
  }, []);

  // Add search handler
  const handleSearch = (text) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setFilteredFriends(friends); // Show all friends when search is empty
      return;
    }
    // Filter friends based on search text, maintaining selection and tag frequency order
    const filtered = friends
      .filter(friend =>
        friend.username.toLowerCase().includes(text.toLowerCase())
      )
      .sort((a, b) => {
        if (a.isSelected && !b.isSelected) return -1;
        if (!a.isSelected && b.isSelected) return 1;
        return b.tagCount - a.tagCount;
      });
    setFilteredFriends(filtered);
  };

  const toggleFriend = (friend) => {
    setFriends(prevFriends => {
      const updatedFriend = { ...friend, isSelected: !friend.isSelected };
      const otherFriends = prevFriends.filter(f => f.id !== friend.id);
      
      if (updatedFriend.isSelected) {
        // Move to top if selected
        return [updatedFriend, ...otherFriends];
      } else {
        // Move back to original position based on tag frequency
        return [...otherFriends, updatedFriend].sort((a, b) => {
          if (a.isSelected && !b.isSelected) return -1;
          if (!a.isSelected && b.isSelected) return 1;
          return b.tagCount - a.tagCount;
        });
      }
    });
    
    setFilteredFriends(prevFiltered => {
      const updatedFriend = { ...friend, isSelected: !friend.isSelected };
      const otherFriends = prevFiltered.filter(f => f.id !== friend.id);
      
      if (updatedFriend.isSelected) {
        // Move to top if selected
        return [updatedFriend, ...otherFriends];
      } else {
        // Move back to original position based on tag frequency
        return [...otherFriends, updatedFriend].sort((a, b) => {
          if (a.isSelected && !b.isSelected) return -1;
          if (!a.isSelected && b.isSelected) return 1;
          return b.tagCount - a.tagCount;
        });
      }
    });

    // Update selectedFriends array for upload functionality
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
          profilePicUrl: doc.data().profilePicUrl || null
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
        owners: owners,
        location: selectedLocation || null,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'posts'), postData);

      // Update tagging frequency for selected friends
      if (selectedFriends.length > 0) {
        try {
          const userRef = doc(db, 'users', auth.currentUser.uid);
          const currentUserDoc = await getDoc(userRef);
          const currentData = currentUserDoc.data();
          const currentFrequency = currentData.friendTaggingFrequency || {};
          
          // Increment count for each tagged friend
          selectedFriends.forEach(friend => {
            currentFrequency[friend.id] = (currentFrequency[friend.id] || 0) + 1;
          });
          
          await updateDoc(userRef, {
            friendTaggingFrequency: currentFrequency
          });
        } catch (error) {
          console.error('Error updating tagging frequency:', error);
          // Don't show error to user, just log it
        }
      }

      Alert.alert('Success', 'Post uploaded successfully!');
      
      // Navigate back to tabs and clear PostScreen images
      router.replace({
        pathname: '/tabs/FeedScreen',
        params: { clearPostImages: 'true' }
      });
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

  const handleFriendsSearchFocus = () => {
    // Only scroll once when first focused, not on every keystroke
    if (!hasScrolledToFriends) {
      setHasScrolledToFriends(true);
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: IMAGE_SIZE + 200, // Scroll past images and caption
          animated: true
        });
      }, 100);
    }
  };

  const renderHeader = () => (
    <>
      <View style={styles.locationSection}>
        <TouchableOpacity
          style={styles.locationButton}
          onPress={() => setShowLocationPicker(true)}
        >
          <Ionicons 
            name="location-outline" 
            size={20} 
            color={selectedLocation ? "#007AFF" : "#666"} 
          />
          <Text style={[
            styles.locationButtonText,
            selectedLocation && styles.selectedLocationText
          ]}>
            {selectedLocation 
              ? selectedLocation.name 
              : "Detecting location..."
            }
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#666" />
        </TouchableOpacity>
      </View>

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
          placeholderTextColor="#999"
          value={caption}
          onChangeText={setCaption}
          onFocus={handleCaptionFocus}
          style={styles.captionInput}
          multiline
          maxLength={2200}
        />
      </View>

      <View style={styles.tagFriendsSection}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Invite friends to post..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={handleSearch}
            onFocus={handleFriendsSearchFocus}
            onBlur={() => setHasScrolledToFriends(false)}
            autoCapitalize="none"
          />
        </View>
      </View>
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
          <TouchableOpacity 
            style={styles.headerTitleArea}
            onPress={(e) => {
              e.stopPropagation();
              Keyboard.dismiss();
            }}
            activeOpacity={1}
          >
            <Text style={styles.headerTitle}>New Post</Text>
          </TouchableOpacity>
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
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          automaticallyAdjustKeyboardInsets={false}
          nestedScrollEnabled={false}
          contentContainerStyle={styles.scrollContent}
        >
          {renderHeader()}
          
          <View style={styles.friendsListContainer}>
            <FlatList
              data={filteredFriends}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.friendItem,
                    item.isSelected && styles.selectedFriend
                  ]}
                  onPress={() => toggleFriend(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.friendInfo}>
                    <Text style={[
                      styles.friendName,
                      item.isSelected && styles.selectedFriendName
                    ]}>
                      {item.username}
                    </Text>
                    {item.isSelected && (
                      <Text style={styles.selectedLabel}>Selected</Text>
                    )}
                  </View>
                  {item.isSelected ? (
                    <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                  ) : (
                    <Ionicons name="add-circle-outline" size={24} color="#ccc" />
                  )}
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              ListEmptyComponent={
                searchQuery.trim() ? (
                  <View style={styles.noResultsContainer}>
                    <Text style={styles.noResultsText}>No friends found</Text>
                  </View>
                ) : null
              }
            />
          </View>
        </ScrollView>

        {uploading && (
          <View style={styles.progressContainer}>
            <Progress.Bar 
              progress={progress} 
              width={200} 
              color="#007AFF"
            />
            <Text style={styles.progressText}>
              {Math.round(progress * 100)}%
            </Text>
          </View>
        )}

        <Modal
          visible={showLocationPicker}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowLocationPicker(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add Location</Text>
              <TouchableOpacity 
                onPress={() => setShowLocationPicker(false)}
                disabled={!selectedLocation}
              >
                <Text style={[
                  styles.doneText,
                  !selectedLocation && styles.disabledText
                ]}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
            <LocationPicker 
              onLocationSelect={setSelectedLocation}
              initialLocation={selectedLocation}
            />
          </SafeAreaView>
        </Modal>
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
  headerTitleArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
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
  tagFriendsSection: {
    marginTop: 10,
    paddingHorizontal: 15
  },
  friendsListContainer: {
    height: 336, // Height for exactly 6 friends (56px each)
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    marginTop: 10
  },
  searchContainer: {
    marginBottom: 15
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#f8f8f8'
  },
  selectedFriendsContainer: {
    marginBottom: 15,
    height: 40
  },
  selectedFriendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8
  },
  selectedFriendUsername: {
    fontSize: 14,
    marginRight: 4
  },
  removeSelectedButton: {
    marginLeft: 4
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#262626'
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
    backgroundColor: '#f0f8ff',
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF'
  },
  friendInfo: {
    flex: 1
  },
  friendName: {
    fontSize: 16
  },
  selectedFriendName: {
    color: '#007AFF',
    fontWeight: '600'
  },
  selectedLabel: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2
  },
  noResultsContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    height: 100
  },
  noResultsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center'
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
  },
  locationSection: {
    marginTop: 10,
    marginBottom: 15,
    paddingHorizontal: 15
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  locationButtonText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#666'
  },
  selectedLocationText: {
    color: '#007AFF',
    fontWeight: '500'
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600'
  },
  cancelText: {
    fontSize: 16,
    color: '#007AFF'
  },
  doneText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600'
  },
  disabledText: {
    color: '#ccc'
  }
}); 