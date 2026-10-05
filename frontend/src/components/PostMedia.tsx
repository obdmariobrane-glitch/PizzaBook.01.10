import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';

type PostMediaSource = {
  type: 'image' | 'video';
  uri: string;
};

function VideoMedia({ uri, style }: { uri: string; style?: StyleProp<ViewStyle> }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
  });

  return <VideoView player={player} style={style} nativeControls contentFit="contain" />;
}

function ImageMedia({ uri, style }: { uri: string; style?: any }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <View style={[style, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text>Medij se ne može učitati</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit="contain"
      onError={() => {
        setFailed(true);
        console.warn('[PostMedia] image failed to load', uri);
      }}
      onLoad={() => console.info('[PostMedia] image loaded', uri)}
    />
  );
}

export default function PostMedia({ source, style }: { source: PostMediaSource; style?: any }) {
  if (source.type === 'video') return <VideoMedia uri={source.uri} style={style} />;
  return <ImageMedia uri={source.uri} style={style} />;
}

export type { PostMediaSource };
