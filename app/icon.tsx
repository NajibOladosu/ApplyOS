import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 192,
  height: 192,
}

export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 128,
          background: '#000000',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '32px',
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
