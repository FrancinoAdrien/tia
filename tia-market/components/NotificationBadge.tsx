import React, { useContext, useEffect, useState } from 'react';
import { TouchableOpacity, View, StyleSheet, Badge } from 'react-native';
import { router } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { messagingApi } from '@/utils/api';
import { AuthContext } from '@/context/AuthContext';

export default function NotificationBadge() {
  const { userInfo } = useContext(AuthContext);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const response = await messagingApi.getNotifications(100);
        if (response.success && response.notifications) {
          const unreadCount = response.notifications.filter(n => !n.is_read).length;
          setNotificationCount(unreadCount);
        }
      } catch (error) {
        console.error('❌ Erreur chargement notifications:', error);
      }
    };

    // Charger les notifications au montage
    loadNotifications();

    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(loadNotifications, 30000);

    return () => clearInterval(interval);
  }, [userInfo?.id]);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => router.push('/alerts')}
      activeOpacity={0.7}
    >
      <Icon name="bell-outline" size={24} color="#1B5E20" />
      {notificationCount > 0 && (
        <View style={styles.badge}>
          <Icon name="circle" size={16} color="#FF6B35" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginRight: 16,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
});
