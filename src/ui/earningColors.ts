import type { EarningType } from '../logic/types';

/** Fixed order, checked for color-blind separation (dataviz validator, light mode). */
export const EARNING_COLORS: Record<EarningType, string> = {
  trip: '#5B3CB0',
  incentive: '#B8860B',
  reimbursement: '#0E8C7E',
  missed: '#D9475F',
};

/** Trip-earnings purple at 38% on white: "still to come". Always labeled, never color alone. */
export const UPCOMING_COLOR = '#C1B5E1';
