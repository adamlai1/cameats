import {
    addDoc,
    arrayRemove,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    increment,
    limit,
    orderBy,
    query,
    serverTimestamp,
    startAfter,
    updateDoc,
    where
} from 'firebase/firestore';
import { auth, db } from '../../firebase';

const fetchPostOwnerData = async (ownerIdOrObject) => {
  try {
    // If ownerIdOrObject is already an object with id and username, return it
    if (typeof ownerIdOrObject === 'object' && ownerIdOrObject.id && ownerIdOrObject.username) {
      return {
        id: ownerIdOrObject.id,
        username: ownerIdOrObject.username,
        profilePicUrl: ownerIdOrObject.profilePicUrl || null
      };
    }

    // Otherwise, treat it as a userId and fetch the data
    const userId = typeof ownerIdOrObject === 'string' ? ownerIdOrObject : ownerIdOrObject?.id;
    if (!userId) {
      return {
        id: 'unknown',
        username: 'Unknown',
        profilePicUrl: null
      };
    }

    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return {
        id: userId,
        username: 'Unknown',
        profilePicUrl: null
      };
    }
    const userData = userDoc.data();
    return {
      id: userId,
      username: userData.username || 'Unknown',
      profilePicUrl: userData.profilePicUrl || null
    };
  } catch (error) {
    console.error('Error fetching owner data:', error);
    return {
      id: typeof ownerIdOrObject === 'string' ? ownerIdOrObject : 'unknown',
      username: 'Unknown',
      profilePicUrl: null
    };
  }
};

// Fetch posts with owners' data
export const fetchPosts = async (userIds = null, lastPost = null, postsPerPage = 50) => {
  try {
    let postsQuery;
    
    if (userIds) {
      postsQuery = query(
        collection(db, 'posts'),
        where('userId', 'in', userIds),
        orderBy('createdAt', 'desc'),
        limit(postsPerPage)
      );
    } else {
      postsQuery = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        limit(postsPerPage)
      );
    }

    if (lastPost) {
      postsQuery = query(
        postsQuery,
        startAfter(lastPost.createdAt)
      );
    }

    const snapshot = await getDocs(postsQuery);
    const posts = await Promise.all(snapshot.docs.map(async doc => {
      const data = doc.data();
      let postOwners = [];

      // Handle different post formats
      if (data.owners && Array.isArray(data.owners)) {
        // Use owners array if available (new format)
        postOwners = await Promise.all(
          data.owners.map(owner => fetchPostOwnerData(owner))
        );
      } else if (data.postOwners && Array.isArray(data.postOwners)) {
        // Fallback to postOwners array
        postOwners = await Promise.all(
          data.postOwners.map(owner => fetchPostOwnerData(owner))
        );
      } else if (data.userId) {
        // Legacy format with single owner
        const ownerData = await fetchPostOwnerData(data.userId);
        postOwners = [ownerData];
      } else {
        // Fallback for completely unknown ownership
        postOwners = [{
          id: 'unknown',
          username: 'Unknown',
          profilePicUrl: null
        }];
      }

      // Ensure bites data is properly formatted
      const bites = typeof data.bites === 'number' ? data.bites : 
                    Array.isArray(data.bitedBy) ? data.bitedBy.length : 0;
      const bitedBy = Array.isArray(data.bitedBy) ? data.bitedBy : [];

      return {
        id: doc.id,
        ...data,
        postOwners,
        bites,
        bitedBy,
        // Ensure all required fields have default values
        caption: data.caption || '',
        imageUrls: data.imageUrls || (data.imageUrl ? [data.imageUrl] : []),
        createdAt: data.createdAt || serverTimestamp()
      };
    }));

    return posts;
  } catch (error) {
    console.error('Error fetching posts:', error);
    throw error;
  }
};

export const getPost = async (postId) => {
  try {
    const postDoc = await getDoc(doc(db, 'posts', postId));
    if (!postDoc.exists()) {
      throw new Error('Post not found');
    }

    const data = postDoc.data();
    let postOwners = [];

    // Handle different post formats
    if (data.owners && Array.isArray(data.owners)) {
      // Use owners array if available (new format)
      postOwners = await Promise.all(
        data.owners.map(owner => fetchPostOwnerData(owner))
      );
    } else if (data.postOwners && Array.isArray(data.postOwners)) {
      // Fallback to postOwners array
      postOwners = await Promise.all(
        data.postOwners.map(owner => fetchPostOwnerData(owner))
      );
    } else if (data.userId) {
      // Legacy format with single owner
      const ownerData = await fetchPostOwnerData(data.userId);
      postOwners = [ownerData];
    } else {
      // Fallback for completely unknown ownership
      postOwners = [{
        id: 'unknown',
        username: 'Unknown',
        profilePicUrl: null
      }];
    }

    // Ensure bites data is properly formatted
    const bites = typeof data.bites === 'number' ? data.bites : 
                  Array.isArray(data.bitedBy) ? data.bitedBy.length : 0;
    const bitedBy = Array.isArray(data.bitedBy) ? data.bitedBy : [];

    return {
      id: postDoc.id,
      ...data,
      postOwners,
      bites,
      bitedBy,
      caption: data.caption || '',
      imageUrls: data.imageUrls || (data.imageUrl ? [data.imageUrl] : []),
      createdAt: data.createdAt || serverTimestamp()
    };
  } catch (error) {
    console.error('Error getting post:', error);
    throw error;
  }
};

// Toggle bite on a post
export const toggleBite = async (postId) => {
  try {
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    
    if (!postDoc.exists()) {
      throw new Error('Post not found');
    }

    const data = postDoc.data();
    const userId = auth.currentUser.uid;
    const hasUserBited = data.bitedBy?.includes(userId);

    await updateDoc(postRef, {
      bites: hasUserBited ? increment(-1) : increment(1),
      bitedBy: hasUserBited ? arrayRemove(userId) : arrayUnion(userId)
    });

    return !hasUserBited;
  } catch (error) {
    console.error('Error toggling bite:', error);
    throw error;
  }
};

// Add bite to a post (doesn't remove)
export const addBite = async (postId, userId) => {
  try {
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    
    if (!postSnap.exists()) {
      throw new Error('Post not found');
    }

    const currentData = postSnap.data();
    const currentBitedBy = currentData.bitedBy || [];
    
    // Only add bite if not already bitten
    if (!currentBitedBy.includes(userId)) {
      await updateDoc(postRef, {
        bites: increment(1),
        bitedBy: arrayUnion(userId)
      });

      return {
        bites: (currentData.bites || 0) + 1,
        bitedBy: [...currentBitedBy, userId]
      };
    }

    return {
      bites: currentData.bites || 0,
      bitedBy: currentBitedBy
    };
  } catch (error) {
    console.error('Error adding bite:', error);
    throw error;
  }
};

// Delete a post
export const deletePost = async (postId) => {
  try {
    await deleteDoc(doc(db, 'posts', postId));
  } catch (error) {
    console.error('Error deleting post:', error);
    throw error;
  }
};

// Update post caption
export const updatePostCaption = async (postId, userId, newCaption) => {
  try {
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    
    if (!postSnap.exists()) {
      throw new Error('Post not found');
    }

    const postData = postSnap.data();
    
    // Verify ownership
    if (postData.userId !== userId && !postData.postOwners?.includes(userId)) {
      throw new Error('Not authorized to update this post');
    }

    await updateDoc(postRef, { caption: newCaption });
    return true;
  } catch (error) {
    console.error('Error updating post caption:', error);
    throw error;
  }
};

export const createPost = async (postData) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }
    const userData = userDoc.data();

    // Ensure we have the current user's data
    const currentUserOwner = {
      id: auth.currentUser.uid,
      username: userData.username || 'Unknown',
      profilePicUrl: userData.profilePicUrl || null
    };

    // If postData already has owners array, ensure current user is first
    const owners = Array.isArray(postData.owners) 
      ? [currentUserOwner, ...postData.owners.filter(owner => owner.id !== auth.currentUser.uid)]
      : [currentUserOwner];

    const newPost = {
      ...postData,
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      bites: 0,
      bitedBy: [],
      owners: owners,
      postOwners: owners.map(owner => owner.id)
    };

    const docRef = await addDoc(collection(db, 'posts'), newPost);
    return {
      id: docRef.id,
      ...newPost
    };
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
};

// Delete posts that don't have proper user data
export const cleanupOrphanedPosts = async () => {
  try {
    // Get all posts
    const postsQuery = query(collection(db, 'posts'));
    const snapshot = await getDocs(postsQuery);
    
    const deletePromises = snapshot.docs.map(async docSnapshot => {
      const data = docSnapshot.data();
      
      // Check if post has valid user data
      if (!data.userId) {
        await deleteDoc(doc(db, 'posts', docSnapshot.id));
        return docSnapshot.id;
      }

      try {
        const userDocRef = doc(db, 'users', data.userId);
        const userDocSnapshot = await getDoc(userDocRef);
        
        // If no valid owner, delete the post
        if (!userDocSnapshot.exists()) {
          await deleteDoc(doc(db, 'posts', docSnapshot.id));
          return docSnapshot.id;
        }
      } catch (error) {
        console.error('Error checking user:', error);
        // If we can't verify the user, assume the post is orphaned
        await deleteDoc(doc(db, 'posts', docSnapshot.id));
        return docSnapshot.id;
      }
      
      return null;
    });

    const deletedIds = (await Promise.all(deletePromises)).filter(id => id !== null);
    return deletedIds;
  } catch (error) {
    console.error('Error cleaning up orphaned posts:', error);
    throw error;
  }
}; 