// Glass appearance background (web / home-screen app): a deep purple gradient with soft glowing
// blobs that drift, and small glassy bubbles that float up. Pure CSS, so it costs almost nothing.
const CSS = `
@keyframes vv-drift-a { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,60px) scale(1.15); } }
@keyframes vv-drift-b { 0%,100% { transform: translate(0,0) scale(1.1); } 50% { transform: translate(-50px,-40px) scale(0.95); } }
@keyframes vv-rise { 0% { transform: translateY(0) translateX(0); opacity: 0; } 10% { opacity: 1; } 50% { transform: translateY(-55vh) translateX(14px); } 100% { transform: translateY(-115vh) translateX(-10px); opacity: 0; } }
.vv-glass-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
  background: radial-gradient(120% 80% at 0% 0%, #4A22A8 0%, transparent 55%),
              radial-gradient(90% 70% at 100% 100%, #5B2FB8 0%, transparent 60%),
              linear-gradient(165deg, #2C1270 0%, #1E0E45 50%, #12072F 100%); }
.vv-blob { position: absolute; border-radius: 50%; filter: blur(42px); opacity: .55; }
.vv-bubble { position: absolute; bottom: -60px; border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.55), rgba(255,255,255,.08) 45%, rgba(255,255,255,.02) 70%);
  border: 1px solid rgba(255,255,255,.22); box-shadow: inset 0 0 12px rgba(255,255,255,.12); }
@media (prefers-reduced-motion: reduce) { .vv-blob, .vv-bubble { animation: none !important; } }
`;

const BUBBLES = [
  { left: '8%', size: 26, dur: 19, delay: 0 },
  { left: '22%', size: 14, dur: 15, delay: 6 },
  { left: '37%', size: 34, dur: 23, delay: 3 },
  { left: '55%', size: 18, dur: 17, delay: 9 },
  { left: '68%', size: 42, dur: 27, delay: 1 },
  { left: '81%', size: 16, dur: 16, delay: 12 },
  { left: '92%', size: 24, dur: 21, delay: 5 },
];

export default function GlassBackdrop() {
  return (
    <div className="vv-glass-bg" aria-hidden="true">
      <style>{CSS}</style>
      <div className="vv-blob" style={{ width: 340, height: 340, left: -90, top: 60, background: '#8B5CF6', animation: 'vv-drift-a 18s ease-in-out infinite' }} />
      <div className="vv-blob" style={{ width: 280, height: 280, right: -80, top: '38%', background: '#D4AF37', opacity: 0.32, animation: 'vv-drift-b 22s ease-in-out infinite' }} />
      <div className="vv-blob" style={{ width: 320, height: 320, left: '20%', bottom: -120, background: '#6D3FE0', animation: 'vv-drift-a 26s ease-in-out infinite reverse' }} />
      {BUBBLES.map((b, i) => (
        <div
          key={i}
          className="vv-bubble"
          style={{ left: b.left, width: b.size, height: b.size, animation: `vv-rise ${b.dur}s linear ${b.delay}s infinite` }}
        />
      ))}
    </div>
  );
}
