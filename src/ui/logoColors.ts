/**
 * The logo's own colors: app icon, header logo, splash, PIN screen and the sign-in animation.
 * Separate from the appearance palettes (Light / Dark / Glass), which don't change with this.
 * scripts/make-logo.py reads these values to draw the icon images.
 */
export const LOGO = {
  /** Gradient, bottom-left → top-right: bright violet to deep purple. */
  from: '#7B42FF',
  mid: '#5530C4',
  to: '#22105A',
  /** The VV and the thin frame. */
  gold: '#F4CF5E',
};

/** Gradient angle (CSS degrees: 0 = up, 90 = right). Bright corner bottom-left, dark corner top-right. */
export const LOGO_ANGLE = 35;
export const LOGO_GRADIENT_CSS = `linear-gradient(${LOGO_ANGLE}deg, ${LOGO.from} 0%, ${LOGO.mid} 48%, ${LOGO.to} 100%)`;
