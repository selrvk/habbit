// src/components/SectionDivider.tsx

import React from 'react';
import { View, Text } from 'react-native';
import { DYNAPUFF } from '../constants';

export const SectionDivider = ({ title }: { title: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 20 }}>
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#D4956A', opacity: 0.4 }} />
      <View style={{ flex: 1, height: 1, backgroundColor: '#D4956A', opacity: 0.25 }} />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#D4956A', opacity: 0.5 }} />
    </View>
    <View style={{ backgroundColor: '#5C3D2E', borderWidth: 1, borderColor: 'rgba(212,149,106,0.4)', borderRadius: 99, paddingHorizontal: 16, paddingVertical: 4 }}>
      <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: 14 }}>{title}</Text>
    </View>
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#D4956A', opacity: 0.5 }} />
      <View style={{ flex: 1, height: 1, backgroundColor: '#D4956A', opacity: 0.25 }} />
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#D4956A', opacity: 0.4 }} />
    </View>
  </View>
);