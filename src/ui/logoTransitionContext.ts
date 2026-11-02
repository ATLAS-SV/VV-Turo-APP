// Shared registry for the sign-in → app transition (provider lives in LogoTransition.tsx).
// The PIN screen reports where its big logo pieces are; the header reports where its small logo is.
import { createContext, useContext } from 'react';
import type { HostInstance } from 'react-native';

export type Rect = { x: number; y: number; w: number; h: number };

export interface LogoTransitionApi {
  /** PIN screen: remember where the frame, "VV" and company name are on screen. */
  setSource(parts: { frame?: Rect; vv?: Rect; name?: Rect }): void;
  /** Header: a small VV logo the big one can shrink into. Returns a function to remove it again. */
  addTarget(node: HostInstance | null): () => void;
  /** After a correct PIN: runs the animation and calls `switchToApp` once the screen is covered. */
  begin(switchToApp: () => void): void;
}

export const LogoTransitionCtx = createContext<LogoTransitionApi>({ setSource() {}, addTarget: () => () => {}, begin: (go) => go() });
export const useLogoTransition = () => useContext(LogoTransitionCtx);

/** measureInWindow as a promise. */
export function measure(node: HostInstance | null): Promise<Rect | null> {
  return new Promise((resolve) => {
    if (!node) return resolve(null);
    node.measureInWindow((x, y, w, h) => resolve(w && h ? { x, y, w, h } : null));
  });
}
