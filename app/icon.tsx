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
          background: '#18BB70',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '32px',
        }}
      >
        <svg
          width="128"
          height="119"
          viewBox="0 0 897.23 836.07"
        >
          <path
            fill="#0a0a0a"
            d="M864.05,836.07H616.58a17.42,17.42,0,0,1-17.42-17.42V788.5a17.42,17.42,0,0,1,17.42-17.43H784.84a15.25,15.25,0,0,0,13.43-22.47L463.42,125.83a15.25,15.25,0,0,0-26.84,0L99.26,748.56a15.25,15.25,0,0,0,13.41,22.51h168a17.42,17.42,0,0,1,17.42,17.43v29.4a18.16,18.16,0,0,1-18.17,18.17H33.17A33.21,33.21,0,0,1,7.79,824.69,32.5,32.5,0,0,1,3.92,788.1L421.57,17A32.49,32.49,0,0,1,450.14,0h.05a32.51,32.51,0,0,1,28.58,17.11L893.36,788.18a32.52,32.52,0,0,1-4,36.55A33.23,33.23,0,0,1,864.05,836.07Z"
          />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}
