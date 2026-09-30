import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle, ImageSourcePropType } from 'react-native';

export const HAGOSAUR_AVATAR_PRESETS: Array<{
  id: string;
  label: string;
  source: ImageSourcePropType;
}> = [
  { id: 'hagosaur:happy', label: 'Happy', source: require('../../assets/hagosaur-face-low.png') },
  { id: 'hagosaur:curious', label: 'Curious', source: require('../../assets/hagosaur-face-curious.png') },
  { id: 'hagosaur:sleepy', label: 'Sleepy', source: require('../../assets/hagosaur-face-sleepy.png') },
  { id: 'hagosaur:wink', label: 'Playful', source: require('../../assets/hagosaur-face-wink.png') },
  { id: 'hagosaur:uneasy', label: 'Thoughtful', source: require('../../assets/hagosaur-face-medium.png') },
  { id: 'hagosaur:alert', label: 'Alert', source: require('../../assets/hagosaur-face-high.png') },
];

const PRESET_SOURCES = Object.fromEntries(
  HAGOSAUR_AVATAR_PRESETS.map((preset) => [preset.id, preset.source]),
) as Record<string, ImageSourcePropType>;

interface ProfileAvatarProps {
  name?: string;
  photoUri?: string | null;
  size?: number;
  radius?: number;
  style?: ViewStyle;
}

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  name,
  photoUri,
  size = 48,
  radius = 14,
  style,
}) => {
  const presetSource = photoUri ? PRESET_SOURCES[photoUri] : undefined;
  const displaySource = presetSource ?? (!photoUri ? PRESET_SOURCES['hagosaur:happy'] : undefined);

  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
        style,
      ]}
    >
      {displaySource || photoUri ? (
        <Image
          source={displaySource ?? { uri: photoUri as string }}
          style={[styles.image, { borderRadius: radius - 2 }]}
          resizeMode="cover"
        />
      ) : (
        <Text style={[styles.initial, { fontSize: size * 0.38 }]}>
          {name?.trim().charAt(0).toUpperCase() || 'U'}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    backgroundColor: 'rgba(14, 165, 233, 0.28)',
    borderWidth: 1.5,
    borderColor: 'rgba(14, 165, 233, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  initial: {
    color: '#000000',
    fontWeight: '800',
  },
});
