import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 180,
  height: 180,
}

export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 108,
          background: '#000000',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '40px',
          color: '#00FF88',
          fontWeight: 'bold',
          fontFamily: '"Crimson Text", serif',
        }}
      >
        T
      </div>
    ),
    {
      ...size,
    }
  )
}
