import { useRouter } from 'expo-router';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
    FlatList,
    RefreshControl,
    SafeAreaView,
    StyleSheet
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { auth } from '../../../firebase';
import { GridPost } from '../../components/Post';
import { ProfileHeader } from '../../components/profile/ProfileHeader';
import { AddFriendModal, FriendRequestsModal } from '../../components/profile/ProfileModals';
import { LoadingState } from '../../components/ui/LoadingState';
import * as postService from '../../services/postService';
import * as userService from '../../services/userService';

const ProfileScreen = forwardRef((props, ref) => {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [profilePicUrl, setProfilePicUrl] = useState(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [friendsList, setFriendsList] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [posts, setPosts] = useState([]);
  const [showFriendsList, setShowFriendsList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const router = useRouter();
  const gridListRef = useRef(null);

  // Expose scrollToTop function to parent component
  useImperativeHandle(ref, () => ({
    scrollToTop: () => {
      if (gridListRef.current) {
        gridListRef.current.scrollToOffset({ offset: 0, animated: true });
      }
    }
  }), []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const userData = await userService.getCurrentUserProfile();
      
      setUsername(userData.username);
      setEmail(userData.email);
      setDisplayName(userData.displayName || '');
      setBio(userData.bio || '');
      setProfilePicUrl(userData.profilePicUrl);
      setFriendsList(userData.friends || []);
      setFriendRequests(userData.friendRequests || []);

      // Show profile info immediately, then load posts
      setLoading(false);

      // Fetch user's posts
      const userPosts = await postService.fetchPosts([auth.currentUser.uid]);
      setPosts(userPosts);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
  };

  const handleSearch = async (text) => {
    setSearchUsername(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const results = await userService.searchUsers(text, friendsList, friendRequests);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    }
    setSearching(false);
  };

  const handleSendFriendRequest = async (toUser) => {
    try {
      await userService.sendFriendRequest(toUser.id, username);
      setSearchResults(searchResults.filter(user => user.id !== toUser.id));
    } catch (error) {
      console.error('Error sending friend request:', error);
    }
  };

  const handleAcceptFriendRequest = async (fromUid) => {
    try {
      await userService.acceptFriendRequest(fromUid);
      fetchProfile(); // Refresh the profile data
    } catch (error) {
      console.error('Error accepting friend request:', error);
    }
  };

  const handlePostPress = async (post) => {
    try {
      // Pass essential data to ProfilePostsView for fresh data fetching
      const essentialData = posts.map(p => ({
        id: p.id,
        userId: p.userId,
        username: p.username,
        postOwners: p.postOwners || []
      }));
      
      router.push({
        pathname: '/ProfilePostsView',
        params: { 
          postIds: JSON.stringify(essentialData),
          initialIndex: posts.findIndex(p => p.id === post.id).toString(),
          username: username
        }
      });
    } catch (error) {
      console.error('Error navigating to posts:', error);
    }
  };

  const renderGridPost = useCallback(({ item }) => (
    <GridPost 
      post={{ ...item, currentUserId: auth.currentUser.uid }}
      onPress={handlePostPress}
    />
  ), [handlePostPress]);

  const renderContent = () => {
    if (loading && !refreshing) {
      return <LoadingState />;
    }

    return (
      <FlatList
        key="grid"
        ref={gridListRef}
        data={posts}
        renderItem={renderGridPost}
        keyExtractor={item => item.id ? `post-${item.id}` : `generated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`}
        numColumns={3}
        ListHeaderComponent={
          <ProfileHeader
            username={username}
            displayName={displayName}
            bio={bio}
            profilePicUrl={profilePicUrl}
            postsCount={posts.length}
            friendsCount={friendsList.length}
            uploadingPic={uploadingPic}
            onProfilePicPress={handleProfilePicPress}
            onAddFriendPress={() => setShowAddFriend(true)}
            onFriendRequestsPress={() => setShowFriendRequests(true)}
            onSettingsPress={() => setShowSettings(true)}
            onFriendsPress={() => router.push({
              pathname: '/FriendsList',
              params: { userId: auth.currentUser.uid }
            })}
            friendRequestsCount={friendRequests.length}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {renderContent()}
      </GestureHandlerRootView>

      <AddFriendModal
        visible={showAddFriend}
        onClose={() => {
          setShowAddFriend(false);
          setSearchUsername('');
          setSearchResults([]);
        }}
        searchUsername={searchUsername}
        onSearchChange={handleSearch}
        searching={searching}
        searchResults={searchResults}
        onSendRequest={handleSendFriendRequest}
      />

      <FriendRequestsModal
        visible={showFriendRequests}
        onClose={() => setShowFriendRequests(false)}
        friendRequests={friendRequests}
        onAcceptRequest={handleAcceptFriendRequest}
      />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  }
});

export default ProfileScreen; 