import type { CheckInState } from '../logic/types';

export const CHECK_IN_LABEL: Record<CheckInState, { label: string; tone: 'good' | 'warn' | 'bad' | 'neutral' | 'info' }> = {
  waiting: { label: 'Check-in link ready', tone: 'info' },
  unlocked: { label: 'Guest unlocked · countdown', tone: 'warn' },
  relocked: { label: 'Relocked · guest can retry', tone: 'bad' },
  started: { label: 'Picked up', tone: 'good' },
  expired: { label: 'Link expired', tone: 'neutral' },
};
