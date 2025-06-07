import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const ProfileHeader = ({
  username,
  displayName,
  bio,
  profilePicUrl,
  postsCount,
  friendsCount,
  uploadingPic,
  onProfilePicPress,
  onAddFriendPress,
  onFriendRequestsPress,
  onSettingsPress,
  onFriendsPress,
  friendRequestsCount = 0
}) => (
  <View style={styles.header}>
    <View style={styles.headerTop}>
      <Text style={styles.username}>{username}</Text>
      <View style={styles.headerButtons}>
        <TouchableOpacity 
          style={styles.addFriendButton}
          onPress={onAddFriendPress}
        >
          <Ionicons name="person-add-outline" size={24} color="#0095f6" />
        </TouchableOpacity>
        {friendRequestsCount > 0 && (
          <TouchableOpacity 
            style={styles.requestButton}
            onPress={onFriendRequestsPress}
          >
            <Ionicons name="person-add" size={24} color="#0095f6" />
            <View style={styles.requestBadge}>
              <Text style={styles.requestCount}>{friendRequestsCount}</Text>
            </View>
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={onSettingsPress}
        >
          <Ionicons name="settings-outline" size={24} color="black" />
        </TouchableOpacity>
      </View>
    </View>

    <View style={styles.profileInfo}>
      <TouchableOpacity 
        style={styles.profilePicContainer}
        onPress={onProfilePicPress}
      >
        <View style={styles.profilePic}>
          {profilePicUrl ? (
            <Image 
              source={{ uri: profilePicUrl }} 
              style={styles.profilePicImage} 
            />
          ) : (
            <Ionicons name="person" size={40} color="#666" />
          )}
          {uploadingPic && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
        </View>
        <View style={styles.editIconContainer}>
          <Ionicons name="camera" size={14} color="#fff" />
        </View>
      </TouchableOpacity>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{postsCount}</Text>
          <Text style={styles.statLabel}>Meals</Text>
        </View>

        <TouchableOpacity 
          style={styles.statItem}
          onPress={onFriendsPress}
        >
          <Text style={styles.statNumber}>{friendsCount}</Text>
          <Text style={styles.statLabel}>Friends</Text>
        </TouchableOpacity>
      </View>
    </View>

    <View style={styles.bioContainer}>
      {displayName && <Text style={styles.displayName}>{displayName}</Text>}
      {bio ? (
        <Text style={styles.bio}>{bio}</Text>
      ) : (
        <Text style={styles.noBio}>No bio yet</Text>
      )}
    </View>
  </View>
);

const styles = StyleSheet.create({
  header: {
    padding: 15
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15
  },
  username: {
    fontSize: 20,
    fontWeight: 'bold'
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  addFriendButton: {
    marginRight: 15
  },
  requestButton: {
    marginRight: 15
  },
  requestBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ff3b30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4
  },
  requestCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15
  },
  profilePicContainer: {
    marginRight: 30,
    position: 'relative'
  },
  profilePic: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  profilePicImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#1976d2',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  statsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  statItem: {
    alignItems: 'center'
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  statLabel: {
    color: '#666'
  },
  bioContainer: {
    marginTop: 10
  },
  displayName: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4
  },
  bio: {
    fontSize: 14,
    color: '#262626',
    lineHeight: 20
  },
  noBio: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic'
  }
}); 