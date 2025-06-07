import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const FriendListItem = ({ 
  friend,
  onPress,
  showChevron = true,
  rightComponent = null
}) => (
  <TouchableOpacity 
    style={styles.container}
    onPress={() => onPress?.(friend)}
  >
    {friend.profilePicUrl ? (
      <Image
        source={{ uri: friend.profilePicUrl }}
        style={styles.avatar}
      />
    ) : (
      <View style={[styles.avatar, styles.defaultAvatar]}>
        <Ionicons name="person" size={30} color="#666" />
      </View>
    )}
    <View style={styles.info}>
      <Text style={styles.name}>{friend.displayName || friend.username}</Text>
      <Text style={styles.username}>@{friend.username}</Text>
    </View>
    {rightComponent || (showChevron && (
      <Ionicons name="chevron-forward" size={20} color="#666" />
    ))}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15
  },
  defaultAvatar: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  info: {
    flex: 1
  },
  name: {
    fontSize: 16,
    fontWeight: '500'
  },
  username: {
    fontSize: 14,
    color: '#666'
  }
}); 