import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useState, useContext } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adsApi, categoriesApi } from '@/utils/api';
import { AuthContext } from '@/context/AuthContext';

const CONDITIONS = [
  { id: 'new', label: 'Neuf', icon: 'sparkles' },
  { id: 'like_new', label: 'Comme neuf', icon: 'shield-checkmark' },
  { id: 'good', label: 'Bon état', icon: 'thumbs-up' },
  { id: 'fair', label: 'État correct', icon: 'build' },
  { id: 'poor', label: 'À réparer', icon: 'alert-circle' },
];

export default function PostAdScreen() {
  const { userToken, userInfo } = useContext(AuthContext);
  const isPremium = userInfo?.isPremium || false;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    priceNegotiable: false,
    condition: 'good' as 'new' | 'like_new' | 'good' | 'fair' | 'poor',
    categoryId: null as number | null,
    categoryName: '',
    city: '',
    postalCode: '',
    quantity: 1, // Nouveau: quantité de produits
    isProfessional: false, // Nouveau: Badge professionnel
    isFeatured: false, // Nouveau: Annonce à la une
    featuredDays: 0 as 0 | 7 | 14, // Durée "À la une"
    isUrgent: false, // Badge urgent
    maxPhotos: 5, // Nombre de photos (peut être augmenté)
  });
  
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [showFeaturedModal, setShowFeaturedModal] = useState(false);
  const [showPhotosModal, setShowPhotosModal] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [featuredCredits, setFeaturedCredits] = useState<{ creditsRemaining: number; isUnlimited: boolean } | null>(null);

  // Charger les catégories depuis la base de données
  useEffect(() => {
    loadCategories();
  }, []);

  // Demander la permission pour la galerie et la caméra
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status: galleryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
        
        if (galleryStatus !== 'granted') {
          Alert.alert('Permission requise', 'Nous avons besoin de la permission pour accéder à vos photos.');
        }
        
        if (cameraStatus !== 'granted') {
          Alert.alert('Permission requise', 'Nous avons besoin de la permission pour utiliser la caméra.');
        }
      }
    })();
  }, []);

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const response = await categoriesApi.getCategories();
      if (response.success) {
        // Filtrer seulement les catégories principales (sans parent_id)
        const mainCategories = response.categories.filter(cat => !cat.parent_id);
        setCategories(mainCategories);
      }
    } catch (error) {
      console.error('❌ Erreur chargement catégories:', error);
      Alert.alert('Erreur', 'Impossible de charger les catégories');
    } finally {
      setLoadingCategories(false);
    }
  };

  const getMaxPhotos = () => {
    if (!isPremium) return 5;
    if (userInfo?.premiumPlan === 'starter') return 10;
    if (userInfo?.premiumPlan === 'pro') return 20;
    if (userInfo?.premiumPlan === 'enterprise') return 999; // Illimité
    return 5;
  };

  const pickImage = async () => {
    const maxPhotos = formData.maxPhotos || getMaxPhotos();
    if (images.length >= maxPhotos) {
      Alert.alert('Limite atteinte', `Vous ne pouvez ajouter que ${maxPhotos} photos maximum.`);
      return;
    }
  
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
  
      if (!result.canceled && result.assets[0].uri) {
        setImages([...images, result.assets[0].uri]);
      }
    } catch (error) {
      console.error('❌ Erreur sélection image:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
    }
  };
  
  const takePhoto = async () => {
    const maxPhotos = formData.maxPhotos || getMaxPhotos();
    if (images.length >= maxPhotos) {
      Alert.alert('Limite atteinte', `Vous ne pouvez ajouter que ${maxPhotos} photos maximum.`);
      return;
    }
  
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // ← CHANGÉ ICI
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
  
      if (!result.canceled && result.assets[0].uri) {
        setImages([...images, result.assets[0].uri]);
      }
    } catch (error) {
      console.error('❌ Erreur prise de photo:', error);
      Alert.alert('Erreur', 'Impossible de prendre une photo');
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

  // Fonction pour uploader les images après la création de l'annonce
  const uploadImagesToAd = async (adId: string): Promise<boolean> => {
    if (images.length === 0) {
      return true; // Pas d'images à uploader
    }

    try {
      setIsUploadingImages(true);
      console.log(`📤 Upload de ${images.length} images pour l'annonce ${adId}`);
      
      const uploadResponse = await adsApi.uploadAdImages(adId, images);
      
      if (uploadResponse.success) {
        console.log(`✅ ${uploadResponse.images.length} images uploadées avec succès`);
        
        if (uploadResponse.errors && uploadResponse.errors.length > 0) {
          console.warn('⚠️ Erreurs partielles:', uploadResponse.errors);
          // Afficher un avertissement mais continuer
          Alert.alert(
            'Images partielles',
            `${uploadResponse.images.length} images ont été uploadées, mais ${uploadResponse.errors.length} ont échoué.`
          );
        }
        
        return true;
      } else {
        console.error('❌ Échec upload images:', uploadResponse.errors);
        Alert.alert(
          'Attention',
          'L\'annonce a été créée mais les images n\'ont pas pu être uploadées. Vous pourrez les ajouter plus tard.'
        );
        return false;
      }
    } catch (error) {
      console.error('❌ Erreur upload images:', error);
      Alert.alert(
        'Attention',
        'L\'annonce a été créée mais une erreur est survenue lors de l\'upload des images.'
      );
      return false;
    } finally {
      setIsUploadingImages(false);
    }
  };

  const handleSubmit = async () => {
    // Vérifier que l'utilisateur est connecté
    if (!userToken) {
      Alert.alert('Non connecté', 'Vous devez être connecté pour publier une annonce.');
      router.push('/(auth)/login');
      return;
    }

    // Validation
    if (!formData.title.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un titre pour votre annonce.');
      return;
    }

    if (!formData.description.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir une description.');
      return;
    }

    if (!formData.price.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un prix.');
      return;
    }

    if (!formData.categoryId) {
      Alert.alert('Erreur', 'Veuillez sélectionner une catégorie.');
      return;
    }

    if (!formData.city.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir une ville.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Préparer les données pour l'API
      const adData = {
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        priceNegotiable: formData.priceNegotiable,
        condition: formData.condition,
        categoryId: formData.categoryId,
        city: formData.city,
        postalCode: formData.postalCode || undefined,
        quantity: formData.quantity || 1,
      };
      
      console.log('📤 Envoi annonce à l\'API:', adData);
      
      // 1. Créer l'annonce
      const response = await adsApi.createAd(adData);
      
      if (!response.success) {
        throw new Error(response.message || 'Erreur lors de la création de l\'annonce');
      }
      
      console.log('✅ Annonce créée:', response.ad);
      
      // 2. Uploader les images si elles existent
      let imagesUploaded = false;
      if (images.length > 0) {
        imagesUploaded = await uploadImagesToAd(response.ad.id);
      }
      
      // 3. Afficher le message de succès
      Alert.alert(
        '🎉 Succès !',
        `Votre annonce "${response.ad.title}" a été publiée avec succès.${
          imagesUploaded && images.length > 0 ? ` ${images.length} image(s) ont été ajoutée(s).` : ''
        }`,
        [
          {
            text: 'Voir mon annonce',
            onPress: () => {
              router.push(`/ad/${response.ad.id}`);
            }
          },
          {
            text: 'OK',
            style: 'default',
            onPress: () => {
              // Réinitialiser le formulaire
              resetForm();
              router.push('/(tabs)');
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('❌ Erreur publication:', error);
      
      let errorMessage = 'Une erreur est survenue lors de la publication.';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message?.includes('Network Error')) {
        errorMessage = 'Impossible de se connecter au serveur. Vérifiez votre connexion.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Erreur', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      price: '',
      priceNegotiable: false,
      condition: 'good',
      categoryId: null,
      categoryName: '',
      city: '',
      postalCode: '',
      quantity: 1,
    });
    setImages([]);
  };

  const formatPrice = (price: string) => {
    if (!price) return '0';
    return price.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const renderImageItem = ({ item, index }: { item: string; index: number }) => (
    <View style={styles.imageItem}>
      <Image source={{ uri: item }} style={styles.image} />
      <TouchableOpacity
        style={styles.removeImageButton}
        onPress={() => removeImage(index)}
      >
        <Ionicons name="close-circle" size={24} color="#FF3B30" />
      </TouchableOpacity>
      {index === 0 && (
        <View style={styles.primaryBadge}>
          <Text style={styles.primaryBadgeText}>Principale</Text>
        </View>
      )}
    </View>
  );

  const selectCategory = (category: any) => {
    setFormData({
      ...formData,
      categoryId: category.id,
      categoryName: category.name,
    });
    setShowCategoryModal(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Déposer une annonce</Text>
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color="#1B5E20" />
            <Text style={styles.infoText}>
              Les images seront uploadées sur le serveur et sauvegardées dans PostgreSQL
            </Text>
          </View>

          {/* Photos */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <Text style={styles.sectionSubtitle}>
              La première photo sera l'image principale de votre annonce
            </Text>
            
            <FlatList
              horizontal
              data={images}
              renderItem={renderImageItem}
              keyExtractor={(item, index) => index.toString()}
              showsHorizontalScrollIndicator={false}
              style={styles.imageList}
              ListHeaderComponent={
                <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="images" size={32} color="#666" />
                    <Text style={styles.addImageText}>Ajouter</Text>
                    <Text style={styles.addImageText}>une photo</Text>
                  </View>
                </TouchableOpacity>
              }
              ListFooterComponent={
                images.length > 0 && (
                  <TouchableOpacity style={styles.takePhotoButton} onPress={takePhoto}>
                    <View style={styles.imagePlaceholder}>
                      <Ionicons name="camera" size={32} color="#1B5E20" />
                      <Text style={[styles.addImageText, { color: '#1B5E20' }]}>Prendre</Text>
                      <Text style={[styles.addImageText, { color: '#1B5E20' }]}>une photo</Text>
                    </View>
                  </TouchableOpacity>
                )
              }
            />
            {images.length === 0 && (
              <Text style={styles.optionalText}>
                Ajoutez des photos pour augmenter vos chances de vente (recommandé)
              </Text>
            )}
            {images.length > 0 && (
              <Text style={styles.imageCountText}>
                {images.length} image{images.length > 1 ? 's' : ''} sélectionnée{images.length > 1 ? 's' : ''}
              </Text>
            )}
          </View>

          {/* Titre */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Titre de l'annonce *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: iPhone 13 Pro Max 256Go"
              value={formData.title}
              onChangeText={(text) => setFormData({ ...formData, title: text })}
              maxLength={80}
            />
            <Text style={styles.charCount}>{formData.title.length}/80</Text>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Décrivez votre article en détail..."
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              maxLength={2000}
            />
            <Text style={styles.charCount}>{formData.description.length}/2000</Text>
          </View>

          {/* Catégorie */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Catégorie *</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowCategoryModal(true)}
              disabled={loadingCategories}
            >
              <Text style={formData.categoryId ? styles.selectButtonText : styles.selectButtonPlaceholder}>
                {formData.categoryName || 'Sélectionnez une catégorie'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
            {loadingCategories && (
              <Text style={styles.loadingText}>Chargement des catégories...</Text>
            )}
          </View>

          {/* État */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>État</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowConditionModal(true)}
            >
              <Text style={styles.selectButtonText}>
                {CONDITIONS.find(c => c.id === formData.condition)?.label || 'Bon état'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Prix */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Prix *</Text>
            <View style={styles.priceContainer}>
              <TextInput
                style={[styles.input, styles.priceInput]}
                placeholder="0"
                value={formData.price}
                onChangeText={(text) => {
                  const numeric = text.replace(/[^0-9]/g, '');
                  setFormData({ ...formData, price: numeric });
                }}
                keyboardType="numeric"
              />
              <Text style={styles.euroSymbol}>Ar</Text>
            </View>
            <View style={styles.priceDetails}>
              <Text style={styles.priceFormatted}>
                {formatPrice(formData.price)} Ar
              </Text>
              <TouchableOpacity
                style={styles.negotiableContainer}
                onPress={() => setFormData({ ...formData, priceNegotiable: !formData.priceNegotiable })}
              >
                <Ionicons
                  name={formData.priceNegotiable ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={formData.priceNegotiable ? '#1B5E20' : '#666'}
                />
                <Text style={styles.negotiableText}>Prix négociable</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quantité */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quantité disponible *</Text>
            <Text style={styles.sectionSubtitle}>
              {isPremium 
                ? userInfo?.premiumPlan === 'starter' 
                  ? 'Maximum: 20 produits (Plan Starter)'
                  : userInfo?.premiumPlan === 'pro'
                  ? 'Maximum: 40 produits (Plan Pro)'
                  : userInfo?.premiumPlan === 'enterprise'
                  ? 'Quantité illimitée (Plan Entreprise)'
                  : 'Maximum: 1 produit (Standard)'
                : 'Maximum: 1 produit (Standard)'
              }
            </Text>
            <TextInput
              style={styles.input}
              placeholder="1"
              value={formData.quantity.toString()}
              onChangeText={(text) => {
                const numeric = text.replace(/[^0-9]/g, '');
                const maxQuantity = isPremium 
                  ? userInfo?.premiumPlan === 'starter' ? 20
                    : userInfo?.premiumPlan === 'pro' ? 40
                    : userInfo?.premiumPlan === 'enterprise' ? 999999
                    : 1
                  : 1;
                const quantity = numeric ? Math.min(parseInt(numeric) || 1, maxQuantity) : 1;
                setFormData({ ...formData, quantity });
              }}
              keyboardType="numeric"
            />
          </View>

          {/* Options Premium - Visible uniquement pour les premium */}
          {isPremium && (
            <View style={styles.premiumSection}>
              <View style={styles.premiumHeaderRow}>
                <Ionicons name="crown" size={20} color="#FFD700" />
                <Text style={styles.premiumSectionTitle}>Options Premium</Text>
              </View>

              {/* Badge Professionnel */}
              <TouchableOpacity
                style={[styles.premiumOption, formData.isProfessional && styles.premiumOptionActive]}
                onPress={() => setFormData({ ...formData, isProfessional: !formData.isProfessional })}
              >
                <View style={styles.premiumOptionLeft}>
                  <Ionicons
                    name={formData.isProfessional ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={formData.isProfessional ? '#FF6B35' : '#999'}
                  />
                  <View style={styles.premiumOptionText}>
                    <Text style={styles.premiumOptionTitle}>Badge Professionnel</Text>
                    <Text style={styles.premiumOptionDesc}>Marquez votre annonce comme professionnelle</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Mettre à la une */}
              <TouchableOpacity
                style={[styles.premiumOption, formData.isFeatured && styles.premiumOptionActive]}
                onPress={() => setFormData({ ...formData, isFeatured: !formData.isFeatured })}
              >
                <View style={styles.premiumOptionLeft}>
                  <Ionicons
                    name={formData.isFeatured ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={formData.isFeatured ? '#FFD166' : '#999'}
                  />
                  <View style={styles.premiumOptionText}>
                    <Text style={styles.premiumOptionTitle}>Mettre à la une</Text>
                    <Text style={styles.premiumOptionDesc}>Augmentez votre visibilité pendant 30 jours</Text>
                  </View>
                </View>
                <Text style={styles.premiumOptionPrice}>Gratuit</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Localisation */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Localisation *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ville"
              value={formData.city}
              onChangeText={(text) => setFormData({ ...formData, city: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Code postal (optionnel)"
              value={formData.postalCode}
              onChangeText={(text) => setFormData({ ...formData, postalCode: text })}
              keyboardType="numeric"
              maxLength={5}
            />
          </View>

          {/* Bouton de soumission */}
          <TouchableOpacity
            style={[styles.submitButton, (isSubmitting || isUploadingImages) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting || isUploadingImages}
          >
            {(isSubmitting || isUploadingImages) ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#FFF" />
                <Text style={styles.submitButtonText}>
                  {isUploadingImages ? 'Upload des images...' : 'Publication...'}
                </Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>Publier l'annonce</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            En publiant cette annonce, vous acceptez nos Conditions Générales d'Utilisation.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal des catégories */}
      <Modal
        visible={showCategoryModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choisissez une catégorie</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {loadingCategories ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1B5E20" />
                <Text style={styles.loadingText}>Chargement des catégories...</Text>
              </View>
            ) : (
              <FlatList
                data={categories}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.categoryItem}
                    onPress={() => selectCategory(item)}
                  >
                    <Ionicons name={item.icon as any || 'tag'} size={24} color="#1B5E20" />
                    <Text style={styles.categoryText}>{item.name}</Text>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item.id.toString()}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="alert-circle-outline" size={48} color="#999" />
                    <Text style={styles.emptyText}>Aucune catégorie disponible</Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Modal des conditions */}
      <Modal
        visible={showConditionModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>État de l'article</Text>
              <TouchableOpacity onPress={() => setShowConditionModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={CONDITIONS}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.conditionItem}
                  onPress={() => {
                    setFormData({ ...formData, condition: item.id as any });
                    setShowConditionModal(false);
                  }}
                >
                  <Ionicons name={item.icon as any} size={24} color="#1B5E20" />
                  <Text style={styles.conditionText}>{item.label}</Text>
                  {formData.condition === item.id && (
                    <Ionicons name="checkmark" size={24} color="#1B5E20" />
                  )}
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id}
            />
          </View>
        </View>
      </Modal>

      {/* Modal "À la une" */}
      <Modal
        visible={showFeaturedModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFeaturedModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Mettre à la une</Text>
              <TouchableOpacity onPress={() => setShowFeaturedModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              {featuredCredits?.isUnlimited 
                ? 'Pack Entreprise: Illimité' 
                : featuredCredits && featuredCredits.creditsRemaining > 0
                ? `${featuredCredits.creditsRemaining} crédits gratuits disponibles`
                : 'Augmentez la visibilité de votre annonce'}
            </Text>
            
            <TouchableOpacity
              style={[styles.featuredOption, formData.featuredDays === 7 && styles.featuredOptionActive]}
              onPress={() => {
                setFormData({ ...formData, isFeatured: true, featuredDays: 7 });
                setShowFeaturedModal(false);
              }}
            >
              <View style={styles.featuredOptionLeft}>
                <Ionicons name="star" size={24} color="#FFD166" />
                <View style={styles.featuredOptionText}>
                  <Text style={styles.featuredOptionTitle}>7 jours</Text>
                  <Text style={styles.featuredOptionDesc}>Visibilité maximale pendant 7 jours</Text>
                </View>
              </View>
              <Text style={styles.featuredOptionPrice}>
                {(featuredCredits?.isUnlimited || (featuredCredits && featuredCredits.creditsRemaining > 0)) ? 'Gratuit' : '10 000 Ar'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.featuredOption, formData.featuredDays === 14 && styles.featuredOptionActive]}
              onPress={() => {
                setFormData({ ...formData, isFeatured: true, featuredDays: 14 });
                setShowFeaturedModal(false);
              }}
            >
              <View style={styles.featuredOptionLeft}>
                <Ionicons name="star" size={24} color="#FFD166" />
                <View style={styles.featuredOptionText}>
                  <Text style={styles.featuredOptionTitle}>14 jours</Text>
                  <Text style={styles.featuredOptionDesc}>Visibilité maximale pendant 14 jours</Text>
                </View>
              </View>
              <Text style={styles.featuredOptionPrice}>
                {(featuredCredits?.isUnlimited || (featuredCredits && featuredCredits.creditsRemaining > 0)) ? 'Gratuit' : '18 000 Ar'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.featuredOption}
              onPress={() => {
                setFormData({ ...formData, isFeatured: false, featuredDays: 0 });
                setShowFeaturedModal(false);
              }}
            >
              <Text style={styles.featuredOptionCancel}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Photos supplémentaires */}
      <Modal
        visible={showPhotosModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPhotosModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Photos supplémentaires</Text>
              <TouchableOpacity onPress={() => setShowPhotosModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Ajoutez plus de photos pour augmenter vos chances de vente
            </Text>
            
            <TouchableOpacity
              style={[styles.featuredOption, formData.maxPhotos === 10 && styles.featuredOptionActive]}
              onPress={() => {
                setFormData({ ...formData, maxPhotos: 10 });
                setShowPhotosModal(false);
              }}
            >
              <View style={styles.featuredOptionLeft}>
                <Ionicons name="images" size={24} color="#118AB2" />
                <View style={styles.featuredOptionText}>
                  <Text style={styles.featuredOptionTitle}>10 photos</Text>
                  <Text style={styles.featuredOptionDesc}>5 photos supplémentaires</Text>
                </View>
              </View>
              <Text style={styles.featuredOptionPrice}>2 000 Ar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.featuredOption, formData.maxPhotos === 20 && styles.featuredOptionActive]}
              onPress={() => {
                setFormData({ ...formData, maxPhotos: 20 });
                setShowPhotosModal(false);
              }}
            >
              <View style={styles.featuredOptionLeft}>
                <Ionicons name="images" size={24} color="#118AB2" />
                <View style={styles.featuredOptionText}>
                  <Text style={styles.featuredOptionTitle}>20 photos</Text>
                  <Text style={styles.featuredOptionDesc}>15 photos supplémentaires</Text>
                </View>
              </View>
              <Text style={styles.featuredOptionPrice}>4 000 Ar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.featuredOption}
              onPress={() => {
                setFormData({ ...formData, maxPhotos: getMaxPhotos() });
                setShowPhotosModal(false);
              }}
            >
              <Text style={styles.featuredOptionCancel}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#2E7D32',
    marginLeft: 8,
  },
  section: {
    backgroundColor: '#FFF',
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  optionalText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 8,
  },
  imageCountText: {
    fontSize: 12,
    color: '#1B5E20',
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  imageList: {
    marginBottom: 12,
  },
  addImageButton: {
    marginRight: 8,
  },
  takePhotoButton: {
    marginLeft: 8,
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  addImageText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  imageItem: {
    marginRight: 8,
    position: 'relative',
  },
  image: {
    width: 120,
    height: 120,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFF',
    borderRadius: 12,
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(27, 94, 32, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  primaryBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FFF',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFF',
  },
  selectButtonText: {
    fontSize: 16,
    color: '#333',
  },
  selectButtonPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  loadingText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceInput: {
    flex: 1,
    marginRight: 8,
  },
  euroSymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  priceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  priceFormatted: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B5E20',
  },
  negotiableContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  negotiableText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#1B5E20',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 16,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#1B5E20AA',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#666',
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  categoryText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  conditionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  conditionText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },

  // Premium Styles
  premiumSection: {
    backgroundColor: '#F8F8FF',
    borderTopWidth: 2,
    borderTopColor: '#FFD700',
    borderBottomWidth: 2,
    borderBottomColor: '#FFD700',
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  premiumHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  premiumSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFD700',
  },
  premiumOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  premiumOptionActive: {
    backgroundColor: '#FFF8E1',
    borderColor: '#FFD700',
  },
  premiumOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  premiumOptionText: {
    flex: 1,
  },
  premiumOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  premiumOptionDesc: {
    fontSize: 12,
    color: '#666',
  },
  premiumOptionPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1B5E20',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  featuredOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  featuredOptionActive: {
    backgroundColor: '#FFF8E1',
    borderColor: '#FFD166',
    borderWidth: 2,
  },
  featuredOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  featuredOptionText: {
    flex: 1,
  },
  featuredOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  featuredOptionDesc: {
    fontSize: 12,
    color: '#666',
  },
  featuredOptionPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1B5E20',
  },
  featuredOptionCancel: {
    textAlign: 'center',
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
    padding: 16,
  },
});