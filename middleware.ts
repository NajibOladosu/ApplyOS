import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    // Check if the request is for an API route
    if (request.nextUrl.pathname.startsWith('/api/')) {
        // Retrieve the current response
        const response = NextResponse.next()

        // Add CORS headers
        response.headers.set('Access-Control-Allow-Origin', '*')
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

        // Handle preflight requests
        if (request.method === 'OPTIONS') {
            return new NextResponse(null, {
                status: 200,
                headers: response.headers,
            })
        }

        return response
    }

    // Allow other requests to proceed as normal
    return NextResponse.next()
}

export const config = {
    matcher: '/api/:path*',
}
