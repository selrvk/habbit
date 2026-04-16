import React from 'react';
import { View, Text, Image } from 'react-native';
import { IMAGES } from '../constants';

interface Props {
  currency: string;
  amount: string;
  textStyle?: object;
  imageSize?: number;
}

export const CurrencyAmount = ({ currency, amount, textStyle, imageSize = 18 }: Props) => {
  if (currency === '__carrot__') {
    const tintColor = (textStyle as any)?.color ?? '#e8d5c0';
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
        <Image
          source={IMAGES.carrot_currency}
          style={{ width: imageSize, height: imageSize, tintColor }}
          resizeMode="contain"
        />
        <Text style={textStyle}>{amount}</Text>
      </View>
    );
  }
  return <Text style={textStyle}>{currency}{amount}</Text>;
};