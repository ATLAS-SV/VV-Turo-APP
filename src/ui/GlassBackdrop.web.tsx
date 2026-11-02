// Glass background (web / home-screen app): a still gradient with soft glows behind the frosted
// surfaces (purple for Glass Dark, lavender-to-cream for Glass Light). Pure CSS, no animation.
const CSS = `
.vv-glass-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
  background: radial-gradient(120% 80% at 0% 0%, #4A22A8 0%, transparent 55%),
              radial-gradient(90% 70% at 100% 100%, #5B2FB8 0%, transparent 60%),
              linear-gradient(165deg, #2C1270 0%, #1E0E45 50%, #12072F 100%); }
.vv-blob { position: absolute; border-radius: 50%; filter: blur(42px); opacity: .55; }
.vv-glass-bg.vv-light { background: radial-gradient(110% 75% at 0% 0%, #E3D6FF 0%, transparent 60%),
              radial-gradient(90% 70% at 100% 100%, #FFE9C2 0%, transparent 60%),
              linear-gradient(165deg, #F6F1FF 0%, #EEE6FF 50%, #FFF7EA 100%); }
.vv-light .vv-blob { opacity: .5; }
`;

export default function GlassBackdrop({ light = false }: { light?: boolean }) {
  return (
    <div className={`vv-glass-bg${light ? ' vv-light' : ''}`} aria-hidden="true">
      <style>{CSS}</style>
      <div className="vv-blob" style={{ width: 340, height: 340, left: -90, top: 60, background: light ? '#C4B0FF' : '#8B5CF6' }} />
      <div className="vv-blob" style={{ width: 280, height: 280, right: -80, top: '38%', background: light ? '#F6D47E' : '#D4AF37', opacity: light ? 0.45 : 0.32 }} />
      <div className="vv-blob" style={{ width: 320, height: 320, left: '20%', bottom: -120, background: light ? '#D9C2FF' : '#6D3FE0' }} />
    </div>
  );
}
