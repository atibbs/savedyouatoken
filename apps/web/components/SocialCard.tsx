export function SocialCard() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        background: '#171713',
        color: '#f7f4ea',
        padding: '68px 76px',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          opacity: 0.08,
          backgroundImage:
            'linear-gradient(#f7f4ea 1px, transparent 1px), linear-gradient(90deg, #f7f4ea 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div
            style={{
              width: 88,
              height: 88,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              border: '4px solid #171713',
              background: '#eaff3f',
              color: '#171713',
              fontFamily: 'monospace',
              fontSize: 29,
              fontWeight: 700,
              letterSpacing: -3,
              transform: 'rotate(-8deg)',
            }}
          >
            S<span style={{ color: '#f06b42' }}>/</span>T
          </div>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>
            Saved You a Token
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 960 }}>
          <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, lineHeight: 1.05, letterSpacing: -3 }}>
            Find the waste in your LLM prompts.
          </div>
          <div
            style={{
              display: 'flex',
              maxWidth: 790,
              marginTop: 28,
              fontSize: 29,
              lineHeight: 1.35,
              color: '#c9c7bd',
            }}
          >
            Audit prompt costs in the browser, in CI, or inside your production application.
          </div>
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          right: -84,
          bottom: -90,
          width: 350,
          height: 350,
          display: 'flex',
          borderRadius: 999,
          background: '#f06b42',
        }}
      />
    </div>
  );
}
