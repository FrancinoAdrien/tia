# Guide de résolution des problèmes de connexion

## Erreur "Network request failed" ou "Pas de réponse du serveur"

### ✅ Vérifications à faire dans l'ordre :

#### 1. Vérifier que le serveur backend est démarré
```bash
cd tia-market-backend
node server.cjs
```

Vous devriez voir :
```
🚀 BACKEND TIA MARKET DÉMARRÉ
📡 Serveur: http://0.0.0.0:3001
💻 Local: http://localhost:3001
📱 Mobile: http://192.168.43.213:3001
```

#### 2. Vérifier votre IP actuelle
Sur Windows (PowerShell) :
```powershell
ipconfig | findstr "IPv4"
```

Sur Mac/Linux :
```bash
ifconfig | grep "inet "
```

**Important** : Si votre IP a changé, mettez à jour `tia-market/utils/config.ts` :
```typescript
const YOUR_COMPUTER_IP = 'VOTRE_NOUVELLE_IP'; // Ex: '192.168.43.213'
```

#### 3. Tester la connexion depuis votre téléphone
1. Ouvrez Chrome sur votre téléphone
2. Allez à : `http://192.168.43.213:3001/api/test`
3. Si ça fonctionne → Le problème est dans le code de l'app
4. Si ça ne fonctionne pas → Continuez avec les étapes suivantes

#### 4. Vérifier que vous êtes sur le même réseau WiFi
- Votre ordinateur et votre téléphone doivent être sur le **même réseau WiFi**
- Vérifiez que le WiFi n'est pas en mode "invité" ou isolé

#### 5. Vérifier le pare-feu Windows
1. Ouvrez "Pare-feu Windows Defender"
2. Cliquez sur "Paramètres avancés"
3. Cliquez sur "Règles de trafic entrant"
4. Vérifiez qu'il y a une règle pour le port 3001
5. Si non, créez une nouvelle règle :
   - Type : Port
   - Protocole : TCP
   - Port : 3001
   - Action : Autoriser la connexion

#### 6. Vérifier que le serveur écoute sur toutes les interfaces
Dans `tia-market-backend/server.cjs`, vérifiez :
```javascript
const HOST = '0.0.0.0'; // ✅ Correct - écoute sur toutes les interfaces
// ❌ PAS 'localhost' ou '127.0.0.1'
```

#### 7. Redémarrer Expo
```bash
# Dans le terminal de l'app
# Appuyez sur 'r' pour recharger
# Ou arrêtez et relancez :
npx expo start --clear
```

### 🔧 Solutions rapides

#### Solution 1 : Redémarrer le serveur backend
```bash
# Arrêtez le serveur (Ctrl+C)
# Puis relancez :
cd tia-market-backend
node server.cjs
```

#### Solution 2 : Vérifier l'IP et mettre à jour
1. Trouvez votre IP : `ipconfig` (Windows) ou `ifconfig` (Mac/Linux)
2. Mettez à jour `tia-market/utils/config.ts`
3. Redémarrez Expo

#### Solution 3 : Utiliser ngrok (si le WiFi ne fonctionne pas)
```bash
# Installer ngrok
npm install -g ngrok

# Dans un terminal séparé
ngrok http 3001

# Utilisez l'URL HTTPS fournie par ngrok dans config.ts
```

### 📱 Test depuis l'app

L'app affiche maintenant des messages de diagnostic détaillés dans la console. Vérifiez :
- L'URL tentée
- La base URL configurée
- Les suggestions de vérification

### ⚠️ Erreurs courantes

1. **"Network Error"** → Serveur non démarré ou IP incorrecte
2. **"Connection refused"** → Pare-feu bloque le port
3. **"Timeout"** → Serveur trop lent ou réseau instable
4. **"CORS error"** → Problème de configuration CORS (normalement géré)

### 🆘 Si rien ne fonctionne

1. Vérifiez les logs du serveur backend
2. Vérifiez les logs de l'app Expo
3. Testez avec Postman ou curl :
   ```bash
   curl http://192.168.43.213:3001/api/test
   ```
4. Essayez de vous connecter depuis un autre appareil sur le même réseau
