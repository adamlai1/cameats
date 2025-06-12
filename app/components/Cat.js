import React, { memo, useEffect, useReducer, useRef } from 'react';
import {
    Image,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useCat } from '../contexts/CatContext';

// Cat images (flipped to face right) - with fallback
let catClosedMouth, catOpenMouth;
try {
  catClosedMouth = require('../../assets/images/cat-closed-mouth.png');
  catOpenMouth = require('../../assets/images/cat-open-mouth.png');
} catch (error) {
  catClosedMouth = null;
  catOpenMouth = null;
}

// Simple reducer for eating state
const eatingReducer = (state, action) => {
  switch (action.type) {
    case 'START_EATING':
      return { isEating: true };
    case 'STOP_EATING':
      return { isEating: false };
    default:
      return state;
  }
};

const Cat = memo(() => {
  const { registerCatEating, registerCatPosition } = useCat();
  const [eatingState, dispatch] = useReducer(eatingReducer, { isEating: false });
  const timeoutRef = useRef(null);
  const catRef = useRef(null);

  // Register eating function and position when component mounts
  useEffect(() => {
    // Register immediately - don't defer with InteractionManager
    const eatFunction = () => {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      dispatch({ type: 'START_EATING' });
      
      // Close mouth after 1.1 seconds (reduced by 0.6 seconds)
      timeoutRef.current = setTimeout(() => {
        dispatch({ type: 'STOP_EATING' });
      }, 1100);
    };
    
    registerCatEating(eatFunction);
    registerCatPosition(catRef.current);
    
    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []); // Only run once on mount

  const catSize = 35; // Fixed size

  // Use emoji fallback if images don't exist
  if (!catClosedMouth || !catOpenMouth) {
    return (
      <View style={styles.container} ref={catRef}>
        <View style={styles.catContainer}>
          <Text style={[styles.catEmoji, { fontSize: catSize, transform: [{ scaleX: -1 }] }]}>
            {eatingState.isEating ? '😸' : '😺'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} ref={catRef}>
      <View style={styles.catContainer}>
        <Image
          source={eatingState.isEating ? catOpenMouth : catClosedMouth}
          style={[
            styles.catImage,
            {
              width: catSize,
              height: catSize,
            },
          ]}
          resizeMode="contain"
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
  },
  catContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  catImage: {
    // Transform to flip horizontally (face right)
    transform: [{ scaleX: -1 }],
  },
  catEmoji: {
    textAlign: 'center',
  },
});

export default Cat; 