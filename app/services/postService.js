import {
    addDoc,
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
    runTransaction,
    serverTimestamp,
    startAfter,
    updateDoc,
    where
} from 'firebase/firestore';
import { auth, db } from '../../firebase';

// Cache for user data to avoid repeated fetches
const userDataCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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

    // Check cache first
    const cacheKey = userId;
    const cached = userDataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      const fallbackData = {
        id: userId,
        username: 'Unknown',
        profilePicUrl: null
      };
      // Cache unknown users to avoid repeated fetches
      userDataCache.set(cacheKey, {
        data: fallbackData,
        timestamp: Date.now()
      });
      return fallbackData;
    }
    const userData = userDoc.data();
    const result = {
      id: userId,
      username: userData.username || 'Unknown',
      profilePicUrl: userData.profilePicUrl || null
    };

    // Cache the result
    userDataCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  } catch (error) {
    console.error('Error fetching owner data:', error);
    return {
      id: typeof ownerIdOrObject === 'string' ? ownerIdOrObject : 'unknown',
      username: 'Unknown',
      profilePicUrl: null
    };
  }
};

// Fetch posts with owners' data (optimized)
export const fetchPosts = async (userIds = null, lastPost = null, postsPerPage = 50) => {
  try {
    let postsQuery;
    let needsClientSort = false;
    
    if (userIds && userIds.length === 1) {
      // Single user query - remove orderBy to avoid composite index requirement
      postsQuery = query(
        collection(db, 'posts'),
        where('userId', '==', userIds[0]),
        limit(postsPerPage)
      );
      needsClientSort = true;
    } else if (userIds && userIds.length > 1) {
      // Multiple users - fetch without orderBy to avoid composite index requirement
      postsQuery = query(
        collection(db, 'posts'),
        where('userId', 'in', userIds),
        limit(postsPerPage)
      );
      needsClientSort = true;
    } else {
      // All posts query - only this can use orderBy safely
      postsQuery = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        limit(postsPerPage)
      );
      
      if (lastPost) {
        postsQuery = query(
          postsQuery,
          startAfter(lastPost.createdAt)
        );
      }
    }

    const snapshot = await getDocs(postsQuery);
    
    // First, collect all unique user IDs that need to be fetched
    const userIdsToFetch = new Set();
    const postDataArray = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      postDataArray.push({ id: doc.id, ...data });
      
      // Collect user IDs to fetch
      if (data.owners && Array.isArray(data.owners)) {
        data.owners.forEach(owner => {
          if (typeof owner === 'string') {
            userIdsToFetch.add(owner);
          } else if (owner.id && (!owner.username || owner.username === 'Unknown')) {
            userIdsToFetch.add(owner.id);
          }
        });
      } else if (data.postOwners && Array.isArray(data.postOwners)) {
        data.postOwners.forEach(ownerId => {
          if (ownerId) userIdsToFetch.add(ownerId);
        });
      } else if (data.userId) {
        userIdsToFetch.add(data.userId);
      }
    });

    // Batch fetch all user data at once
    const userDataPromises = Array.from(userIdsToFetch).map(userId => 
      fetchPostOwnerData(userId)
    );
    const userDataResults = await Promise.all(userDataPromises);
    
    // Create a map for quick lookup
    const userDataMap = new Map();
    userDataResults.forEach(userData => {
      userDataMap.set(userData.id, userData);
    });

    // Now process posts with cached user data
    let posts = postDataArray.map(data => {
      let postOwners = [];

      // Handle different post formats
      if (data.owners && Array.isArray(data.owners)) {
        // Use owners array if available (new format)
        postOwners = data.owners.map(owner => {
          if (typeof owner === 'object' && owner.username && owner.username !== 'Unknown') {
            return owner; // Already has complete data
          }
          const userId = typeof owner === 'string' ? owner : owner.id;
          return userDataMap.get(userId) || {
            id: userId,
            username: 'Unknown',
            profilePicUrl: null
          };
        });
      } else if (data.postOwners && Array.isArray(data.postOwners)) {
        // Fallback to postOwners array
        postOwners = data.postOwners.map(ownerId => 
          userDataMap.get(ownerId) || {
            id: ownerId,
            username: 'Unknown',
            profilePicUrl: null
          }
        );
      } else if (data.userId) {
        // Legacy format with single owner
        const ownerData = userDataMap.get(data.userId) || {
          id: data.userId,
          username: 'Unknown',
          profilePicUrl: null
        };
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
        id: data.id,
        ...data,
        postOwners,
        bites,
        bitedBy,
        // Ensure all required fields have default values
        caption: data.caption || '',
        imageUrls: data.imageUrls || (data.imageUrl ? [data.imageUrl] : []),
        createdAt: data.createdAt || serverTimestamp()
      };
    });

    // Sort client-side if needed (when we used where clauses)
    if (needsClientSort) {
      posts.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bTime - aTime; // Descending order (newest first)
      });
    }

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

// Toggle bite on a post with atomic transaction
export const toggleBite = async (postId) => {
  try {
    const postRef = doc(db, 'posts', postId);
    const userId = auth.currentUser.uid;

    const result = await runTransaction(db, async (transaction) => {
      const postDoc = await transaction.get(postRef);
      
      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }

      const data = postDoc.data();
      const currentBites = Math.max(0, data.bites || 0); // Clean any existing negative values
      const currentBitedBy = data.bitedBy || [];
      const hasUserBited = currentBitedBy.includes(userId);

      let newBites, newBitedBy, action;

      if (hasUserBited) {
        // Remove bite
        newBites = Math.max(0, currentBites - 1); // Never allow negative
        newBitedBy = currentBitedBy.filter(id => id !== userId);
        action = 'removed';
      } else {
        // Add bite
        newBites = currentBites + 1;
        newBitedBy = [...currentBitedBy, userId];
        action = 'added';
      }

      // Update the document with the calculated values
      transaction.update(postRef, {
        bites: newBites,
        bitedBy: newBitedBy
      });

      return {
        success: true,
        action,
        bites: newBites,
        bitedBy: newBitedBy
      };
    });

    return result;
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

// Clean up posts with negative bite counts
export const cleanupNegativeBites = async () => {
  try {
    console.log('Starting cleanup of negative bite counts...');
    const postsQuery = query(collection(db, 'posts'));
    const snapshot = await getDocs(postsQuery);
    
    let fixedCount = 0;
    const batch = [];
    
    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      const currentBites = data.bites || 0;
      
      if (currentBites < 0) {
        console.log(`Fixing post ${docSnapshot.id}: ${currentBites} -> 0`);
        batch.push({
          ref: doc(db, 'posts', docSnapshot.id),
          bites: 0,
          bitedBy: data.bitedBy || []
        });
        fixedCount++;
      }
    }
    
    // Update posts with negative bite counts
    for (const update of batch) {
      await updateDoc(update.ref, {
        bites: update.bites,
        bitedBy: update.bitedBy
      });
    }
    
    console.log(`Fixed ${fixedCount} posts with negative bite counts`);
    return fixedCount;
  } catch (error) {
    console.error('Error cleaning up negative bites:', error);
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