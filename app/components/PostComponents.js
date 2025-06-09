import { arrayRemove, arrayUnion, doc, getDoc, increment, updateDoc } from 'firebase/firestore';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { State, TapGestureHandler } from 'react-native-gesture-handler';
import { auth, db } from '../../firebase';

// Import bread slice images and preload them
const breadNormal = require('../../assets/images/bread-normal.png');
const breadBitten = require('../../assets/images/bread-bitten.png');

// Preload and cache bread images immediately
const breadNormalSource = Image.resolveAssetSource(breadNormal);
const breadBittenSource = Image.resolveAssetSource(breadBitten);

// Cache the resolved image sources
const cachedImages = {
  normal: { uri: breadNormalSource.uri, width: breadNormalSource.width, height: breadNormalSource.height },
  bitten: { uri: breadBittenSource.uri, width: breadBittenSource.width, height: breadBittenSource.height }
};

// Shared utility for optimistic updates
export const createPostOptimisticUpdater = (setPosts) => {
  return (postId, updateFn) => {
    setPosts(prevPosts => {
      const postIndex = prevPosts.findIndex(post => post.id === postId);
      if (postIndex === -1) return prevPosts;
      
      const currentPost = prevPosts[postIndex];
      const updatedPost = updateFn(currentPost);
      
      if (updatedPost === currentPost) return prevPosts;
      
      const newPosts = [...prevPosts];
      newPosts[postIndex] = updatedPost;
      return newPosts;
    });
  };
};

// Shared BreadButton component
export const BreadButton = React.memo(({ postId, hasUserBited, onPress, theme }) => {
  const [visuallyBitten, setVisuallyBitten] = React.useState(hasUserBited);
  const styles = getStyles(theme);
  
  React.useEffect(() => {
    setVisuallyBitten(hasUserBited);
  }, [hasUserBited]);

  const handlePress = React.useCallback(() => {
    setVisuallyBitten(!visuallyBitten);
    onPress(postId);
  }, [postId, onPress, visuallyBitten]);

  return (
    <TouchableOpacity 
      style={styles.biteButton}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Image 
        source={visuallyBitten ? cachedImages.bitten : cachedImages.normal}
        style={styles.breadEmoji}
        fadeDuration={0}
        resizeMode="contain"
        defaultSource={cachedImages.normal}
      />
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  return prevProps.postId === nextProps.postId && 
         prevProps.hasUserBited === nextProps.hasUserBited;
});

// Shared bite handler creator
export const createBiteHandler = (updatePostOptimistic) => {
  return (postId) => {
    const userId = auth.currentUser.uid;
    
    // Update UI immediately
    updatePostOptimistic(postId, (post) => {
      const currentBitedBy = post.bitedBy || [];
      const hasUserBited = currentBitedBy.includes(userId);
      
      if (hasUserBited) {
        return {
          ...post,
          bites: Math.max(0, (post.bites || 0) - 1),
          bitedBy: currentBitedBy.filter(id => id !== userId)
        };
      } else {
        return {
          ...post,
          bites: (post.bites || 0) + 1,
          bitedBy: [...currentBitedBy, userId]
        };
      }
    });
    
    // Update Firebase in background
    const updateFirebase = async () => {
      try {
        const postRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postRef);
        if (!postSnap.exists()) return;
        
        const currentData = postSnap.data();
        const currentBitedBy = currentData.bitedBy || [];
        const hasUserBited = currentBitedBy.includes(userId);
        
        await updateDoc(postRef, {
          bites: increment(hasUserBited ? -1 : 1),
          bitedBy: hasUserBited ? arrayRemove(userId) : arrayUnion(userId)
        });
      } catch (error) {
        console.error('Error updating bites:', error);
        // If Firebase update fails, revert the optimistic update
        updatePostOptimistic(postId, (post) => {
          const currentBitedBy = post.bitedBy || [];
          const hasUserBited = currentBitedBy.includes(userId);
          
          if (hasUserBited) {
            return {
              ...post,
              bites: Math.max(0, (post.bites || 0) - 1),
              bitedBy: currentBitedBy.filter(id => id !== userId)
            };
          } else {
            return {
              ...post,
              bites: (post.bites || 0) + 1,
              bitedBy: [...currentBitedBy, userId]
            };
          }
        });
      }
    };
    
    // Fire and forget - don't wait for Firebase
    updateFirebase();
  };
};

// Create double-tap like handler
export const createDoubleTapHandler = (updatePostOptimistic) => {
  return (postId) => {
    const userId = auth.currentUser.uid;
    
    // Only add a bite on double-tap, never remove
    updatePostOptimistic(postId, (post) => {
      const currentBitedBy = post.bitedBy || [];
      const hasUserBited = currentBitedBy.includes(userId);
      
      // If already bitten, do nothing
      if (hasUserBited) return post;
      
      // Add bite
      return {
        ...post,
        bites: (post.bites || 0) + 1,
        bitedBy: [...currentBitedBy, userId]
      };
    });
    
    // Update Firebase in background
    const updateFirebase = async () => {
      try {
        const postRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postRef);
        if (!postSnap.exists()) return;
        
        const currentData = postSnap.data();
        const currentBitedBy = currentData.bitedBy || [];
        const hasUserBited = currentBitedBy.includes(userId);
        
        // Only add bite if not already bitten
        if (!hasUserBited) {
          await updateDoc(postRef, {
            bites: increment(1),
            bitedBy: arrayUnion(userId)
          });
        }
      } catch (error) {
        console.error('Error updating bites:', error);
        // If Firebase fails, revert the optimistic update
        updatePostOptimistic(postId, (post) => {
          const currentBitedBy = post.bitedBy || [];
          const hasUserBited = currentBitedBy.includes(userId);
          
          if (hasUserBited) {
            return {
              ...post,
              bites: Math.max(0, (post.bites || 0) - 1),
              bitedBy: currentBitedBy.filter(id => id !== userId)
            };
          }
          return post;
        });
      }
    };
    
    updateFirebase();
  };
};

// Shared post content component
export const PostContent = React.memo(({ post, onBitePress, onDoubleTap, children }) => {
  return (
    <TapGestureHandler
      numberOfTaps={2}
      onHandlerStateChange={(event) => {
        if (event.nativeEvent.state === State.ACTIVE) {
          onDoubleTap(post.id);
        }
      }}
    >
      <View>
        {children}
      </View>
    </TapGestureHandler>
  );
});

// Shared post action bar component
export const PostActionBar = React.memo(({ post, onBitePress, theme }) => {
  const userId = auth.currentUser.uid;
  const hasUserBited = post.bitedBy?.includes(userId);
  const biteCount = typeof post.bites === 'number' ? post.bites : 0;
  const styles = getStyles(theme);

  return (
    <>
      <View style={styles.actionBar}>
        <View style={styles.leftActions}>
          <BreadButton
            postId={post.id}
            hasUserBited={hasUserBited}
            onPress={onBitePress}
            theme={theme}
          />
        </View>
      </View>

      <View style={styles.biteCountContainer}>
        <Text style={styles.biteCountText}>
          {biteCount} {biteCount === 1 ? 'bite' : 'bites'}
        </Text>
      </View>
    </>
  );
});

const getStyles = (theme) => StyleSheet.create({
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  biteButton: {
    padding: 4,
  },
  breadEmoji: {
    width: 38,
    height: 38,
  },
  biteCountContainer: {
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  biteCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
}); 