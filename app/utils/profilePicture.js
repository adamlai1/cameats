import { manipulateAsync } from 'expo-image-manipulator';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '../../firebase';

const MAX_IMAGE_SIZE = 1024; // Maximum dimension for profile pictures
const COMPRESSION_QUALITY = 0.7; // Image compression quality (0 to 1)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

/**
 * Processes and optimizes an image for profile picture use
 * @param {string} uri - The URI of the image to process
 * @returns {Promise<string>} - The URI of the processed image
 */
async function processImage(uri) {
  try {
    // Get image dimensions
    const manipResult = await manipulateAsync(
      uri,
      [{ resize: { width: MAX_IMAGE_SIZE, height: MAX_IMAGE_SIZE } }],
      { compress: COMPRESSION_QUALITY, format: 'jpeg' }
    );
    
    return manipResult.uri;
  } catch (error) {
    console.error('Error processing image:', error);
    throw new Error('Failed to process image. Please try again.');
  }
}

/**
 * Generates a storage path for a user's profile picture
 * @param {string} userId - The user's ID
 * @returns {string} - The storage path
 */
function getProfilePicturePath(userId) {
  return `profile_pictures/${userId}/profile.jpg`;
}

/**
 * Uploads a profile picture for a user
 * @param {string} userId - The user's ID
 * @param {string} imageUri - The URI of the image to upload
 * @param {function} onProgress - Optional callback for upload progress
 * @returns {Promise<string>} - The download URL of the uploaded image
 */
export async function uploadProfilePicture(userId, imageUri, onProgress = null) {
  try {
    // Process and optimize the image
    const processedUri = await processImage(imageUri);
    
    // Convert URI to blob
    const response = await fetch(processedUri);
    const blob = await response.blob();
    
    // Check file size
    if (blob.size > MAX_FILE_SIZE) {
      throw new Error('Image size must be less than 5MB');
    }
    
    // Get storage path
    const storagePath = getProfilePicturePath(userId);
    const storageRef = ref(storage, storagePath);
    
    // Upload the image
    const uploadTask = uploadBytesResumable(storageRef, blob);
    
    // Return a promise that resolves with the download URL
    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = snapshot.bytesTransferred / snapshot.totalBytes;
          if (onProgress) {
            onProgress(progress);
          }
        },
        (error) => {
          console.error('Upload error:', error);
          reject(new Error('Failed to upload image. Please try again.'));
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            // Update user's profile in Firestore
            await updateDoc(doc(db, 'users', userId), {
              profilePicUrl: downloadURL,
              lastProfilePicUpdate: serverTimestamp()
            });
            
            resolve(downloadURL);
          } catch (error) {
            console.error('Error finalizing upload:', error);
            reject(new Error('Failed to update profile picture. Please try again.'));
          }
        }
      );
    });
  } catch (error) {
    console.error('Profile picture upload error:', error);
    throw error;
  }
}

/**
 * Deletes a user's profile picture
 * @param {string} userId - The user's ID
 * @returns {Promise<void>}
 */
export async function deleteProfilePicture(userId) {
  try {
    const storagePath = getProfilePicturePath(userId);
    const storageRef = ref(storage, storagePath);
    
    await deleteObject(storageRef);
    
    // Update user's profile in Firestore
    await updateDoc(doc(db, 'users', userId), {
      profilePicUrl: null,
      lastProfilePicUpdate: serverTimestamp()
    });
  } catch (error) {
    console.error('Error deleting profile picture:', error);
    throw new Error('Failed to delete profile picture. Please try again.');
  }
} 