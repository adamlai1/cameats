import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export const AddFriendModal = ({
  visible,
  onClose,
  searchUsername,
  onSearchChange,
  searching,
  searchResults,
  onSendRequest
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Friend</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by username"
              placeholderTextColor={theme.textSecondary}
              value={searchUsername}
              onChangeText={onSearchChange}
              autoCapitalize="none"
            />
            {searching && (
              <ActivityIndicator style={styles.searchSpinner} />
            )}
          </View>

          <FlatList
            data={searchResults}
            keyExtractor={item => `search-${item.id}`}
            renderItem={({ item }) => (
              <View style={styles.searchResultItem}>
                <Text style={styles.searchResultUsername}>{item.username}</Text>
                {item.isFriend ? (
                  <View style={[styles.addButton, styles.addedButton]}>
                    <Text style={styles.addedButtonText}>Added</Text>
                  </View>
                ) : item.hasPendingRequest ? (
                  <View style={[styles.addButton, styles.pendingButton]}>
                    <Text style={styles.pendingButtonText}>Pending</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => onSendRequest(item)}
                  >
                    <Text style={styles.addButtonText}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            ListEmptyComponent={
              searchUsername ? (
                <Text style={styles.emptyText}>No users found</Text>
              ) : (
                <Text style={styles.emptyText}>Search for users to add</Text>
              )
            }
          />
        </View>
      </View>
    </Modal>
  );
};

export const FriendRequestsModal = ({
  visible,
  onClose,
  friendRequests,
  onAcceptRequest
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Friend Requests</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={friendRequests}
            keyExtractor={item => `request-${item.id}`}
            renderItem={({ item }) => (
              <View style={styles.requestItem}>
                <View style={styles.requestInfo}>
                  <Text style={styles.requestUsername}>{item.username}</Text>
                </View>
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() => onAcceptRequest(item.id)}
                >
                  <Text style={styles.acceptButtonText}>Accept</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No friend requests</Text>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (theme) => StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  modalContent: {
    backgroundColor: theme.background,
    borderRadius: 15,
    padding: 20,
    maxHeight: '80%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text
  },
  searchContainer: {
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center'
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: theme.text,
    backgroundColor: theme.surface
  },
  searchSpinner: {
    marginLeft: 10
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border
  },
  searchResultUsername: {
    fontSize: 16,
    color: theme.text
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#0095f6'
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600'
  },
  addedButton: {
    backgroundColor: theme.surface
  },
  addedButtonText: {
    color: theme.textSecondary,
    fontWeight: '600'
  },
  pendingButton: {
    backgroundColor: '#e3f2fd'
  },
  pendingButtonText: {
    color: '#0095f6',
    fontWeight: '600'
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border
  },
  requestInfo: {
    flex: 1
  },
  requestUsername: {
    fontSize: 16,
    color: theme.text
  },
  acceptButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#0095f6'
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '600'
  },
  emptyText: {
    textAlign: 'center',
    color: theme.textSecondary,
    fontSize: 16,
    marginTop: 20
  }
}); 