/**
 * Queue Manager for AI Requests
 * 
 * Provides a simple in-memory queue for AI requests when all models are rate-limited.
 * Requests are processed FIFO when models become available.
 */

export interface QueuedRequest {
    id: string
    prompt: string
    complexity: 'SIMPLE' | 'MEDIUM' | 'COMPLEX'
    resolve: (result: string) => void
    reject: (error: Error) => void
    queuedAt: number
    priority: number // Lower = higher priority
}

export interface QueueStatus {
    position: number
    totalQueued: number
    estimatedWaitSeconds: number
}

// Maximum queue size to prevent memory issues
const MAX_QUEUE_SIZE = 50

// Average processing time per request (in ms) for estimation
const AVG_PROCESSING_TIME_MS = 3000

class QueueManager {
    private queue: QueuedRequest[] = []
    private isProcessing = false
    private processCallback: ((request: QueuedRequest) => Promise<string>) | null = null

    /**
     * Set the callback function that processes queued requests
     */
    setProcessCallback(callback: (request: QueuedRequest) => Promise<string>): void {
        this.processCallback = callback
    }

    /**
     * Add a request to the queue
     * Returns a promise that resolves when the request is processed
     */
    async enqueue(
        prompt: string,
        complexity: 'SIMPLE' | 'MEDIUM' | 'COMPLEX',
        priority: number = 5
    ): Promise<{ result: Promise<string>; status: QueueStatus }> {
        if (this.queue.length >= MAX_QUEUE_SIZE) {
            throw new Error('Queue is full. Please try again later.')
        }

        const id = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`

        let resolvePromise: (result: string) => void
        let rejectPromise: (error: Error) => void

        const resultPromise = new Promise<string>((resolve, reject) => {
            resolvePromise = resolve
            rejectPromise = reject
        })

        const request: QueuedRequest = {
            id,
            prompt,
            complexity,
            resolve: resolvePromise!,
            reject: rejectPromise!,
            queuedAt: Date.now(),
            priority,
        }

        // Insert based on priority (lower priority number = higher priority)
        const insertIndex = this.queue.findIndex(r => r.priority > priority)
        if (insertIndex === -1) {
            this.queue.push(request)
        } else {
            this.queue.splice(insertIndex, 0, request)
        }

        const position = this.queue.findIndex(r => r.id === id) + 1

        console.log(`[Queue] Request ${id} queued at position ${position}/${this.queue.length}`)

        return {
            result: resultPromise,
            status: {
                position,
                totalQueued: this.queue.length,
                estimatedWaitSeconds: Math.ceil((position * AVG_PROCESSING_TIME_MS) / 1000),
            },
        }
    }

    /**
     * Get the current queue status for a request
     */
    getStatus(requestId: string): QueueStatus | null {
        const position = this.queue.findIndex(r => r.id === requestId) + 1
        if (position === 0) return null

        return {
            position,
            totalQueued: this.queue.length,
            estimatedWaitSeconds: Math.ceil((position * AVG_PROCESSING_TIME_MS) / 1000),
        }
    }

    /**
     * Get overall queue stats
     */
    getQueueStats(): { length: number; oldestWaitMs: number | null } {
        const oldest = this.queue[0]
        return {
            length: this.queue.length,
            oldestWaitMs: oldest ? Date.now() - oldest.queuedAt : null,
        }
    }

    /**
     * Start processing the queue
     * Should be called when models become available
     */
    async startProcessing(): Promise<void> {
        if (this.isProcessing || this.queue.length === 0 || !this.processCallback) {
            return
        }

        this.isProcessing = true
        console.log(`[Queue] Starting queue processing. ${this.queue.length} items in queue.`)

        while (this.queue.length > 0) {
            const request = this.queue.shift()
            if (!request) break

            try {
                console.log(`[Queue] Processing request ${request.id}`)
                const result = await this.processCallback(request)
                request.resolve(result)
                console.log(`[Queue] Request ${request.id} completed successfully`)
            } catch (error) {
                console.error(`[Queue] Request ${request.id} failed:`, error)

                // Check if it's a rate limit error - if so, put back in queue
                if (error instanceof Error && error.message.includes('rate limit')) {
                    console.log(`[Queue] Re-queuing ${request.id} due to rate limit`)
                    this.queue.unshift(request) // Put back at front

                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, 5000))
                    continue
                }

                request.reject(error instanceof Error ? error : new Error(String(error)))
            }
        }

        this.isProcessing = false
        console.log('[Queue] Queue processing complete.')
    }

    /**
     * Cancel a queued request
     */
    cancel(requestId: string): boolean {
        const index = this.queue.findIndex(r => r.id === requestId)
        if (index === -1) return false

        const [removed] = this.queue.splice(index, 1)
        removed.reject(new Error('Request cancelled'))
        return true
    }

    /**
     * Clear all queued requests
     */
    clearAll(): void {
        this.queue.forEach(request => {
            request.reject(new Error('Queue cleared'))
        })
        this.queue = []
    }

    /**
     * Check if queue has pending requests
     */
    hasPendingRequests(): boolean {
        return this.queue.length > 0
    }

    /**
     * Get queue length
     */
    getQueueLength(): number {
        return this.queue.length
    }
}

// Singleton instance
export const queueManager = new QueueManager()
export default queueManager
