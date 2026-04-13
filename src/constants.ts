// src/constants.ts

import { Platform } from 'react-native';
import type { AvatarKey } from './types';

export const JUA      = 'font-jua';
export const DYNAPUFF = 'font-dynapuff';

export const DEFAULT_BUDGET   = 500;
export const DEFAULT_CURRENCY = '₱';
export const DEFAULT_AVATAR: AvatarKey = 'avatar_bunny';

export const CURRENCIES     = ['₱', '$', '€', '£', '¥'];
export const DAY_LABELS     = ['S','M','T','W','T','F','S'];
export const CAL_DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export const AVATAR_KEYS: AvatarKey[] = ['avatar_bunny','avatar_hamster','avatar_bear','avatar_panda','avatar_fox'];

export const PEEK_IMAGES = {
  avatar_bunny:   require('../assets/navbar-peeks/bunny-peeking.png'),
  avatar_hamster: require('../assets/navbar-peeks/hamster-peeking.png'),
  avatar_bear:    require('../assets/navbar-peeks/bear-peeking.png'),
  avatar_panda:   require('../assets/navbar-peeks/panda-peeking.png'),
  avatar_fox:     require('../assets/navbar-peeks/fox-peeking.png'),
};

export const IMAGES = {
  appLogo: require('../assets/AppLogo.png'),
  bunny:   require('../assets/bunny-3d.png'),
  carrot:  require('../assets/carrot-3d.png'),
  carrots: require('../assets/carrots-3d.png'),
  home:    require('../assets/home-3d.png'),
  tasks:   require('../assets/habbits-3d.png'),
  settings: require('../assets/settings.png'),
};

export const AVATARIMAGES = {
  avatar_bunny:   require('../assets/avatars/rabbit.png'),
  avatar_hamster: require('../assets/avatars/hamster.png'),
  avatar_bear:    require('../assets/avatars/bear.png'),
  avatar_panda:   require('../assets/avatars/panda.png'),
  avatar_fox:     require('../assets/avatars/fox.png'),
};

export const OVER     = 22;
export const PILL_H   = 62;
export const NAV_BUFFER = 12;