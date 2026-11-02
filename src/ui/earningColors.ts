import type { EarningType } from '../logic/types';
import { APPEARANCE } from './theme';

/** Fixed order, checked for color-blind separation (dataviz validator, light mode). */
const LIGHT_CHART: Record<EarningType, string> = {
  trip: '#5B3CB0',
  incentive: '#B8860B',
  reimbursement: '#0E8C7E',
  missed: '#D9475F',
};

/** Same hues, re-stepped for the dark purple background (validated in dark mode). */
const DARK_CHART: Record<EarningType, string> = {
  trip: '#8A6EE0',
  incentive: '#B88A16',
  reimbursement: '#0F9A86',
  missed: '#E0566B',
};

export const EARNING_COLORS = APPEARANCE === 'dark' ? DARK_CHART : LIGHT_CHART;

/** Trip-earnings purple at 38% on white: "still to come". Always labeled, never color alone. */
export const UPCOMING_COLOR = APPEARANCE === 'dark' ? '#5A479C' : '#C1B5E1';
