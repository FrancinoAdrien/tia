// utils/config.ts

// CONFIGURATION FIXE POUR EXPO GO SUR TÉLÉPHONE PHYSIQUE
const YOUR_COMPUTER_IP = '192.168.88.251';
const BACKEND_PORT = '3001';

export const API_CONFIG = {
  // TOUJOURS utiliser votre IP pour Expo Go sur téléphone
  getBaseURL: () => {
    return `http://${YOUR_COMPUTER_IP}:${BACKEND_PORT}/api`;
  },
  
  logConnectionInfo: () => {
    const baseURL = API_CONFIG.getBaseURL();
    console.log('🚨 ATTENTION: Configuration pour Expo Go sur téléphone physique');
    console.log('📱 URL Backend:', baseURL);
    console.log('💻 Votre PC:', `${YOUR_COMPUTER_IP}:${BACKEND_PORT}`);
    console.log('📡 Test manuel dans Chrome mobile:');
    console.log(`   ${baseURL}/test`);
  },
  
  testConnection: async () => {
    const baseURL = API_CONFIG.getBaseURL();
    const testUrl = `${baseURL}/test`;
    
    console.log('\n🔄 Tentative de connexion...');
    console.log('📡 URL:', testUrl);
    console.log('⏱️  Timeout: 15 secondes\n');
    
    try {
      // Utiliser une timeout plus longue
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const startTime = Date.now();
      const response = await fetch(testUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`✅ CONNEXION RÉUSSIE! (${duration}ms)`);
      console.log('📦 Réponse:', JSON.stringify(data, null, 2));
      return { success: true, data };
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur inconnue';
      console.error('❌ ÉCHEC CONNEXION:', errorMessage);
      
      console.log('\n🔧 GUIDE DE DIAGNOSTIC:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('1️⃣  Vérifiez que le serveur backend est démarré:');
      console.log('   cd tia-market-backend');
      console.log('   node server.cjs');
      console.log('');
      console.log('2️⃣  Testez depuis Chrome sur votre téléphone:');
      console.log(`   http://${YOUR_COMPUTER_IP}:${BACKEND_PORT}/api/test`);
      console.log('');
      console.log('3️⃣  Vérifiez votre IP actuelle:');
      console.log('   Windows: ipconfig | findstr "IPv4"');
      console.log('   Mac/Linux: ifconfig | grep "inet "');
      console.log(`   IP configurée: ${YOUR_COMPUTER_IP}`);
      console.log('');
      console.log('4️⃣  Vérifications réseau:');
      console.log('   ✓ Même réseau WiFi que votre téléphone?');
      console.log('   ✓ Pare-feu Windows autorise le port 3001?');
      console.log('   ✓ Le serveur écoute sur 0.0.0.0:3001?');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      return { 
        success: false, 
        error: errorMessage,
        url: testUrl,
        suggestions: [
          'Vérifiez que le serveur backend est démarré',
          'Testez l\'URL dans Chrome mobile',
          'Vérifiez que vous êtes sur le même réseau WiFi',
          'Vérifiez le pare-feu Windows'
        ]
      };
    }
  }
};