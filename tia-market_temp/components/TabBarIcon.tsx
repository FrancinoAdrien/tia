import React from 'react';
import { StyleSheet, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface TabBarIconProps {
  name: string;
  color: string;
  size: number;
  focused: boolean;
}

export default function TabBarIcon({ name, color, size, focused }: TabBarIconProps) {
  return (
    <View style={styles.container}>
      <Icon name={name} size={size} color={color} />
      {focused && <View style={styles.indicator} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    position: 'absolute',
    bottom: -8,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1B5E20',
  },
});