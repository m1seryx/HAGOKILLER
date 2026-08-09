import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

interface AnimatedTabSceneProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/** Fade + slight slide when a bottom tab gains focus */
export const AnimatedTabScene: React.FC<AnimatedTabSceneProps> = ({
  children,
  style,
}) => {
  const isFocused = useIsFocused();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (!isFocused) {
      opacity.setValue(0);
      translateY.setValue(10);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isFocused, opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
