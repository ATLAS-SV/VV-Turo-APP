// Shared hook for the "box expands into its page" transition (provider lives in motion.tsx).
import { createContext, useContext } from 'react';
import type { HostInstance } from 'react-native';

export type Expand = (from: HostInstance | null, go: () => void, opts?: { radius?: number; color?: string }) => void;

export const ExpandCtx = createContext<Expand>((_, go) => go());

/** expand(boxRef.current, () => router.push(...)): the box grows to fill the screen, then the page opens. */
export const useExpand = () => useContext(ExpandCtx);
