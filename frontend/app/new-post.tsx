import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { File as ExpoFile, UploadType } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from '@react-native-vector-icons/ionicons';

import { api, getToken } from '../src/auth';
import { useT } from '../src/i18n/LanguageProvider';
import { COLORS, SPACING, RADIUS } from '../src/theme';
import PostMedia from '../src/components/PostMedia';

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL!;
type SelectedMedia = { uri: string; type: 'image' | 'video'; path: string };

export default function NewPost() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();

  const [caption, setCaption] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [recipe, setRecipe] = useState<any>(null);
  const [posting, setPosting] = useState(false);
  const [attachRecipe, setAttachRecipe] = useState(false);
  const [authorRating, setAuthorRating] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('lastRecipe').then((v) => {
      if (v) {
        setRecipe(JSON.parse(v));
        setAttachRecipe(true);
      }
    });
  }, []);

  const pick = async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      allowsEditing: false,
      quality: 0.9,
    });
    if (res.canceled) return;
    try {
      const uploaded: SelectedMedia[] = [];
      for (const asset of res.assets) {
        const isVideo = asset.type === 'video';
        let uploadUri = asset.uri;
        let name = isVideo ? (asset.fileName || 'video-upload.mp4') : 'pizza-upload.jpg';
        let mimeType = isVideo ? (asset.mimeType || 'video/mp4') : 'image/jpeg';
        if (!isVideo) {
          try {
            const normalized = await ImageManipulator.manipulateAsync(
              asset.uri,
              [],
              { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
            );
            uploadUri = normalized.uri;
          } catch {}
        }
        const path = await upload(uploadUri, name, mimeType);
        uploaded.push({ uri: uploadUri, type: isVideo ? 'video' : 'image', path });
      }
      setSelectedMedia(uploaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mediji se nisu mogli prenijeti.');
      setSelectedMedia([]);
    }
  };

  const upload = async (uri: string, originalName?: string, mimeType?: string) => {
    setUploading(true);
    try {
      const extension = (originalName?.split('.').pop() || ({
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'video/mp4': 'mp4',
        'video/quicktime': 'mov',
        'video/webm': 'webm',
      } as Record<string, string>)[mimeType || ''] || 'jpg').toLowerCase();
      const name = originalName || `upload.${extension}`;
      const contentType = mimeType || ({
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        heic: 'image/heic',
        mp4: 'video/mp4',
        mov: 'video/quicktime',
        webm: 'video/webm',
        m4v: 'video/x-m4v',
      } as Record<string, string>)[extension] || 'image/jpeg';
      if (Platform.OS === 'web') {
        const form = new FormData();
        const sourceBlob = await (await fetch(uri)).blob();
        form.append('file', new Blob([sourceBlob], { type: contentType }), name);
        const res = await fetch(`${BACKEND}/api/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken()}` },
          body: form,
        });
        const json = await res.json();
        if (!res.ok || !json.path) throw new Error(json.detail || 'Slika se nije mogla prenijeti.');
        return json.path as string;
      } else {
        const result = await new ExpoFile(uri).upload(`${BACKEND}/api/upload`, {
          uploadType: UploadType.MULTIPART,
          fieldName: 'file',
          mimeType: contentType,
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const json = JSON.parse(result.body);
        if (result.status < 200 || result.status >= 300 || !json.path) {
          throw new Error(json.detail || 'Slika se nije mogla prenijeti.');
        }
        return json.path as string;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Slika se nije mogla prenijeti.');
      throw e;
    } finally { setUploading(false); }
  };

  const submit = async () => {
    if (uploading || (!caption.trim() && selectedMedia.length === 0)) return;
    setPosting(true);
    try {
      await api('/api/posts', {
        method: 'POST',
        body: JSON.stringify({
          caption: caption.trim(),
          image_path: selectedMedia.find((item) => item.type === 'image')?.path || '',
          media: selectedMedia.map((item) => ({ type: item.type, path: item.path })),
          author_rating: authorRating > 0 ? authorRating : null,
          recipe: attachRecipe && recipe ? {
            name: recipe.name || undefined,
            diameter_cm: recipe.diameter,
            hydration: recipe.hydration,
            method: recipe.method,
            style_id: recipe.style_id,
            style_params: recipe.style_params,
            settings: recipe.settings,
            ingredients: {
              flour: recipe.flour,
              water: recipe.water,
              salt: recipe.salt,
              oil: recipe.oil,
              yeast: recipe.yeast,
              psyllium: recipe.psyllium,
              sauce: recipe.sauce,
              cheese: recipe.cheese,
            },
            flour_type: recipe.flourType,
            dough_weight: recipe.ballWeight,
          } : null,
        }),
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Objava nije uspjela.');
    } finally { setPosting(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <Pressable onPress={() => router.back()} testID="close-new-post">
          <Icon name="close" size={26} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.title}>{t.feed.newPost}</Text>
        <Pressable
          testID="publish-btn"
          disabled={posting || uploading || (!caption.trim() && selectedMedia.length === 0)}
          onPress={submit}
          style={[styles.publishBtn, (posting || uploading || (!caption.trim() && selectedMedia.length === 0)) && { opacity: 0.5 }]}
        >
          <Text style={styles.publishBtnText}>{posting ? '...' : t.feed.publish}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.lg, paddingBottom: SPACING.xxxl }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={pick} style={styles.picker} testID="pick-image">
          {selectedMedia.length ? (
            <>
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.previewScroll}>
                {selectedMedia.map((item, index) => (
                  <View key={`${item.path}-${index}`} style={styles.previewItem}>
                    <PostMedia source={{ type: item.type, uri: item.uri }} style={styles.image} />
                    <Pressable testID={`remove-media-${index}`} onPress={() => setSelectedMedia((previous) => previous.filter((_, current) => current !== index))} style={styles.removeMedia}>
                      <Icon name="close" size={16} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
              {uploading ? <View style={styles.uploadOverlay}><ActivityIndicator color="#fff" /></View> : null}
            </>
          ) : (
            <View style={styles.pickerEmpty}>
              <Icon name="image-outline" size={40} color={COLORS.brand} />
              <Text style={styles.pickerText}>{t.feed.pickImage}</Text>
            </View>
          )}
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View>
          <Text style={styles.label}>{t.feed.caption}</Text>
          <TextInput
            testID="caption-input"
            value={caption}
            onChangeText={setCaption}
            placeholder={t.feed.captionPlaceholder}
            placeholderTextColor={COLORS.muted}
            multiline
            style={styles.input}
          />
        </View>

        {recipe ? (
          <Pressable
            testID="attach-recipe"
            onPress={() => setAttachRecipe(!attachRecipe)}
            style={[styles.recipe, attachRecipe && styles.recipeActive]}
          >
            <Icon name={attachRecipe ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={attachRecipe ? COLORS.brand : COLORS.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.recipeTitle}>{t.feed.attachRecipe}</Text>
              <Text style={styles.recipeMeta}>
                {recipe.style_id ? t.calc.pizzaStyles[recipe.style_id as keyof typeof t.calc.pizzaStyles].name : ''} · {recipe.hydration}% · {recipe.method} · {recipe.ballWeight}g
              </Text>
            </View>
          </Pressable>
        ) : null}

        <View style={styles.ratingWrap}>
          <Text style={styles.label}>{t.feed.rateYourPizza}</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((number) => (
              <Pressable
                key={number}
                testID={`author-star-${number}`}
                onPress={() => setAuthorRating(authorRating === number ? 0 : number)}
                accessibilityLabel={`${number}/5`}
                style={styles.starBtn}
              >
                <Icon name={number <= authorRating ? 'star' : 'star-outline'} size={32} color={number <= authorRating ? COLORS.brand : COLORS.muted} />
              </Pressable>
            ))}
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surfaceSecondary },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.onSurface },
  publishBtn: { paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLORS.brand },
  publishBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  picker: { aspectRatio: 1, width: '100%', backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pickerEmpty: { alignItems: 'center', gap: SPACING.sm },
  pickerText: { color: COLORS.brand, fontWeight: '600' },
  image: { width: '100%', height: '100%' },
  previewScroll: { width: '100%', height: '100%' },
  previewItem: { width: '100%', height: '100%', position: 'relative' },
  removeMedia: { position: 'absolute', top: SPACING.md, right: SPACING.md, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(28,25,23,0.75)' },
  error: { color: COLORS.error, fontSize: 14, lineHeight: 20 },
  uploadOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase', marginBottom: SPACING.sm },
  input: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, padding: SPACING.md, minHeight: 100, fontSize: 15, color: COLORS.onSurface, borderWidth: 1, borderColor: COLORS.border, textAlignVertical: 'top' },
  recipe: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center', padding: SPACING.md, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border },
  recipeActive: { borderColor: COLORS.brand, backgroundColor: COLORS.brandTertiary },
  recipeTitle: { fontSize: 14, fontWeight: '700', color: COLORS.onSurface },
  recipeMeta: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  ratingWrap: { gap: SPACING.sm },
  stars: { flexDirection: 'row', gap: SPACING.sm, alignSelf: 'flex-start' },
  starBtn: { padding: 4 },
});
