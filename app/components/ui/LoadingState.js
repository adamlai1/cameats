import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export const LoadingState = ({ size = 'large', color = '#1976d2' }) => (
  <View style={styles.container}>
    <ActivityIndicator size={size} color={color} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff'
  }
}); 