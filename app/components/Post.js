import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { Dimensions, FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { State, TapGestureHandler } from 'react-native-gesture-handler';

const breadNormal = require('../../assets/images/bread-normal.png');
const breadBitten = require('../../assets/images/bread-bitten.png');

const WINDOW_WIDTH = Dimensions.get('window').width;

// Memoized BreadButton component
const BreadButton = memo(({ postId, hasUserBited, onPress }) => (
  <TouchableOpacity 
    style={styles.biteButton}
    onPress={() => onPress(postId)}
    activeOpacity={0.7}
  >
    <Image 
      source={hasUserBited ? breadBitten : breadNormal}
      style={styles.breadEmoji}
      fadeDuration={0}
    />
  </TouchableOpacity>
));

// Grid Post Component
export const GridPost = memo(({ post, onPress }) => (
  <TouchableOpacity onPress={() => onPress(post)} style={styles.gridItem}>
    <Image 
      source={{ uri: post.imageUrls?.[0] || post.imageUrl }} 
      style={styles.gridImage} 
    />
    {post.owners?.length > 1 && (
      <View style={styles.coOwnedBadge}>
        <Ionicons name="people" size={12} color="#fff" />
      </View>
    )}
    {post.imageUrls?.length > 1 && (
      <View style={styles.multipleImagesBadge}>
        <Ionicons name="images" size={12} color="#fff" />
      </View>
    )}
    <View style={styles.gridBiteCounter}>
      <Image 
        source={post.bitedBy?.includes(post.currentUserId) ? breadBitten : breadNormal}
        style={styles.gridBreadEmoji}
      />
      <Text style={styles.gridBiteCount}>{post.bites || 0}</Text>
    </View>
  </TouchableOpacity>
));

// Detail Post Component
export const DetailPost = memo(({ 
  post, 
  currentImageIndex = 0,
  onBitePress,
  onDoubleTapLike,
  onUsernamePress,
  onOptionsPress,
  onImageScroll,
}) => {
  const hasUserBited = post.bitedBy?.includes(post.currentUserId) || false;

  return (
    <View style={styles.postContainer}>
      <View style={styles.postHeader}>
        <View style={styles.headerContent}>
          <ScrollView 
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.usernameScrollContainer}
          >
            <View style={styles.usernameContainer}>
              {(post.owners || [{ id: post.userId, username: post.username || 'Unknown' }]).map((owner, index) => (
                <View key={`${post.id}-owner-${owner.id}-${index}`} style={styles.usernameWrapper}>
                  <TouchableOpacity onPress={() => onUsernamePress(owner.id)}>
                    <Text style={styles.username}>{owner.username}</Text>
                  </TouchableOpacity>
                  {index < (post.owners?.length || 1) - 1 && (
                    <Text style={styles.usernameSeparator}> • </Text>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
          {post.location && (
            <View style={styles.locationContainer}>
              <Ionicons name="location-outline" size={12} color="#666" />
              <Text style={styles.locationText}>{post.location.name}</Text>
            </View>
          )}
        </View>
        {(post.userId === post.currentUserId || post.postOwners?.includes(post.currentUserId)) && (
          <TouchableOpacity 
            style={styles.optionsButton}
            onPress={() => onOptionsPress(post)}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#000" />
          </TouchableOpacity>
        )}
      </View>
      
      <TapGestureHandler
        numberOfTaps={2}
        onHandlerStateChange={(event) => {
          if (event.nativeEvent.state === State.ACTIVE) {
            onDoubleTapLike(post.id);
          }
        }}
      >
        <View style={styles.imageGalleryContainer}>
          <FlatList
            data={post.imageUrls || [post.imageUrl]}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(url, index) => `${post.id}-image-${index}-${url}`}
            renderItem={({ item: imageUrl }) => (
              <Image 
                source={{ uri: imageUrl }} 
                style={styles.postImage}
                resizeMode="cover"
              />
            )}
            onScroll={(e) => onImageScroll(e, post.id)}
            scrollEventThrottle={16}
          />
          {(post.imageUrls?.length > 1 || false) && (
            <View style={styles.paginationDots}>
              {(post.imageUrls || []).map((_, index) => (
                <View
                  key={`${post.id}-dot-${index}`}
                  style={[
                    styles.paginationDot,
                    index === currentImageIndex && styles.paginationDotActive
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      </TapGestureHandler>

      <View style={styles.actionBar}>
        <View style={styles.leftActions}>
          <BreadButton postId={post.id} hasUserBited={hasUserBited} onPress={onBitePress} />
        </View>
      </View>

      <View style={styles.biteCountContainer}>
        <Text style={styles.biteCountText}>
          {post.bites} {post.bites === 1 ? 'bite' : 'bites'}
        </Text>
      </View>

      <View style={styles.postFooter}>
        <Text style={styles.caption}>{post.caption}</Text>
        <Text style={styles.postDate}>
          {post.createdAt?.toDate().toLocaleString() || ''}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  postContainer: {
    backgroundColor: '#fff',
    marginBottom: 10
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12
  },
  headerContent: {
    flexDirection: 'column',
    flex: 1
  },
  usernameScrollContainer: {
    marginBottom: 4
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  usernameWrapper: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  username: {
    fontWeight: '600',
    fontSize: 14
  },
  usernameSeparator: {
    color: '#666',
    marginHorizontal: 4
  },
  optionsButton: {
    padding: 8
  },
  imageGalleryContainer: {
    width: WINDOW_WIDTH,
    aspectRatio: 1,
    backgroundColor: '#f5f5f5'
  },
  postImage: {
    width: WINDOW_WIDTH,
    aspectRatio: 1,
    backgroundColor: '#f5f5f5'
  },
  paginationDots: {
    position: 'absolute',
    bottom: 10,
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center'
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 3
  },
  paginationDotActive: {
    backgroundColor: '#fff',
    width: 8,
    height: 8,
    borderRadius: 4
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  biteButton: {
    padding: 4
  },
  breadEmoji: {
    width: 38,
    height: 38
  },
  biteCountContainer: {
    paddingHorizontal: 12,
    marginBottom: 4
  },
  biteCountText: {
    fontWeight: '600',
    fontSize: 14
  },
  postFooter: {
    padding: 12
  },
  caption: {
    fontSize: 14,
    marginBottom: 4
  },
  postDate: {
    fontSize: 12,
    color: '#666'
  },
  gridItem: {
    width: WINDOW_WIDTH / 3 - 2,
    aspectRatio: 1,
    margin: 1
  },
  gridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f5f5f5'
  },
  coOwnedBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(25, 118, 210, 0.8)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  multipleImagesBadge: {
    position: 'absolute',
    top: 5,
    right: 34,
    backgroundColor: 'rgba(25, 118, 210, 0.8)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  gridBiteCounter: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10
  },
  gridBreadEmoji: {
    width: 19,
    height: 19,
    marginRight: 2
  },
  gridBiteCount: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600'
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2
  },
  locationText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4
  }
}); 