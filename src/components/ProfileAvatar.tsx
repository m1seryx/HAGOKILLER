import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';

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
  const initials = name?.trim().charAt(0).toUpperCase() || 'U';

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
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={[styles.image, { borderRadius: radius - 2 }]} />
      ) : (
        <Text style={[styles.initial, { fontSize: size * 0.38 }]}>{initials}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    backgroundColor: 'rgba(99, 102, 241, 0.28)',
    borderWidth: 1.5,
    borderColor: 'rgba(165, 180, 252, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  initial: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
