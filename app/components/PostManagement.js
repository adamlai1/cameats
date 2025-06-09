import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    updateDoc,
    where
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import * as Progress from 'react-native-progress';
import { auth, db, storage } from '../../firebase';
import { useTheme } from '../contexts/ThemeContext';
import LocationPicker from './LocationPicker';

const WINDOW_WIDTH = Dimensions.get('window').width;

export default function PostManagement({ 
  selectedPost,
  onClose,
  onUpdatePost,
  showPostOptions,
  setShowPostOptions,
  onDeletePost
}) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [editingCaption, setEditingCaption] = useState(false);
  const [newCaption, setNewCaption] = useState('');
  const [showAddCoOwners, setShowAddCoOwners] = useState(false);
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [searching, setSearching] = useState(false);
  const [friendsList, setFriendsList] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [showAddPhotos, setShowAddPhotos] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showManagePhotos, setShowManagePhotos] = useState(false);
  const [showEditLocation, setShowEditLocation] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

  useEffect(() => {
    (async () => {
      const mediaStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
      const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
      if (mediaStatus.status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to your media library to add photos.');
      }
      if (cameraStatus.status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to your camera to take photos.');
      }
    })();
  }, []);

  const handleEditCaption = () => {
    setShowPostOptions(false);
    setEditingCaption(true);
    setNewCaption(selectedPost?.caption || '');
  };

  const handleAddCoOwners = () => {
    setShowPostOptions(false);
    setShowAddCoOwners(true);
    setSearchUsername('');
    setSearchResults([]);
    setSelectedFriends([]);
    fetchFriendsList();
  };

  const handleAddPhotos = () => {
    setShowPostOptions(false);
    setShowAddPhotos(true);
  };

  const handleManagePhotos = () => {
    setShowPostOptions(false);
    setShowManagePhotos(true);
  };

  const handleEditLocation = () => {
    setShowPostOptions(false);
    setSelectedLocation(selectedPost?.location || null);
    setShowEditLocation(true);
  };

  const handleSaveLocation = async (newLocation) => {
    if (!selectedPost) return;
    
    try {
      const postRef = doc(db, 'posts', selectedPost.id);
      
      // Update Firestore
      await updateDoc(postRef, {
        location: newLocation
      });
      
      onUpdatePost({
        ...selectedPost,
        location: newLocation
      });
      
      setShowEditLocation(false);
      Alert.alert('Success', 'Location updated successfully!');
    } catch (error) {
      console.error('Error updating location:', error);
      Alert.alert('Error', 'Failed to update location');
    }
  };

  const handleRemoveLocation = async () => {
    if (!selectedPost) return;
    
    Alert.alert(
      'Remove Location',
      'Are you sure you want to remove the location from this post?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const postRef = doc(db, 'posts', selectedPost.id);
              
              // Remove location from Firestore
              await updateDoc(postRef, {
                location: null
              });
              
              onUpdatePost({
                ...selectedPost,
                location: null
              });
              
              setShowEditLocation(false);
              Alert.alert('Success', 'Location removed successfully!');
            } catch (error) {
              console.error('Error removing location:', error);
              Alert.alert('Error', 'Failed to remove location');
            }
          }
        }
      ]
    );
  };

  const fetchFriendsList = async () => {
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists() && userDoc.data().friends) {
        const friendPromises = userDoc.data().friends.map(friendId => 
          getDoc(doc(db, 'users', friendId))
        );
        
        const friendDocs = await Promise.all(friendPromises);
        const friends = friendDocs
          .filter(doc => doc.exists())
          .map(doc => ({
            id: doc.id,
            username: doc.data().username,
            displayName: doc.data().displayName || doc.data().username
          }));
        
        setFriendsList(friends);
      }
    } catch (error) {
      console.error('Error fetching friends list:', error);
      Alert.alert('Error', 'Failed to load friends list');
    }
  };

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setSearching(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '>=', query.toLowerCase()), limit(10));
      const querySnapshot = await getDocs(q);
      
      const results = querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(user => user.id !== auth.currentUser.uid);
      
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectFriend = (friend) => {
    setSelectedFriends(prev => {
      const isSelected = prev.some(f => f.id === friend.id);
      if (isSelected) {
        return prev.filter(f => f.id !== friend.id);
      } else {
        return [...prev, friend];
      }
    });
  };

  const handleRemoveSelectedFriend = (friendId) => {
    setSelectedFriends(prev => prev.filter(friend => friend.id !== friendId));
  };

  const handleSaveCoOwners = async () => {
    if (!selectedPost || selectedFriends.length === 0) return;
    
    try {
      const postRef = doc(db, 'posts', selectedPost.id);
      
      // Get current owners and add new ones
      const currentOwners = selectedPost.owners || [];
      const newOwners = selectedFriends.map(friend => ({
        id: friend.id,
        username: friend.username,
        displayName: friend.displayName || friend.username
      }));
      
      // Remove duplicates
      const uniqueOwners = [...currentOwners, ...newOwners]
        .filter((owner, index, self) => 
          index === self.findIndex(o => o.id === owner.id)
        );
      
      // Update Firestore
      await updateDoc(postRef, {
        owners: uniqueOwners,
        postOwners: uniqueOwners.map(owner => owner.id)
      });
      
      onUpdatePost({
        ...selectedPost,
        owners: uniqueOwners,
        postOwners: uniqueOwners.map(owner => owner.id)
      });
      
      setShowAddCoOwners(false);
      Alert.alert('Success', 'Co-owners added successfully!');
    } catch (error) {
      console.error('Error adding co-owners:', error);
      Alert.alert('Error', 'Failed to add co-owners');
    }
  };

  const pickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        const newImages = result.assets.map(asset => asset.uri);
        setSelectedImages(prev => [...prev, ...newImages]);
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled) {
        setSelectedImages(prev => [...prev, result.assets[0].uri]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadPhotos = async () => {
    if (!selectedPost || selectedImages.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const uploadPromises = selectedImages.map(async (uri, index) => {
        const response = await fetch(uri);
        const blob = await response.blob();
        
        const filename = `posts/${selectedPost.id}/image-${Date.now()}-${index}.jpg`;
        const imageRef = ref(storage, filename);
        
        await uploadBytes(imageRef, blob);
        const downloadURL = await getDownloadURL(imageRef);
        
        setUploadProgress((index + 1) / selectedImages.length);
        return downloadURL;
      });

      const newImageUrls = await Promise.all(uploadPromises);
      
      // Update the post document with new image URLs
      const postRef = doc(db, 'posts', selectedPost.id);
      const currentImageUrls = selectedPost.imageUrls || [];
      await updateDoc(postRef, {
        imageUrls: [...currentImageUrls, ...newImageUrls]
      });

      // Update local state
      const updatedPost = {
        ...selectedPost,
        imageUrls: [...currentImageUrls, ...newImageUrls]
      };
      onUpdatePost(updatedPost);

      setSelectedImages([]);
      setShowAddPhotos(false);
      Alert.alert('Success', 'Photos added successfully!');
    } catch (error) {
      console.error('Error uploading photos:', error);
      Alert.alert('Error', 'Failed to upload photos. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeletePhoto = async (photoUrl) => {
    if (!selectedPost) return;

    try {
      // Delete from Storage
      const imageRef = ref(storage, photoUrl);
      await deleteObject(imageRef);

      // Update Firestore
      const postRef = doc(db, 'posts', selectedPost.id);
      const updatedImageUrls = selectedPost.imageUrls.filter(url => url !== photoUrl);
      await updateDoc(postRef, {
        imageUrls: updatedImageUrls
      });

      // Update local state
      const updatedPost = {
        ...selectedPost,
        imageUrls: updatedImageUrls
      };
      onUpdatePost(updatedPost);

      Alert.alert('Success', 'Photo deleted successfully!');
    } catch (error) {
      console.error('Error deleting photo:', error);
      Alert.alert('Error', 'Failed to delete photo. Please try again.');
    }
  };

  const renderPostOptionsModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showPostOptions}
      onRequestClose={() => setShowPostOptions(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowPostOptions(false)}
      >
        <View style={styles.optionsModalContent}>
          <TouchableOpacity 
            style={styles.optionItem}
            onPress={() => {
              setShowPostOptions(false);
              setShowAddPhotos(true);
            }}
          >
            <Text style={styles.optionText}>Add More Photos</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.optionItem}
            onPress={() => {
              setShowPostOptions(false);
              setShowManagePhotos(true);
            }}
          >
            <Text style={styles.optionText}>Manage Photos</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.optionItem}
            onPress={() => {
              setShowPostOptions(false);
              setEditingCaption(true);
              setNewCaption(selectedPost?.caption || '');
            }}
          >
            <Text style={styles.optionText}>Edit Caption</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.optionItem}
            onPress={() => {
              setShowPostOptions(false);
              setShowAddCoOwners(true);
              fetchFriendsList();
            }}
          >
            <Text style={styles.optionText}>Add Co-owners</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.optionItem}
            onPress={handleEditLocation}
          >
            <Text style={styles.optionText}>Change Location</Text>
          </TouchableOpacity>
          
          {selectedPost?.userId === auth.currentUser.uid && (
            <TouchableOpacity 
              style={[styles.optionItem, styles.deleteOption]} 
              onPress={() => {
                setShowPostOptions(false);
                onDeletePost(selectedPost);
              }}
            >
              <Text style={styles.deleteOptionText}>Delete Post</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderEditCaptionModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={editingCaption}
      onRequestClose={() => setEditingCaption(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Caption</Text>
            <TouchableOpacity onPress={() => setEditingCaption(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.captionInput}
            value={newCaption}
            onChangeText={setNewCaption}
            placeholder="Write a caption..."
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={2200}
          />

          <TouchableOpacity
            style={styles.saveButton}
            onPress={async () => {
              if (!selectedPost) return;
              try {
                await updateDoc(doc(db, 'posts', selectedPost.id), {
                  caption: newCaption
                });
                onUpdatePost({
                  ...selectedPost,
                  caption: newCaption
                });
                setEditingCaption(false);
                Alert.alert('Success', 'Caption updated successfully!');
              } catch (error) {
                console.error('Error updating caption:', error);
                Alert.alert('Error', 'Failed to update caption');
              }
            }}
          >
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderAddCoOwnersModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showAddCoOwners}
      onRequestClose={() => setShowAddCoOwners(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Co-owners</Text>
            <TouchableOpacity onPress={() => setShowAddCoOwners(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {selectedFriends.length > 0 && (
            <View style={styles.selectedFriendsContainer}>
              <Text style={styles.selectedFriendsTitle}>Selected Friends</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.selectedFriendsScroll}
              >
                {selectedFriends.map(friend => (
                  <View key={friend.id} style={styles.selectedFriendChip}>
                    <Text style={styles.selectedFriendUsername}>
                      {friend.username}
                    </Text>
                    <TouchableOpacity
                      style={styles.removeSelectedButton}
                      onPress={() => handleRemoveSelectedFriend(friend.id)}
                    >
                      <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              value={searchUsername}
              onChangeText={text => {
                setSearchUsername(text);
                searchUsers(text);
              }}
              placeholder="Search friends..."
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <ScrollView>
            {searching ? (
              <ActivityIndicator size="large" color="#1976d2" />
            ) : searchUsername ? (
              searchResults.map(user => (
                <TouchableOpacity
                  key={user.id}
                  style={styles.searchResultItem}
                  onPress={() => handleSelectFriend(user)}
                >
                  <Text style={styles.searchResultUsername}>{user.username}</Text>
                  <View style={[
                    styles.checkBox,
                    selectedFriends.some(f => f.id === user.id) && styles.checkBoxSelected
                  ]}>
                    {selectedFriends.some(f => f.id === user.id) && (
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    )}
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              friendsList.map(friend => (
                <TouchableOpacity
                  key={friend.id}
                  style={styles.searchResultItem}
                  onPress={() => handleSelectFriend(friend)}
                >
                  <Text style={styles.searchResultUsername}>{friend.username}</Text>
                  <View style={[
                    styles.checkBox,
                    selectedFriends.some(f => f.id === friend.id) && styles.checkBoxSelected
                  ]}>
                    {selectedFriends.some(f => f.id === friend.id) && (
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          {selectedFriends.length > 0 && (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveCoOwners}
            >
              <Text style={styles.saveButtonText}>Add Selected Friends</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderAddPhotosModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showAddPhotos}
      onRequestClose={() => setShowAddPhotos(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add More Photos</Text>
            <TouchableOpacity onPress={() => setShowAddPhotos(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {selectedImages.length > 0 ? (
            <View style={styles.selectedImagesContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {selectedImages.map((uri, index) => (
                  <View key={index} style={styles.selectedImageWrapper}>
                    <Image source={{ uri }} style={styles.selectedImage} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close-circle" size={24} color="#ff3b30" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.emptyImagesContainer}>
              <Text style={styles.emptyText}>No images selected</Text>
            </View>
          )}

          <View style={styles.photoButtonsContainer}>
            <TouchableOpacity
              style={[styles.photoButton, styles.cameraButton]}
              onPress={takePhoto}
            >
              <Ionicons name="camera" size={24} color="#fff" />
              <Text style={styles.buttonText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.photoButton, styles.galleryButton]}
              onPress={pickImages}
            >
              <Ionicons name="images" size={24} color="#fff" />
              <Text style={styles.buttonText}>Choose from Gallery</Text>
            </TouchableOpacity>
          </View>

          {selectedImages.length > 0 && (
            <TouchableOpacity
              style={[styles.saveButton, uploading && styles.disabledButton]}
              onPress={handleUploadPhotos}
              disabled={uploading}
            >
              <Text style={styles.saveButtonText}>
                {uploading ? 'Uploading...' : 'Upload Photos'}
              </Text>
            </TouchableOpacity>
          )}

          {uploading && (
            <View style={styles.progressContainer}>
              <Progress.Bar 
                progress={uploadProgress} 
                width={200} 
                color="#007AFF"
              />
              <Text style={styles.progressText}>
                {Math.round(uploadProgress * 100)}%
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderManagePhotosModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showManagePhotos}
      onRequestClose={() => setShowManagePhotos(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Manage Photos</Text>
            <TouchableOpacity onPress={() => setShowManagePhotos(false)}>
              <Ionicons name="close" size={24} color="black" />
            </TouchableOpacity>
          </View>

          {selectedPost?.imageUrls?.length > 0 ? (
            <ScrollView style={styles.managePhotosContainer}>
              {selectedPost.imageUrls.map((photoUrl, index) => (
                <View key={index} style={styles.managePhotoItem}>
                  <Image 
                    source={{ uri: photoUrl }} 
                    style={styles.managePhotoImage} 
                  />
                  <TouchableOpacity
                    style={styles.deletePhotoButton}
                    onPress={() => handleDeletePhoto(photoUrl)}
                  >
                    <Ionicons name="trash-outline" size={24} color="#ff3b30" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyPhotosContainer}>
              <Text style={styles.emptyText}>No photos in this post</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderEditLocationModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showEditLocation}
      onRequestClose={() => setShowEditLocation(false)}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, { maxHeight: '85%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Change Location</Text>
            <TouchableOpacity onPress={() => setShowEditLocation(false)}>
              <Ionicons name="close" size={24} color="black" />
            </TouchableOpacity>
          </View>

          {selectedPost?.location && (
            <View style={styles.currentLocationContainer}>
              <Text style={styles.currentLocationLabel}>Current Location:</Text>
              <View style={styles.currentLocationInfo}>
                <Ionicons name="location" size={16} color="#666" />
                <Text style={styles.currentLocationText}>{selectedPost.location.name}</Text>
              </View>
              <TouchableOpacity 
                style={styles.removeLocationButton}
                onPress={handleRemoveLocation}
              >
                <Ionicons name="trash-outline" size={16} color="#ff3b30" />
                <Text style={styles.removeLocationText}>Remove Location</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.locationPickerContainer}>
            <LocationPicker
              onLocationSelect={setSelectedLocation}
              initialLocation={selectedPost?.location}
            />
          </View>

          {selectedLocation && (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => handleSaveLocation(selectedLocation)}
            >
              <Text style={styles.saveButtonText}>
                {selectedPost?.location ? 'Update Location' : 'Add Location'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      {renderPostOptionsModal()}
      {renderEditCaptionModal()}
      {renderAddCoOwnersModal()}
      {renderAddPhotosModal()}
      {renderManagePhotosModal()}
      {renderEditLocationModal()}
    </>
  );
}

const getStyles = (theme) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end'
  },
  optionsModalContent: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    paddingVertical: 20
  },
  optionItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.border
  },
  optionText: {
    fontSize: 16,
    color: theme.text
  },
  deleteOption: {
    borderBottomWidth: 0
  },
  deleteOptionText: {
    fontSize: 16,
    color: '#ff3b30'
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  },
  modalContent: {
    backgroundColor: theme.background,
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.border
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text
  },
  captionInput: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 12,
    marginVertical: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    color: theme.text,
    backgroundColor: theme.surface
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 10
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  selectedFriendsContainer: {
    marginBottom: 20
  },
  selectedFriendsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: theme.text
  },
  selectedFriendsScroll: {
    paddingHorizontal: 10
  },
  selectedFriendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    padding: 8,
    borderRadius: 20,
    marginRight: 10
  },
  selectedFriendUsername: {
    fontSize: 14,
    marginRight: 5,
    color: theme.text
  },
  removeSelectedButton: {
    padding: 2
  },
  searchContainer: {
    padding: 10
  },
  searchInput: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    color: theme.text,
    backgroundColor: theme.surface
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border
  },
  searchResultUsername: {
    fontSize: 14,
    flex: 1,
    color: theme.text
  },
  checkBox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: theme.border,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkBoxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF'
  },
  selectedImagesContainer: {
    marginVertical: 15,
    maxHeight: 120
  },
  selectedImageWrapper: {
    marginRight: 10
  },
  selectedImage: {
    width: 100,
    height: 100,
    borderRadius: 8
  },
  removeImageButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: theme.background,
    borderRadius: 12
  },
  emptyImagesContainer: {
    padding: 20,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 14,
    color: theme.textSecondary
  },
  photoButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    gap: 10
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8
  },
  cameraButton: {
    backgroundColor: '#007AFF'
  },
  galleryButton: {
    backgroundColor: '#34C759'
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500'
  },
  progressContainer: {
    alignItems: 'center',
    marginTop: 15
  },
  progressText: {
    marginTop: 5,
    fontSize: 14,
    color: theme.textSecondary
  },
  disabledButton: {
    opacity: 0.5
  },
  managePhotosContainer: {
    flex: 1
  },
  managePhotoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border
  },
  managePhotoImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 10
  },
  deletePhotoButton: {
    padding: 8
  },
  emptyPhotosContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  currentLocationContainer: {
    marginBottom: 20
  },
  currentLocationLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10
  },
  currentLocationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8
  },
  currentLocationText: {
    fontSize: 14,
    marginLeft: 10
  },
  removeLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#ff3b30',
    borderRadius: 8,
    marginTop: 10,
    gap: 5
  },
  removeLocationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  locationPickerContainer: {
    marginBottom: 20
  }
});