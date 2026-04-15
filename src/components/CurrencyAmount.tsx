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
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Image
          source={IMAGES.carrot}
          style={{ width: imageSize, height: imageSize }}
          resizeMode="contain"
        />
        <Text style={textStyle}>{amount}</Text>
      </View>
    );
  }
  return <Text style={textStyle}>{currency}{amount}</Text>;
};