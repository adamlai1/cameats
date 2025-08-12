import {
    arrayRemove,
    arrayUnion,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    updateDoc,
    where
} from 'firebase/firestore';
import { auth, db } from '../../firebase';

export const getCurrentUserProfile = async () => {
  const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
  if (!userDoc.exists()) {
    throw new Error('User not found');
  }
  return userDoc.data();
};

export const getUserProfile = async (userId) => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) {
    throw new Error('User not found');
  }
  return userDoc.data();
};

export const searchUsers = async (searchTerm, friendsList = [], friendRequests = []) => {
  const usersRef = collection(db, 'users');
  const q = query(
    usersRef,
    where('username', '>=', searchTerm.toLowerCase()),
    where('username', '<=', searchTerm.toLowerCase() + '\uf8ff')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data(),
      isFriend: friendsList.includes(doc.id),
      hasPendingRequest: friendRequests.includes(doc.id)
    }))
    .filter(user => user.id !== auth.currentUser.uid);
};

export const sendFriendRequest = async (toUserId, fromUsername) => {
  const toUserRef = doc(db, 'users', toUserId);
  const fromUserRef = doc(db, 'users', auth.currentUser.uid);

  await updateDoc(toUserRef, {
    friendRequests: arrayUnion({
      id: auth.currentUser.uid,
      username: fromUsername,
      timestamp: serverTimestamp()
    })
  });

  await updateDoc(fromUserRef, {
    sentFriendRequests: arrayUnion(toUserId)
  });
};

export const acceptFriendRequest = async (fromUserId) => {
  const currentUserRef = doc(db, 'users', auth.currentUser.uid);
  const fromUserRef = doc(db, 'users', fromUserId);

  // Add each user to the other's friends list
  await updateDoc(currentUserRef, {
    friends: arrayUnion(fromUserId),
    friendRequests: arrayRemove(fromUserId)
  });

  await updateDoc(fromUserRef, {
    friends: arrayUnion(auth.currentUser.uid),
    sentFriendRequests: arrayRemove(auth.currentUser.uid)
  });
};

export const updateProfile = async (updates) => {
  const userRef = doc(db, 'users', auth.currentUser.uid);
  await updateDoc(userRef, updates);
};

export const getFriendsList = async (userId) => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) {
    throw new Error('User not found');
  }

  const friendIds = userDoc.data().friends || [];
  if (friendIds.length === 0) {
    return [];
  }

  const friendsData = await Promise.all(
    friendIds.map(friendId => getDoc(doc(db, 'users', friendId)))
  );

  return friendsData
    .filter(doc => doc.exists())
    .map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
};

export const cleanupDuplicateFriends = async (userId = null) => {
  const targetUserId = userId || auth.currentUser.uid;
  const userRef = doc(db, 'users', targetUserId);
  
  try {
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userDoc.data();
    const friends = userData.friends || [];
    
    // Remove duplicates using Set
    const uniqueFriends = [...new Set(friends)];
    
    // Only update if there were duplicates
    if (friends.length !== uniqueFriends.length) {
      console.log(`Removing ${friends.length - uniqueFriends.length} duplicate friends for user ${targetUserId}`);
      await updateDoc(userRef, {
        friends: uniqueFriends
      });
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error cleaning up duplicate friends:', error);
    throw error;
  }
}; 