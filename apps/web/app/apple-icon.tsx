import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#eaff3f',
          border: '10px solid #171713',
          borderRadius: 42,
          color: '#171713',
          fontFamily: 'monospace',
          fontSize: 58,
          fontWeight: 700,
          letterSpacing: -5,
        }}
      >
        <span>S</span><span style={{ color: '#f06b42' }}>/</span><span>T</span>
      </div>
    ),
    size,
  );
}
