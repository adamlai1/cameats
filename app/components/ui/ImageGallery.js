import React from 'react';
import { Dimensions, FlatList, Image, StyleSheet, View } from 'react-native';

const WINDOW_WIDTH = Dimensions.get('window').width;

export const ImageGallery = ({ 
  images, 
  currentIndex = 0,
  onScroll,
  showPagination = true,
  imageStyle = {}
}) => (
  <View style={styles.container}>
    <FlatList
      data={Array.isArray(images) ? images : [images]}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      keyExtractor={(url, index) => `image-${index}-${url}`}
      renderItem={({ item: imageUrl }) => (
        <Image 
          source={{ uri: imageUrl }} 
          style={[styles.image, imageStyle]}
          resizeMode="cover"
        />
      )}
      onScroll={onScroll}
      scrollEventThrottle={16}
    />
    {showPagination && Array.isArray(images) && images.length > 1 && (
      <View style={styles.paginationDots}>
        {images.map((_, index) => (
          <View
            key={`dot-${index}`}
            style={[
              styles.paginationDot,
              index === currentIndex && styles.paginationDotActive
            ]}
          />
        ))}
      </View>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    width: WINDOW_WIDTH,
    aspectRatio: 1,
    backgroundColor: '#f5f5f5'
  },
  image: {
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
  }
}); 