// Motion: (1) a tapped box/card expands to fill the screen and becomes the page it opens;
// (2) swipe left/right on a tab page to move to the neighbouring tab.
// Built on React Native's own Animated + PanResponder, so it works the same on iPhone and the web app.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, PanResponder, Platform, StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native';
import { colors } from './components';
import { ExpandCtx, type Expand } from './expandContext';

// ---------- (1) expand a box into its page ----------

type Rect = { x: number; y: number; w: number; h: number };

// The phone's Reduce Motion setting, known ahead of time so animations can start instantly.
let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => (reduceMotion = v))
  .catch(() => {});
AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => (reduceMotion = v));
export { useExpand } from './expandContext';

const EXPAND_MS = 280;
const FADE_MS = 200;

export function ExpandProvider({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const [anim, setAnim] = useState<{ rect: Rect; radius: number; color: string } | null>(null);
  const [progress] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));
  const busy = useRef(false);

  const expand = useCallback<Expand>(
    (from, go, opts = {}) => {
      if (!from || reduceMotion || busy.current) return go();
      busy.current = true;
      from.measureInWindow((x, y, w, h) => {
        if (!w || !h) {
          busy.current = false;
          return go();
        }
        progress.setValue(0);
        fade.setValue(1);
        setAnim({ rect: { x, y, w, h }, radius: opts.radius ?? 14, color: opts.color ?? colors.card });
        Animated.timing(progress, { toValue: 1, duration: EXPAND_MS, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: false }).start(() => {
          go(); // the page opens underneath the fully expanded surface…
          setTimeout(() => {
            // …then the surface fades away to reveal it.
            Animated.timing(fade, { toValue: 0, duration: FADE_MS, easing: Easing.out(Easing.quad), useNativeDriver: false }).start(() => {
              setAnim(null);
              busy.current = false;
            });
          }, 40);
        });
      });
    },
    [progress, fade],
  );

  const r = anim?.rect;
  return (
    <ExpandCtx.Provider value={expand}>
      {children}
      {anim && r ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            zIndex: 1000,
            elevation: 1000,
            left: progress.interpolate({ inputRange: [0, 1], outputRange: [r.x, 0] }),
            top: progress.interpolate({ inputRange: [0, 1], outputRange: [r.y, 0] }),
            width: progress.interpolate({ inputRange: [0, 1], outputRange: [r.w, width] }),
            height: progress.interpolate({ inputRange: [0, 1], outputRange: [r.h, height] }),
            borderRadius: progress.interpolate({ inputRange: [0, 1], outputRange: [anim.radius, 0] }),
            backgroundColor: progress.interpolate({ inputRange: [0, 1], outputRange: [anim.color, colors.bg] }),
            opacity: fade,
            shadowColor: '#000',
            shadowOpacity: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.18, 0] }),
            shadowRadius: 16,
          }}
        />
      ) : null}
    </ExpandCtx.Provider>
  );
}

// ---------- (2) swipe between tabs ----------

const SWIPE_DISTANCE = 70; // px
const SWIPE_VELOCITY = 0.45; // px/ms

/**
 * Wraps a tab page: drag sideways and the page follows your finger a little;
 * let go past the threshold and the neighbouring tab opens (sliding in from that side).
 */
export function SwipeTabs({
  children,
  prev,
  next,
  onGo,
  enabled = true,
}: {
  children: ReactNode;
  prev: string | null;
  next: string | null;
  onGo: (tab: string) => void;
  enabled?: boolean;
}) {
  const [tx] = useState(() => new Animated.Value(0));
  const latest = useRef({ prev, next, onGo, enabled });
  useEffect(() => {
    latest.current = { prev, next, onGo, enabled };
  });

  // Shared by the web and native gesture paths.
  const swipedAt = useRef(0);
  const motion = useRef({
    drag(dx: number) {
      swipedAt.current = Date.now();
      const { prev: p, next: n } = latest.current;
      const allowed = (dx > 0 && p) || (dx < 0 && n);
      tx.setValue(dx * (allowed ? 0.35 : 0.08)); // follows the finger; resists where there's no neighbour
    },
    finish(dx: number, vx: number) {
      const { prev: p, next: n, onGo: go } = latest.current;
      const target = (dx < -SWIPE_DISTANCE || vx < -SWIPE_VELOCITY) && n ? n : (dx > SWIPE_DISTANCE || vx > SWIPE_VELOCITY) && p ? p : null;
      if (target) {
        tx.setValue(0);
        go(target);
      } else {
        Animated.spring(tx, { toValue: 0, useNativeDriver: Platform.OS !== 'web', bounciness: 6 }).start();
      }
    },
    cancel() {
      Animated.spring(tx, { toValue: 0, useNativeDriver: Platform.OS !== 'web' }).start();
    },
  });

  // Web (incl. the iPhone home-screen app): read the browser's pointer events directly, so a
  // scrolling page can't hold on to the gesture. `touch-action: pan-y` leaves vertical scrolling to the browser.
  const node = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = node.current;
    if (Platform.OS !== 'web' || !el?.addEventListener) return;
    const m = motion.current;
    let start: { x: number; y: number; t: number; id: number } | null = null;
    let mode: 'undecided' | 'swipe' | 'scroll' = 'undecided';
    const down = (e: PointerEvent) => {
      if (!latest.current.enabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
      start = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
      mode = 'undecided';
    };
    const move = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (mode === 'undecided') {
        if (Math.abs(dx) > 16 && Math.abs(dx) > Math.abs(dy) * 2) mode = 'swipe';
        else if (Math.abs(dy) > 12) mode = 'scroll';
      }
      if (mode === 'swipe') m.drag(dx);
    };
    const up = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      if (mode === 'swipe') {
        const dx = e.clientX - start.x;
        m.finish(dx, dx / Math.max(1, e.timeStamp - start.t));
      }
      start = null;
    };
    const cancel = () => {
      if (mode === 'swipe') m.cancel();
      start = null;
    };
    // Releasing a mouse drag over a card would still "click" it: swallow that click.
    const click = (e: Event) => {
      if (Date.now() - swipedAt.current < 400) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    el.addEventListener('pointerdown', down, true);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
    el.addEventListener('click', click, true);
    return () => {
      el.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
      el.removeEventListener('click', click, true);
    };
  }, []);

  // Native app builds: React Native's gesture responder. Claims only clearly sideways drags.
  // The handlers read refs only while a finger is moving, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => latest.current.enabled && Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderMove: (_, g) => motion.current.drag(g.dx),
      onPanResponderRelease: (_, g) => motion.current.finish(g.dx, g.vx),
      onPanResponderTerminate: () => motion.current.cancel(),
      onPanResponderTerminationRequest: () => true,
    }),
  );

  return (
    <Animated.View
      ref={node as never}
      {...(Platform.OS === 'web' ? {} : responder.panHandlers)}
      style={[styles.fill, { transform: [{ translateX: tx }] }, Platform.OS === 'web' ? ({ touchAction: 'pan-y' } as object) : null]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });

// ---------- (3) slide content when a value changes (months, Cars/Bookings switch) ----------

/**
 * When `value` changes, the content slides in from the side you're moving toward
 * (later value: from the right; earlier: from the left) and fades up.
 */
export function SlideOnChange({ value, children, distance = 36, style }: { value: string; children: ReactNode; distance?: number; style?: ViewStyle }) {
  const [tx] = useState(() => new Animated.Value(0));
  const [op] = useState(() => new Animated.Value(1));
  const prev = useRef(value);
  // Layout effect: set the starting offset before the new content is painted (no flash).
  useLayoutEffect(() => {
    if (prev.current === value) return;
    const dir = value > prev.current ? 1 : -1;
    prev.current = value;
    if (reduceMotion) return;
    tx.setValue(dir * distance);
    op.setValue(0.2);
    Animated.parallel([
      Animated.timing(tx, { toValue: 0, duration: 260, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(op, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  }, [value, distance, tx, op]);
  return <Animated.View style={[style, { transform: [{ translateX: tx }], opacity: op }]}>{children}</Animated.View>;
}
