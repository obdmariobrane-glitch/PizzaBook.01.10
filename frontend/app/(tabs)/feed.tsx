import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/ionicons';
import * as Haptics from 'expo-haptics';

import { api, fileUrl, useAuth } from '../../src/auth';
import { useT } from '../../src/i18n/LanguageProvider';
import { COLORS, SPACING, RADIUS } from '../../src/theme';
import PizzaRatingSlider from '../../src/components/PizzaRatingSlider';
import PostMedia from '../../src/components/PostMedia';
import type { PostMediaSource } from '../../src/components/PostMedia';

type Post = {
  post_id: string; user_id: string; author_name: string; author_picture?: string;
  caption: string; image_path?: string; image_url?: string;
  media_urls?: { type: 'image' | 'video'; url: string }[];
  recipe?: any; likes: string[]; likes_count: number; comments_count: number;
  rating?: number | null; ratings_count?: number; viewer_rating?: number;
  created_at: string;
};

function formatPostDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function getPostMedia(post: Post): PostMediaSource[] {
  if (post.media_urls?.length) return post.media_urls.map((media) => ({ type: media.type, uri: fileUrl(media.url) }));
  return post.image_url ? [{ type: 'image', uri: fileUrl(post.image_url) }] : [];
}

export default function Feed() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [featured, setFeatured] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const [data, feat] = await Promise.all([
        api('/api/posts'),
        api('/api/posts/featured').catch(() => null),
      ]);
      setFeatured(feat);
      setPosts(feat ? data.filter((post: Post) => post.post_id !== feat.post_id) : data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onLike = async (post: Post) => {
    if (!user) { router.push('/login'); return; }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    try {
      const r = await api(`/api/posts/${post.post_id}/like`, { method: 'POST' });
      setPosts((prev) => prev.map((p) => p.post_id === post.post_id
        ? { ...p, likes_count: r.likes_count, likes: r.liked ? [...p.likes, user!.user_id] : p.likes.filter(u => u !== user!.user_id) }
        : p));
    } catch {}
  };

  const updateLocalRating = (postId: string, rating: number) => {
    setPosts((prev) => prev.map((post) => post.post_id === postId ? { ...post, viewer_rating: rating } : post));
  };

  const saveRating = async (post: Post, rating: number) => {
    if (!user || post.user_id === user.user_id) return;
    try {
      const result = await api(`/api/posts/${post.post_id}/rating`, { method: 'POST', body: JSON.stringify({ rating }) });
      setPosts((prev) => prev.map((item) => item.post_id === post.post_id
        ? { ...item, rating: result.rating, ratings_count: result.ratings_count, viewer_rating: result.viewer_rating }
        : item));
    } catch {}
  };

  const renderItem = ({ item }: { item: Post }) => {
    const liked = user && item.likes?.includes(user.user_id);
    const media = getPostMedia(item);
    return (
      <Pressable
        testID={`post-card-${item.post_id}`}
        style={styles.card}
        onPress={() => router.push(`/post/${item.post_id}`)}
      >
        <View style={styles.cardHeader}>
          {item.author_picture ? (
            <Image source={{ uri: item.author_picture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{item.author_name?.[0]?.toUpperCase() || '?'}</Text>
            </View>
          )}
          <View style={styles.authorInfo}>
            <Text style={styles.authorName}>{item.author_name}</Text>
            <Text style={styles.postDate}>{formatPostDate(item.created_at)}</Text>
          </View>
        </View>
        {media.length ? (
          <View style={styles.imageWrap}>
            <PostMedia source={media[0]} style={styles.image} />
            {media.length > 1 ? (
              <View style={styles.mediaCount}>
                <Icon name="images-outline" size={14} color="#fff" />
                <Text style={styles.mediaCountText}>{media.length}</Text>
              </View>
            ) : null}
            {item.recipe ? (
              <View style={styles.recipeBadge}>
                <Icon name="document-text" size={12} color="#fff" />
                <Text style={styles.recipeBadgeText}>{t.feed.recipe}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={styles.body}>
          <Text style={styles.caption} numberOfLines={3}>{item.caption}</Text>
          {item.rating ? (
            <View style={styles.ratingRow}>
              <Text style={styles.ratingText}>{t.feed.rating} {item.rating}/5 · {item.ratings_count}</Text>
            </View>
          ) : null}
          <View style={styles.actions}>
            <Pressable testID={`like-btn-${item.post_id}`} onPress={() => onLike(item)} style={styles.action}>
              <Icon name={liked ? 'flame' : 'flame-outline'} size={20} color={liked ? COLORS.brand : COLORS.muted} />
              <Text style={[styles.actionText, liked && { color: COLORS.brand, fontWeight: '700' }]}>{item.likes_count}</Text>
            </Pressable>
            <View style={styles.action}>
              <Icon name="chatbubble-outline" size={18} color={COLORS.muted} />
              <Text style={styles.actionText}>{item.comments_count}</Text>
            </View>
          </View>
          {user && item.user_id !== user.user_id ? (
            <View style={styles.rateOnWall}>
              <Text style={styles.rateOnWallTitle}>{t.feed.rating}</Text>
              <PizzaRatingSlider
                value={item.viewer_rating || 0}
                onChange={(rating) => updateLocalRating(item.post_id, rating)}
                onChangeEnd={(rating) => { void saveRating(item, rating); }}
                testID={`pizza-rating-${item.post_id}`}
              />
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{t.feed.title}</Text>
          <Text style={styles.headerSubtitle}>{t.feed.subtitle}</Text>
        </View>
        <Pressable
          testID="new-post-button"
          onPress={() => user ? router.push('/new-post') : router.push('/login')}
          accessibilityLabel={t.feed.newPost}
          style={styles.newBtn}
        >
          <Icon name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.brand} /></View>
      ) : loadError ? (
        <View style={styles.empty}>
          <Icon name="cloud-offline-outline" size={48} color={COLORS.muted} />
          <Text style={styles.emptyText}>{t.feed.loadError}</Text>
          <Pressable style={styles.emptyBtn} onPress={() => { void load(); }}>
            <Text style={styles.emptyBtnText}>{t.feed.retry}</Text>
          </Pressable>
        </View>
      ) : posts.length === 0 && !featured ? (
        <View style={styles.empty}>
          <Icon name="pizza-outline" size={56} color={COLORS.brand} />
          <Text style={styles.emptyText}>{t.feed.empty}</Text>
          <Pressable style={styles.emptyBtn} onPress={() => user ? router.push('/new-post') : router.push('/login')}>
            <Text style={styles.emptyBtnText}>{t.feed.newPost}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.post_id}
          renderItem={renderItem}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              {featured ? (
                <Pressable
                  testID="featured-post"
                  onPress={() => router.push(`/post/${featured.post_id}`)}
                  style={styles.featured}
                >
                  {getPostMedia(featured)[0] ? (
                    <PostMedia source={getPostMedia(featured)[0]} style={styles.featuredImage} />
                  ) : null}
                  <LinearGradient colors={['transparent', 'rgba(28,25,23,0.95)']} style={styles.featuredScrim} />
                  <View style={styles.featuredBadge}>
                    <Icon name="trophy" size={12} color="#fff" />
                    <Text style={styles.featuredBadgeText}>{t.feed.featured}</Text>
                  </View>
                  <View style={styles.featuredBody}>
                    <Text style={styles.featuredName}>{featured.author_name}</Text>
                    <Text style={styles.featuredCaption} numberOfLines={2}>{featured.caption}</Text>
                    <View style={styles.featuredMeta}>
                      <Icon name="flame" size={14} color="#fff" />
                      <Text style={styles.featuredMetaText}>{featured.likes_count}</Text>
                      <Icon name="chatbubble-outline" size={13} color="#fff" />
                      <Text style={styles.featuredMetaText}>{featured.comments_count}</Text>
                    </View>
                  </View>
                </Pressable>
              ) : null}
              {posts.length ? (
                <View style={styles.latestHeader}>
                  <Text style={styles.latestTitle}>{t.feed.latest}</Text>
                  <Text style={styles.latestCount}>{posts.length}</Text>
                </View>
              ) : null}
            </View>
          }
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING.xxxl, gap: SPACING.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.brand} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  headerCopy: { flex: 1 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.onSurface, letterSpacing: -0.5 },
  headerSubtitle: { color: COLORS.muted, fontSize: 13, marginTop: 2 },
  newBtn: { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: COLORS.brand, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md, paddingHorizontal: SPACING.xl },
  emptyText: { fontSize: 16, color: COLORS.muted, textAlign: 'center' },
  emptyBtn: { backgroundColor: COLORS.brand, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.pill },
  emptyBtnText: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.md },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { backgroundColor: COLORS.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: COLORS.onBrandTertiary, fontWeight: '800' },
  authorInfo: { flex: 1, gap: 2 },
  authorName: { fontSize: 15, fontWeight: '700', color: COLORS.onSurface },
  postDate: { color: COLORS.muted, fontSize: 12 },
  imageWrap: { width: '100%', aspectRatio: 1, backgroundColor: COLORS.surfaceTertiary, position: 'relative' },
  image: { width: '100%', height: '100%' },
  mediaCount: { position: 'absolute', top: SPACING.md, right: SPACING.md, backgroundColor: 'rgba(28,25,23,0.75)', borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4 },
  mediaCountText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  recipeBadge: { position: 'absolute', bottom: SPACING.md, left: SPACING.md, backgroundColor: COLORS.brand, paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.pill, flexDirection: 'row', gap: 4, alignItems: 'center' },
  recipeBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  body: { padding: SPACING.md, gap: SPACING.sm },
  caption: { fontSize: 15, color: COLORS.onSurface, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: SPACING.xl, marginTop: SPACING.xs },
  action: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  actionText: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
  rateOnWall: { marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.divider, gap: 2 },
  rateOnWallTitle: { color: COLORS.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  ratingRow: { flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 6 },
  ratingText: { color: COLORS.brand, fontSize: 12, fontWeight: '700' },
  listHeader: { gap: SPACING.md },
  latestHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: SPACING.xs },
  latestTitle: { color: COLORS.onSurface, fontSize: 18, fontWeight: '800' },
  latestCount: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  featured: { borderRadius: RADIUS.lg, overflow: 'hidden', backgroundColor: COLORS.surfaceInverse, aspectRatio: 16 / 10, position: 'relative' },
  featuredImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  featuredScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '65%' },
  featuredBadge: { position: 'absolute', top: SPACING.md, left: SPACING.md, backgroundColor: COLORS.brand, paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.pill, flexDirection: 'row', gap: 4, alignItems: 'center' },
  featuredBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  featuredBody: { position: 'absolute', left: SPACING.lg, right: SPACING.lg, bottom: SPACING.lg, gap: 4 },
  featuredName: { color: '#fff', fontSize: 13, fontWeight: '700', opacity: 0.85 },
  featuredCaption: { color: '#fff', fontSize: 17, fontWeight: '800', lineHeight: 22 },
  featuredMeta: { flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 4 },
  featuredMetaText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
