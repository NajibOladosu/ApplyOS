import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'ApplyOS | The AI Operating System for Your Job Search'
export const size = {
    width: 1200,
    height: 630,
}

export const contentType = 'image/png'

export default function Image() {
    return new ImageResponse(
        (
            <div
                style={{
                    background: '#0a0a0a',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'sans-serif',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#00ff88',
                        borderRadius: '40px',
                        width: '160px',
                        height: '160px',
                        marginBottom: '40px',
                        boxShadow: '0 0 40px rgba(0, 255, 136, 0.3)',
                    }}
                >
                    <svg
                        width="100"
                        height="93"
                        viewBox="0 0 897.23 836.07"
                    >
                        <path
                            fill="#0a0a0a"
                            d="M864.05,836.07H616.58a17.42,17.42,0,0,1-17.42-17.42V788.5a17.42,17.42,0,0,1,17.42-17.43H784.84a15.25,15.25,0,0,0,13.43-22.47L463.42,125.83a15.25,15.25,0,0,0-26.84,0L99.26,748.56a15.25,15.25,0,0,0,13.41,22.51h168a17.42,17.42,0,0,1,17.42,17.43v29.4a18.16,18.16,0,0,1-18.17,18.17H33.17A33.21,33.21,0,0,1,7.79,824.69,32.5,32.5,0,0,1,3.92,788.1L421.57,17A32.49,32.49,0,0,1,450.14,0h.05a32.51,32.51,0,0,1,28.58,17.11L893.36,788.18a32.52,32.52,0,0,1-4,36.55A33.23,33.23,0,0,1,864.05,836.07Z"
                        />
                    </svg>
                </div>
                <div
                    style={{
                        fontSize: '80px',
                        fontWeight: 'bold',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                    }}
                >
                    <span style={{ color: '#00ff88' }}>Apply</span>
                    <span>OS</span>
                </div>
                <div
                    style={{
                        fontSize: '32px',
                        color: '#888',
                        marginTop: '20px',
                        textAlign: 'center',
                        maxWidth: '800px',
                    }}
                >
                    The AI Operating System for Your Job Search
                </div>
            </div>
        ),
        {
            ...size,
        }
    )
}
