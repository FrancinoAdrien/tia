import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface StarRatingProps {
  rating: number; // Note de 0 à 5
  maxStars?: number; // Nombre maximum d'étoiles (par défaut 5)
  size?: number; // Taille des étoiles
  editable?: boolean; // Permettre de cliquer sur les étoiles pour noter
  onRatingChange?: (rating: number) => void; // Callback quand la note change
  showCount?: boolean; // Afficher le nombre d'évaluations
  count?: number; // Nombre d'évaluations
  color?: string; // Couleur des étoiles pleines
  emptyColor?: string; // Couleur des étoiles vides
}

export default function StarRating({
  rating,
  maxStars = 5,
  size = 16,
  editable = false,
  onRatingChange,
  showCount = false,
  count = 0,
  color = '#FFD700',
  emptyColor = '#E0E0E0',
}: StarRatingProps) {
  const renderStars = () => {
    const stars = [];
    
    for (let i = 1; i <= maxStars; i++) {
      const fillPercentage = Math.max(0, Math.min(1, rating - i + 1));
      
      let starIcon = 'star-outline';
      let starColor = emptyColor;
      
      if (fillPercentage >= 1) {
        starIcon = 'star';
        starColor = color;
      } else if (fillPercentage > 0) {
        starIcon = 'star-half-full';
        starColor = color;
      }
      
      stars.push(
        <TouchableOpacity
          key={i}
          disabled={!editable}
          onPress={() => editable && onRatingChange && onRatingChange(i)}
          style={styles.starButton}
          activeOpacity={editable ? 0.7 : 1}
        >
          <Icon name={starIcon} size={size} color={starColor} />
        </TouchableOpacity>
      );
    }
    
    return stars;
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.starsContainer}>
        {renderStars()}
      </View>
      {showCount && count > 0 && (
        <Text style={[styles.countText, { fontSize: size * 0.75 }]}>
          ({count})
        </Text>
      )}
      {!showCount && rating > 0 && (
        <Text style={[styles.ratingText, { fontSize: size * 0.75 }]}>
          {rating.toFixed(1)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starButton: {
    marginRight: 2,
  },
  countText: {
    marginLeft: 6,
    color: '#666',
    fontWeight: '500',
  },
  ratingText: {
    marginLeft: 6,
    color: '#666',
    fontWeight: '600',
  },
});
