import { deleteDoc, doc } from 'firebase/firestore';
import { Alert } from 'react-native';
import { auth, db } from '../../firebase';

export const handleDeletePost = async (post, onPostDeleted) => {
  // Only allow deletion if user is the creator
  if (post.userId !== auth.currentUser.uid) {
    Alert.alert('Cannot Delete', 'You can only delete posts that you created.');
    return;
  }

  Alert.alert(
    'Delete Post',
    'Are you sure you want to delete this post? This action cannot be undone.',
    [
      {
        text: 'Cancel',
        style: 'cancel'
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            // Delete the post document
            await deleteDoc(doc(db, 'posts', post.id));

            // Call the callback to update local state
            if (onPostDeleted) {
              onPostDeleted(post.id);
            }
            
            Alert.alert('Success', 'Post deleted successfully');
          } catch (error) {
            console.error('Error deleting post:', error);
            Alert.alert('Error', 'Failed to delete post. Please try again.');
          }
        }
      }
    ]
  );
};

export const canEditPost = (post, currentUserId) => {
  return post.userId === currentUserId || post.postOwners?.some(owner => owner.id === currentUserId);
};

export const canDeletePost = (post, currentUserId) => {
  return post.userId === currentUserId;
}; 