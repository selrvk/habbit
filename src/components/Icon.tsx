// src/components/Icon.tsx
//
// One of the app's clay icons (src/icons.ts), or a category's icon: its clay icon when it's
// built in, the emoji its owner picked when it's their own.

import React from 'react';
import { Image, Text, View, type ImageStyle, type StyleProp } from 'react-native';
import { ICONS, type IconName } from '../icons';
import { useFontSize } from '../hooks/useFontSize';

export const Icon = ({ name, size, style }: { name: IconName; size: number; style?: StyleProp<ImageStyle> }) => (
  <Image source={ICONS[name]} style={[{ width: size, height: size }, style]} resizeMode="contain" />
);

/** A built-in category's clay icon, or a custom category's emoji, about `size` tall. */
export const CategoryIcon = ({ category, size, dim = false }: {
  category: { emoji: string; icon?: IconName } | undefined; size: number; dim?: boolean;
}) =>
  category?.icon
    ? <Icon name={category.icon} size={size} style={{ opacity: dim ? 0.3 : 1 }} />
    : (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity: dim ? 0.3 : 1 }}>
        <Text style={{ fontSize: size * (category?.emoji && category.emoji !== '•' ? 0.82 : 1.1), lineHeight: size * 1.2, textAlign: 'center' }}>{category?.emoji ?? '•'}</Text>
      </View>
    );

/** The little "PRO" pill on things that need Habbit Pro. */
export const ProPill = () => {
  const fs = useFontSize();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(212,149,106,0.2)', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Icon name="carrot" size={fs(12)} />
      <Text style={{ fontFamily: 'Jua', fontSize: fs(10), color: '#D4956A' }}>PRO</Text>
    </View>
  );
};
