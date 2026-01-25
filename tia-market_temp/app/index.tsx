import { AuthContext } from '@/context/AuthContext';
import { Redirect } from 'expo-router';
import { useContext } from 'react';

export default function Index() {
  const { userToken } = useContext(AuthContext);

  // Redirige vers l'authentification ou les onglets selon l'état de connexion
  if (userToken === null) {
    return <Redirect href="/(auth)/login" />;
  } else {
    return <Redirect href="/(tabs)" />;
  }
}