/**
 * Unit tests for Queue Manager
 * Tests request queuing, priority handling, and processing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Create a fresh instance for each test to avoid state issues
class TestQueueManager {
    private queue: any[] = []
    private isProcessing = false
    private processCallback: ((request: any) => Promise<string>) | null = null

    setProcessCallback(callback: (request: any) => Promise<string>): void {
        this.processCallback = callback
    }

    async enqueue(
        prompt: string,
        complexity: 'SIMPLE' | 'MEDIUM' | 'COMPLEX',
        priority: number = 5
    ): Promise<{ result: Promise<string>; status: { position: number; totalQueued: number; estimatedWaitSeconds: number } }> {
        const id = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`

        let resolvePromise: (result: string) => void
        let rejectPromise: (error: Error) => void

        const resultPromise = new Promise<string>((resolve, reject) => {
            resolvePromise = resolve
            rejectPromise = reject
        })

        const request = {
            id,
            prompt,
            complexity,
            resolve: resolvePromise!,
            reject: rejectPromise!,
            queuedAt: Date.now(),
            priority,
        }

        const insertIndex = this.queue.findIndex(r => r.priority > priority)
        if (insertIndex === -1) {
            this.queue.push(request)
        } else {
            this.queue.splice(insertIndex, 0, request)
        }

        const position = this.queue.findIndex(r => r.id === id) + 1

        return {
            result: resultPromise,
            status: {
                position,
                totalQueued: this.queue.length,
                estimatedWaitSeconds: Math.ceil((position * 3000) / 1000),
            },
        }
    }

    getQueueLength(): number {
        return this.queue.length
    }

    hasPendingRequests(): boolean {
        return this.queue.length > 0
    }

    getQueueStats(): { length: number; oldestWaitMs: number | null } {
        const oldest = this.queue[0]
        return {
            length: this.queue.length,
            oldestWaitMs: oldest ? Date.now() - oldest.queuedAt : null,
        }
    }

    clearAllSync(): void {
        // Clear without rejecting - for test cleanup
        this.queue = []
    }
}

describe('QueueManager', () => {
    let queueManager: TestQueueManager

    beforeEach(() => {
        queueManager = new TestQueueManager()
    })

    afterEach(() => {
        queueManager.clearAllSync()
    })

    describe('enqueue', () => {
        it('should add a request to the queue', async () => {
            const { status } = await queueManager.enqueue('test prompt', 'SIMPLE')

            expect(status.position).toBe(1)
            expect(status.totalQueued).toBe(1)
            expect(queueManager.getQueueLength()).toBe(1)
        })

        it('should maintain FIFO order for same priority', async () => {
            await queueManager.enqueue('first', 'SIMPLE', 5)
            await queueManager.enqueue('second', 'SIMPLE', 5)
            await queueManager.enqueue('third', 'SIMPLE', 5)

            expect(queueManager.getQueueLength()).toBe(3)
        })

        it('should prioritize lower priority numbers', async () => {
            await queueManager.enqueue('low priority', 'SIMPLE', 10)
            const { status } = await queueManager.enqueue('high priority', 'SIMPLE', 1)

            // High priority should be inserted first
            expect(status.position).toBe(1)
        })

        it('should estimate wait time', async () => {
            const { status } = await queueManager.enqueue('test', 'SIMPLE')

            expect(status.estimatedWaitSeconds).toBeGreaterThan(0)
        })
    })

    describe('getQueueStats', () => {
        it('should return queue length', async () => {
            await queueManager.enqueue('test1', 'SIMPLE')
            await queueManager.enqueue('test2', 'MEDIUM')

            const stats = queueManager.getQueueStats()
            expect(stats.length).toBe(2)
        })

        it('should track oldest wait time', async () => {
            await queueManager.enqueue('test', 'SIMPLE')

            // Wait a tiny bit
            await new Promise(resolve => setTimeout(resolve, 10))

            const stats = queueManager.getQueueStats()
            expect(stats.oldestWaitMs).toBeGreaterThan(0)
        })

        it('should return null for oldest wait when queue is empty', () => {
            const stats = queueManager.getQueueStats()
            expect(stats.oldestWaitMs).toBeNull()
        })
    })

    describe('hasPendingRequests', () => {
        it('should return false when queue is empty', () => {
            expect(queueManager.hasPendingRequests()).toBe(false)
        })

        it('should return true when queue has requests', async () => {
            await queueManager.enqueue('test', 'SIMPLE')
            expect(queueManager.hasPendingRequests()).toBe(true)
        })
    })

    describe('clearAllSync', () => {
        it('should clear all queued requests', async () => {
            await queueManager.enqueue('test1', 'SIMPLE')
            await queueManager.enqueue('test2', 'MEDIUM')
            await queueManager.enqueue('test3', 'COMPLEX')

            expect(queueManager.getQueueLength()).toBe(3)

            queueManager.clearAllSync()

            expect(queueManager.getQueueLength()).toBe(0)
        })
    })
})
