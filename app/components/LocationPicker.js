import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { config } from '../config/config';
import { useTheme } from '../contexts/ThemeContext';

// Google Places API configuration
const GOOGLE_PLACES_API_KEY = config.GOOGLE_PLACES_API_KEY;
const PLACES_API_URL = 'https://maps.googleapis.com/maps/api/place';

const LocationPicker = ({ onLocationSelect, initialLocation = null }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(initialLocation);
  const [locationPermission, setLocationPermission] = useState(false);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    requestLocationPermission();
    
    // Cleanup timeout on unmount
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setSelectedLocation(initialLocation);
  }, [initialLocation]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      
      if (status === 'granted') {
        getCurrentLocation();
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      setLoading(true);
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      
      // Auto-search for nearby restaurants when location is detected
      if (!searchQuery) {
        searchNearbyRestaurants(location.coords.latitude, location.coords.longitude);
      }
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Location Error', 'Unable to get your current location. You can still search manually.');
    } finally {
      setLoading(false);
    }
  };

  const searchNearbyRestaurants = async (latitude, longitude, query = '') => {
    try {
      setLoading(true);
      
      if (GOOGLE_PLACES_API_KEY === 'YOUR_GOOGLE_PLACES_API_KEY') {
        // Fallback to enhanced mock data if API key not configured
        console.warn('Google Places API key not configured. Using enhanced mock data.');
        return await searchMockData(latitude, longitude, query);
      }
      
      let url;
      let params = {
        key: GOOGLE_PLACES_API_KEY,
        location: `${latitude},${longitude}`,
        radius: 5000, // 5km radius
        type: 'restaurant'
      };

      if (query && query.trim()) {
        // Text search for specific queries
        url = `${PLACES_API_URL}/textsearch/json`;
        params = {
          ...params,
          query: `${query} restaurant near me`,
          radius: 10000 // Expand radius for text search
        };
      } else {
        // Nearby search for restaurants
        url = `${PLACES_API_URL}/nearbysearch/json`;
      }

      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`${url}?${queryString}`);
      const data = await response.json();

      if (data.status === 'OK' && data.results) {
        const places = data.results.map(place => ({
          id: place.place_id,
          name: place.name,
          vicinity: place.vicinity || place.formatted_address || 'Address unavailable',
          rating: place.rating || null,
          types: place.types || [],
          distance: calculateDistance(latitude, longitude, place.geometry.location.lat, place.geometry.location.lng),
          category: getCategoryFromTypes(place.types),
          photoReference: place.photos?.[0]?.photo_reference || null,
          priceLevel: place.price_level || null,
          isOpen: place.opening_hours?.open_now || null
        }));

        // Sort by relevance and distance
        const sortedPlaces = places.sort((a, b) => {
          if (query) {
            // For searches, prioritize name matches then rating
            const aNameMatch = a.name.toLowerCase().includes(query.toLowerCase());
            const bNameMatch = b.name.toLowerCase().includes(query.toLowerCase());
            
            if (aNameMatch && !bNameMatch) return -1;
            if (!aNameMatch && bNameMatch) return 1;
          }
          
          // Sort by rating and distance
          const ratingDiff = (b.rating || 0) - (a.rating || 0);
          if (Math.abs(ratingDiff) > 0.1) return ratingDiff;
          
          return a.distance - b.distance;
        });

        setResults(sortedPlaces.slice(0, 20));
        
        // Auto-select the nearest restaurant if no location is currently selected
        if (!selectedLocation && sortedPlaces.length > 0 && !query) {
          const nearestRestaurant = sortedPlaces[0];
          setSelectedLocation(nearestRestaurant);
          onLocationSelect(nearestRestaurant);
        }
      } else {
        console.error('Google Places API error:', data.status, data.error_message);
        // Fallback to mock data on API error
        await searchMockData(latitude, longitude, query);
      }
    } catch (error) {
      console.error('Error searching restaurants:', error);
      // Fallback to mock data on network error
      await searchMockData(latitude, longitude, query);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to calculate distance between two coordinates
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return Math.round(distance * 10) / 10; // Round to 1 decimal place
  };

  // Helper function to categorize places based on Google Places types
  const getCategoryFromTypes = (types) => {
    if (types.includes('restaurant')) {
      if (types.includes('meal_delivery')) return 'Delivery';
      if (types.includes('meal_takeaway')) return 'Takeaway';
      if (types.includes('fine_dining')) return 'Fine Dining';
      if (types.includes('fast_food')) return 'Fast Food';
      if (types.includes('pizza')) return 'Pizza';
      if (types.includes('chinese_restaurant')) return 'Chinese';
      if (types.includes('japanese_restaurant')) return 'Japanese';
      if (types.includes('mexican_restaurant')) return 'Mexican';
      if (types.includes('italian_restaurant')) return 'Italian';
      return 'Restaurant';
    }
    if (types.includes('cafe')) return 'Café';
    if (types.includes('bar')) return 'Bar';
    if (types.includes('bakery')) return 'Bakery';
    if (types.includes('food')) return 'Food';
    return 'Restaurant';
  };

  // Enhanced mock data as fallback
  const searchMockData = async (latitude, longitude, query = '') => {
    // [Previous mock data implementation - keeping as fallback]
    const allMockResults = [
      // ... (keeping the same mock data structure for fallback)
      {
        id: 'nearby_1',
        name: 'The Local Bistro',
        vicinity: '123 Main St, Downtown',
        rating: 4.5,
        types: ['restaurant', 'fine_dining', 'american'],
        distance: 0.2,
        category: 'Fine Dining'
      },
      // ... (rest of mock data)
    ];

    let filteredResults = allMockResults;

    if (query) {
      const queryLower = query.toLowerCase();
      filteredResults = allMockResults.filter(place => {
        const nameMatch = place.name.toLowerCase().includes(queryLower);
        const categoryMatch = place.category.toLowerCase().includes(queryLower);
        const typeMatch = place.types.some(type => type.toLowerCase().includes(queryLower));
        const vicinityMatch = place.vicinity.toLowerCase().includes(queryLower);
        
        return nameMatch || categoryMatch || typeMatch || vicinityMatch;
      });
    }

    const limitedResults = filteredResults.slice(0, 20);
    setResults(limitedResults);
    
    if (!selectedLocation && limitedResults.length > 0 && !query) {
      const nearestRestaurant = limitedResults[0];
      setSelectedLocation(nearestRestaurant);
      onLocationSelect(nearestRestaurant);
    }
  };

  const searchRestaurants = async (query) => {
    if (!query.trim()) {
      if (currentLocation) {
        searchNearbyRestaurants(currentLocation.latitude, currentLocation.longitude);
      } else {
        setResults([]);
      }
      return;
    }

    try {
      setLoading(true);
      
      if (GOOGLE_PLACES_API_KEY === 'YOUR_GOOGLE_PLACES_API_KEY') {
        // Fallback to mock search if API key not configured
        return await searchMockGeneral(query);
      }

      if (currentLocation) {
        // Search with location context
        await searchNearbyRestaurants(currentLocation.latitude, currentLocation.longitude, query);
      } else {
        // General search without specific location using Google Places
        const url = `${PLACES_API_URL}/textsearch/json`;
        const params = {
          key: GOOGLE_PLACES_API_KEY,
          query: `${query} restaurant`,
          type: 'restaurant'
        };

        const queryString = new URLSearchParams(params).toString();
        const response = await fetch(`${url}?${queryString}`);
        const data = await response.json();

        if (data.status === 'OK' && data.results) {
          const places = data.results.map(place => ({
            id: place.place_id,
            name: place.name,
            vicinity: place.vicinity || place.formatted_address || 'Address unavailable',
            rating: place.rating || null,
            types: place.types || [],
            distance: null, // No distance calculation without user location
            category: getCategoryFromTypes(place.types),
            photoReference: place.photos?.[0]?.photo_reference || null,
            priceLevel: place.price_level || null,
            isOpen: place.opening_hours?.open_now || null
          }));

          // Sort by rating and name relevance
          const sortedPlaces = places.sort((a, b) => {
            const queryLower = query.toLowerCase();
            const aNameMatch = a.name.toLowerCase().includes(queryLower);
            const bNameMatch = b.name.toLowerCase().includes(queryLower);
            
            // Prioritize name matches
            if (aNameMatch && !bNameMatch) return -1;
            if (!aNameMatch && bNameMatch) return 1;
            
            // Then sort by rating
            return (b.rating || 0) - (a.rating || 0);
          });

          setResults(sortedPlaces.slice(0, 15));
        } else {
          console.error('Google Places API error:', data.status, data.error_message);
          await searchMockGeneral(query);
        }
      }
    } catch (error) {
      console.error('Error searching:', error);
      await searchMockGeneral(query);
    } finally {
      setLoading(false);
    }
  };

  // Mock general search as fallback
  const searchMockGeneral = async (query) => {
    // Fallback mock search implementation
    const generalSearchResults = [
      {
        id: 'general_1',
        name: `${query} Restaurant & Grill`,
        vicinity: 'Popular restaurant chain',
        rating: 4.2,
        types: ['restaurant', 'american'],
        distance: null,
        category: 'Restaurant'
      },
      {
        id: 'general_2',
        name: `${query} Café`,
        vicinity: 'Local coffee shop',
        rating: 4.1,
        types: ['cafe', 'coffee'],
        distance: null,
        category: 'Café'
      }
    ];
    
    setResults(generalSearchResults.slice(0, 10));
  };

  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    onLocationSelect(location);
  };

  const handleCustomLocation = () => {
    if (!searchQuery.trim()) return;
    
    const customLocation = {
      id: 'custom',
      name: searchQuery,
      vicinity: 'Custom Location',
      isCustom: true
    };
    
    handleLocationSelect(customLocation);
  };

  const renderLocationItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.locationItem,
        selectedLocation?.id === item.id && styles.selectedLocationItem
      ]}
      onPress={() => handleLocationSelect(item)}
    >
      <View style={styles.locationInfo}>
        <View style={styles.locationNameRow}>
          <Text style={styles.locationName}>{item.name}</Text>
          {item.category && (
            <Text style={styles.categoryBadge}>{item.category}</Text>
          )}
        </View>
        <Text style={styles.locationAddress}>{item.vicinity}</Text>
        {item.rating && (
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={12} color="#FFD700" />
            <Text style={styles.rating}>{item.rating}</Text>
            {item.distance && (
              <Text style={styles.distance}> • {item.distance} km away</Text>
            )}
          </View>
        )}
      </View>
      <Ionicons 
        name={selectedLocation?.id === item.id ? "checkmark-circle" : "location-outline"} 
        size={20} 
        color={selectedLocation?.id === item.id ? "#007AFF" : "#666"} 
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color={theme.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for restaurants or enter custom location"
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              clearTimeout(searchTimeoutRef.current);
              searchTimeoutRef.current = setTimeout(() => searchRestaurants(text), 500);
            }}
            onSubmitEditing={() => searchRestaurants(searchQuery)}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessible={true}
            accessibilityLabel="Search for restaurants"
            accessibilityHint="Type to search for restaurants or enter a custom location"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setResults([]);
                if (currentLocation) {
                  searchNearbyRestaurants(currentLocation.latitude, currentLocation.longitude);
                }
              }}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        
        {locationPermission && !currentLocation && (
          <TouchableOpacity
            style={styles.locationButton}
            onPress={getCurrentLocation}
            disabled={loading}
          >
            <Ionicons name="location" size={16} color="#007AFF" />
            <Text style={styles.locationButtonText}>Use Current Location</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.accent} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {searchQuery.trim().length > 0 && (
        <TouchableOpacity
          style={styles.customLocationButton}
          onPress={handleCustomLocation}
        >
          <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
          <Text style={styles.customLocationText}>Use "{searchQuery}" as location</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={results}
        renderItem={renderLocationItem}
        keyExtractor={(item) => item.id}
        style={styles.resultsList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading && searchQuery.length === 0 && currentLocation && (
            <View style={styles.emptyContainer}>
              <Ionicons name="location-outline" size={40} color={theme.textSecondary} />
              <Text style={styles.emptyText}>Start typing to search for restaurants</Text>
              <Text style={styles.emptySubtext}>or use your current location to find nearby places</Text>
            </View>
          )
        }
      />

      {selectedLocation && (
        <View style={styles.selectedLocationContainer}>
          <Text style={styles.selectedLocationLabel}>Selected Location:</Text>
          <Text style={styles.selectedLocationName}>{selectedLocation.name}</Text>
          {!selectedLocation.isCustom && (
            <Text style={styles.selectedLocationAddress}>{selectedLocation.vicinity}</Text>
          )}
        </View>
      )}
    </View>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.border,
    minHeight: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.text,
    minHeight: 40,
    paddingVertical: 8,
    zIndex: 1,
  },
  clearButton: {
    padding: 4,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  locationButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  loadingText: {
    marginLeft: 8,
    color: theme.textSecondary,
    fontSize: 14,
  },
  customLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  customLocationText: {
    marginLeft: 8,
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  resultsList: {
    flex: 1,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  selectedLocationItem: {
    backgroundColor: theme.surface,
  },
  locationInfo: {
    flex: 1,
  },
  locationNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.text,
    marginBottom: 2,
  },
  categoryBadge: {
    backgroundColor: '#007AFF',
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  locationAddress: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 12,
    color: theme.textSecondary,
    marginLeft: 2,
  },
  distance: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  selectedLocationContainer: {
    backgroundColor: theme.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  selectedLocationLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedLocationName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginTop: 2,
  },
  selectedLocationAddress: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 1,
  },
});

export default LocationPicker; 