import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Platform, KeyboardAvoidingView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Icon from '@react-native-vector-icons/ionicons';

import { api, fileUrl, useAuth } from '../../src/auth';
import { useT } from '../../src/i18n/LanguageProvider';
import { COLORS, SPACING, RADIUS } from '../../src/theme';
import { getCachedTemperatureUnit, subscribeTemperatureUnit, getCachedMeasurementSystem, subscribeMeasurementSystem } from '../../src/preferences';
import { formatTemperature, formatWeight } from '../../src/units';
import PizzaRatingSlider from '../../src/components/PizzaRatingSlider';
import PostMedia from '../../src/components/PostMedia';
import type { PostMediaSource } from '../../src/components/PostMedia';

export default function PostDetail() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useT();
  const temperatureUnit = useSyncExternalStore(subscribeTemperatureUnit, getCachedTemperatureUnit, getCachedTemperatureUnit) ?? 'celsius';
  const measurementSystem = useSyncExternalStore(subscribeMeasurementSystem, getCachedMeasurementSystem, getCachedMeasurementSystem) ?? 'metric';
  const { user } = useAuth();

  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [recipeSaved, setRecipeSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const mediaScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let mounted = true;
    void Promise.all([api(`/api/posts/${id}`), api(`/api/posts/${id}/comments`)]).then(([p, c]) => {
      if (mounted) { setPost(p); setComments(c); }
    }).catch(() => {});
    return () => { mounted = false; };
  }, [id]);

  const submitComment = async () => {
    if (!text.trim()) return;
    setPosting(true);
    try {
      const c = await api(`/api/posts/${id}/comments`, { method: 'POST', body: JSON.stringify({ text: text.trim() }) });
      setComments((prev) => [...prev, c]);
      setText('');
    } catch {} finally { setPosting(false); }
  };

  const saveRecipe = async () => {
    if (!post?.recipe) return;
    if (!user) {
      router.push('/login');
      return;
    }
    setSavingRecipe(true);
    try {
      await api('/api/recipes', {
        method: 'POST',
        body: JSON.stringify({
          name: post.recipe.name || `${post.author_name} · ${post.recipe.method || 'recept'}`,
          recipe: {
            ...post.recipe,
            settings: post.recipe.settings || null,
          },
        }),
      });
      setRecipeSaved(true);
    } catch {} finally {
      setSavingRecipe(false);
    }
  };

  const confirmDelete = () => {
    if (!user || user.user_id !== post?.user_id || deleting) return;
    Alert.alert(t.feed.deletePostTitle, t.feed.deletePostWarning, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.feed.deletePost,
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await api(`/api/posts/${id}`, { method: 'DELETE' });
            router.back();
          } catch {
            setDeleting(false);
            Alert.alert(t.feed.deletePostError);
          }
        },
      },
    ]);
  };

  const report = (targetType: 'post' | 'comment', targetId: string) => {
    if (!user) {
      router.push('/login');
      return;
    }
    Alert.alert(t.profile.report, '', [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.profile.report,
        onPress: async () => {
          try {
            await api('/api/reports', {
              method: 'POST',
              body: JSON.stringify({ target_type: targetType, target_id: targetId, reason: t.legal.report.violationReason }),
            });
            Alert.alert(t.profile.reportSent);
          } catch {
            Alert.alert(t.legal.errorTitle, t.legal.report.error);
          }
        },
      },
    ]);
  };

  const onLike = async () => {
    if (!post) return;
    try {
      const r = await api(`/api/posts/${id}/like`, { method: 'POST' });
      setPost({ ...post, likes_count: r.likes_count, likes: r.liked ? [...(post.likes || []), user!.user_id] : (post.likes || []).filter((u: string) => u !== user!.user_id) });
    } catch {}
  };

  if (!post) {
    return <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={COLORS.brand} /></View>;
  }

  const liked = user && post.likes?.includes(user.user_id);
  const media: PostMediaSource[] = post.media_urls?.length
    ? post.media_urls.map((item: { type: 'image' | 'video'; url: string }) => ({ type: item.type, uri: fileUrl(item.url) }))
    : post.image_url ? [{ type: 'image', uri: fileUrl(post.image_url) }] : [];
  const gallerySize = Math.min(windowWidth, 720);
  const goToMedia = (index: number) => {
    const nextIndex = Math.max(0, Math.min(media.length - 1, index));
    setActiveMediaIndex(nextIndex);
    mediaScrollRef.current?.scrollTo({ x: nextIndex * gallerySize, animated: true });
  };
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <Pressable onPress={() => router.back()}><Icon name="chevron-back" size={26} color={COLORS.onSurface} /></Pressable>
        <Text style={styles.headerTitle}>{post.author_name}</Text>
          {user?.user_id === post.user_id ? (
            <Pressable testID="delete-post" onPress={confirmDelete} hitSlop={8} disabled={deleting}>
              <Icon name="trash-outline" size={22} color={COLORS.error} />
            </Pressable>
          ) : (
            <Pressable onPress={() => report('post', post.post_id)} hitSlop={8}>
              <Icon name="flag-outline" size={22} color={COLORS.error} />
            </Pressable>
          )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: SPACING.xxxl }} keyboardShouldPersistTaps="handled">
        {media.length ? (
          <View style={[styles.galleryFrame, { width: gallerySize, height: gallerySize }]}>
          <ScrollView
            ref={mediaScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={[styles.mediaGallery, { width: gallerySize, height: gallerySize }]}
            onMomentumScrollEnd={(event) => {
              setActiveMediaIndex(Math.round(event.nativeEvent.contentOffset.x / gallerySize));
            }}
          >
            {media.map((item, index) => (
              <View key={`${item.uri}-${index}`} style={[styles.mediaSlide, { width: gallerySize, height: gallerySize }]}>
                <PostMedia source={item} style={styles.image} />
              </View>
            ))}
          </ScrollView>
          {media.length > 1 ? (
            <>
              <Pressable
                accessibilityLabel="Prethodna slika"
                onPress={() => goToMedia(activeMediaIndex - 1)}
                disabled={activeMediaIndex === 0}
                style={[styles.galleryArrow, styles.galleryArrowLeft, activeMediaIndex === 0 && styles.galleryArrowDisabled]}
              >
                <Icon name="chevron-back" size={24} color="#fff" />
              </Pressable>
              <Pressable
                accessibilityLabel="Sljedeća slika"
                onPress={() => goToMedia(activeMediaIndex + 1)}
                disabled={activeMediaIndex === media.length - 1}
                style={[styles.galleryArrow, styles.galleryArrowRight, activeMediaIndex === media.length - 1 && styles.galleryArrowDisabled]}
              >
                <Icon name="chevron-forward" size={24} color="#fff" />
              </Pressable>
              <View style={styles.galleryDots}>
                {media.map((item, index) => (
                  <View key={`${item.uri}-dot-${index}`} style={[styles.galleryDot, index === activeMediaIndex && styles.galleryDotActive]} />
                ))}
              </View>
            </>
          ) : null}
          </View>
        ) : null}
        <View style={styles.body}>
          <Text style={styles.caption}>{post.caption}</Text>
          <View style={styles.actions}>
            <Pressable onPress={onLike} testID="like-detail" style={styles.action}>
              <Icon name={liked ? 'flame' : 'flame-outline'} size={22} color={liked ? COLORS.brand : COLORS.muted} />
              <Text style={[styles.actionText, liked && { color: COLORS.brand, fontWeight: '700' }]}>{post.likes_count}</Text>
            </Pressable>
            <View style={styles.action}>
              <Icon name="chatbubble-outline" size={20} color={COLORS.muted} />
              <Text style={styles.actionText}>{comments.length}</Text>
            </View>
          </View>

          {post.recipe ? (
            <View style={styles.recipeCard}>
              <Text style={styles.recipeTitle}>{t.feed.recipe}</Text>
              {post.recipe.style_id && t.calc.pizzaStyles[post.recipe.style_id as keyof typeof t.calc.pizzaStyles] ? <RecipeLine label={t.calc.pizzaStyle} value={t.calc.pizzaStyles[post.recipe.style_id as keyof typeof t.calc.pizzaStyles].name} /> : null}
              {post.recipe.hydration ? <RecipeLine label={t.feed.hydration} value={`${post.recipe.hydration}%`} /> : null}
              {post.recipe.method ? <RecipeLine label={t.feed.method} value={post.recipe.method} /> : null}
              {post.recipe.dough_weight ? <RecipeLine label={t.calc.doughBall} value={formatWeight(post.recipe.dough_weight, measurementSystem)} /> : null}
              {post.recipe.flour_type ? <RecipeLine label={t.feed.flourType} value={post.recipe.flour_type} /> : null}
              {post.recipe.bake_temp ? <RecipeLine label={t.feed.bakeTemp} value={formatTemperature(post.recipe.bake_temp, temperatureUnit)} /> : null}
              <Pressable testID="save-shared-recipe" onPress={() => { void saveRecipe(); }} disabled={savingRecipe || recipeSaved} style={[styles.saveRecipeBtn, (savingRecipe || recipeSaved) && { opacity: 0.65 }]}>
                <Icon name={recipeSaved ? 'checkmark' : 'bookmark-outline'} size={17} color={COLORS.brand} />
                <Text style={styles.saveRecipeText}>{recipeSaved ? t.calc.savedRecipes : t.calc.saveRecipe}</Text>
              </Pressable>
            </View>
          ) : null}

          <RatingSection post={post} onUpdate={setPost} />

          <Text style={[styles.section, { marginTop: SPACING.xl }]}>{t.feed.comment}s ({comments.length})</Text>
          {comments.map((c) => (
            <View key={c.comment_id} style={styles.comment}>
              <View style={styles.commentAvatar}><Text style={styles.commentAvatarText}>{c.author_name?.[0]?.toUpperCase() || '?'}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.commentName}>{c.author_name}</Text>
                <Text style={styles.commentText}>{c.text}</Text>
              </View>
              <Pressable onPress={() => report('comment', c.comment_id)} hitSlop={8}>
                <Icon name="flag-outline" size={18} color={COLORS.muted} />
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
        <TextInput
          testID="comment-input"
          value={text}
          onChangeText={setText}
          placeholder={t.feed.addComment}
          placeholderTextColor={COLORS.muted}
          style={styles.commentInput}
        />
        <Pressable testID="send-comment" onPress={submitComment} disabled={!text.trim() || posting} style={[styles.sendBtn, (!text.trim() || posting) && { opacity: 0.5 }]}>
          <Icon name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function RecipeLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.recipeLine}>
      <Text style={styles.recipeLabel}>{label}</Text>
      <Text style={styles.recipeValue}>{value}</Text>
    </View>
  );
}

function RatingSection({ post, onUpdate }: { post: any; onUpdate: (p: any) => void }) {
  const { user } = useAuth();
  const { t } = useT();
  const isAuthor = user?.user_id === post.user_id;
  const canRate = !!user && !isAuthor;
  const communityRating = post.rating || 0;
  const [draftRating, setDraftRating] = useState(() => post.viewer_rating || 0);

  const saveRating = async (n: number) => {
    if (!canRate) return;
    try {
      const result = await api(`/api/posts/${post.post_id}/rating`, { method: 'POST', body: JSON.stringify({ rating: n }) });
      onUpdate({ ...post, rating: result.rating, ratings_count: result.ratings_count, viewer_rating: result.viewer_rating });
    } catch {}
  };

  if (!communityRating && !canRate) return null;

  return (
    <View style={styles.ratingCard}>
      <Text style={styles.ratingTitle}>{t.feed.rating}</Text>
      {canRate ? (
        <PizzaRatingSlider value={draftRating} onChange={setDraftRating} onChangeEnd={saveRating} testID="pizza-rating-slider" />
      ) : (
        <Text style={styles.ratingSummary}>{communityRating}/5 · {post.ratings_count || 0}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, backgroundColor: COLORS.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.onSurface },
  galleryFrame: { alignSelf: 'center', position: 'relative', backgroundColor: COLORS.surfaceTertiary },
  image: { width: '100%', height: '100%' },
  mediaGallery: { alignSelf: 'center' },
  mediaSlide: { flexGrow: 0, backgroundColor: COLORS.surfaceTertiary },
  galleryArrow: { position: 'absolute', top: '50%', marginTop: -22, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(28,25,23,0.72)', alignItems: 'center', justifyContent: 'center' },
  galleryArrowLeft: { left: SPACING.md },
  galleryArrowRight: { right: SPACING.md },
  galleryArrowDisabled: { opacity: 0.25 },
  galleryDots: { position: 'absolute', bottom: SPACING.md, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  galleryDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.55)' },
  galleryDotActive: { width: 18, backgroundColor: '#fff' },
  body: { padding: SPACING.lg },
  caption: { fontSize: 16, color: COLORS.onSurface, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: SPACING.xl, marginTop: SPACING.md, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
  recipeCard: { marginTop: SPACING.md, backgroundColor: COLORS.brandTertiary, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: 4 },
  recipeTitle: { fontSize: 13, color: COLORS.brand, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },
  recipeLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  recipeLabel: { color: COLORS.onBrandTertiary, fontSize: 13 },
  recipeValue: { color: COLORS.onSurface, fontSize: 14, fontWeight: '700' },
  saveRecipeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, marginTop: SPACING.md, paddingVertical: 11, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.brand },
  saveRecipeText: { color: COLORS.brand, fontSize: 13, fontWeight: '700' },
  ratingCard: { marginTop: SPACING.md, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'flex-start', gap: SPACING.sm },
  ratingTitle: { fontSize: 13, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase' },
  ratingSummary: { color: COLORS.brand, fontSize: 17, fontWeight: '800' },
  section: { fontSize: 13, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase' },
  comment: { flexDirection: 'row', gap: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  commentAvatarText: { color: COLORS.onBrandTertiary, fontWeight: '800' },
  commentName: { fontSize: 13, fontWeight: '700', color: COLORS.onSurface },
  commentText: { fontSize: 14, color: COLORS.onSurface, marginTop: 2 },
  inputBar: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surfaceSecondary },
  commentInput: { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: 10, fontSize: 14, color: COLORS.onSurface, borderWidth: 1, borderColor: COLORS.border },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.brand, alignItems: 'center', justifyContent: 'center' },
});
