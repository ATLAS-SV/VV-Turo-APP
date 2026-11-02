// Valadon Ventures brand colors. Primary is always deep midnight royal purple.
// To switch themes, change ACTIVE_THEME, then re-run scripts/make-logo.py with the same theme.

export interface BrandTheme {
  name: string;
  /** Deep midnight royal purple: buttons, active tabs, links. */
  primary: string;
  /** Darkest shade: logo background, loading screen. */
  primaryDark: string;
  /** Supporting color: secondary buttons, info chips. */
  secondary: string;
  secondarySoft: string;
  /** Highlight: logo lettering, dividers, small highlights. */
  accent: string;
  /** Screen background tint. */
  background: string;
}

export const THEMES = {
  royalGold: {
    name: 'Royal Gold',
    primary: '#3B1F7A',
    primaryDark: '#1E0E45',
    secondary: '#7A62B8',
    secondarySoft: '#EEE9F8',
    accent: '#D4AF37',
    background: '#F6F4FA',
  },
  champagneSilver: {
    name: 'Champagne & Silver',
    primary: '#3B1F7A',
    primaryDark: '#1E0E45',
    secondary: '#6E7389',
    secondarySoft: '#EDEEF2',
    accent: '#E3C38F',
    background: '#F5F5F8',
  },
  amethystTeal: {
    name: 'Amethyst & Teal',
    primary: '#3B1F7A',
    primaryDark: '#1E0E45',
    secondary: '#8D63D2',
    secondarySoft: '#F0EAFB',
    accent: '#1BB3A4',
    background: '#F5F4FA',
  },
  plumRoseGold: {
    name: 'Plum & Rose Gold',
    primary: '#3B1F7A',
    primaryDark: '#1E0E45',
    secondary: '#9A6A93',
    secondarySoft: '#F5ECF3',
    accent: '#E3A58A',
    background: '#FAF6F8',
  },
} satisfies Record<string, BrandTheme>;

export type ThemeKey = keyof typeof THEMES;

/** Chosen theme: Royal Gold. The others are kept for reference. */
export const ACTIVE_THEME: ThemeKey = 'royalGold';

export const theme: BrandTheme = THEMES[ACTIVE_THEME];
