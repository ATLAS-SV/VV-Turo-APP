import { LOGO_GRADIENT_CSS } from './logoColors';

/** Fills its parent with the logo gradient (web: plain CSS). */
export default function LogoGradient() {
  return <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: LOGO_GRADIENT_CSS, pointerEvents: 'none' }} />;
}
