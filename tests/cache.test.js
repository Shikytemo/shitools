import { describe, expect, it, vi } from 'vitest'

import { defaultCacheKey, memoryStore, withCache } from '../src/cache.js'

describe('memoryStore', () => {
	it('returns undefined for missing keys', () => {
		const store = memoryStore()
		expect(store.get('missing')).toBeUndefined()
	})

	it('stores and retrieves values', () => {
		const store = memoryStore()
		store.set('k', { hello: 'world' })
		expect(store.get('k')).toEqual({ hello: 'world' })
	})

	it('expires entries after ttlMs (lazy on read)', () => {
		let now = 1_000
		const store = memoryStore({ ttlMs: 500, now: () => now })
		store.set('k', 'v')
		expect(store.get('k')).toBe('v')
		now += 600
		expect(store.get('k')).toBeUndefined()
		expect(store.size()).toBe(0)
	})

	it('per-set ttl overrides default ttl', () => {
		let now = 0
		const store = memoryStore({ ttlMs: 100, now: () => now })
		store.set('a', 1)
		store.set('b', 2, 1_000)
		now += 200
		expect(store.get('a')).toBeUndefined()
		expect(store.get('b')).toBe(2)
	})

	it('FIFO-evicts when maxEntries is reached', () => {
		const store = memoryStore({ maxEntries: 2 })
		store.set('a', 1)
		store.set('b', 2)
		store.set('c', 3) // should evict 'a'
		expect(store.get('a')).toBeUndefined()
		expect(store.get('b')).toBe(2)
		expect(store.get('c')).toBe(3)
		expect(store.size()).toBe(2)
	})

	it('updating an existing key does not trigger eviction', () => {
		const store = memoryStore({ maxEntries: 2 })
		store.set('a', 1)
		store.set('b', 2)
		store.set('a', 99) // update, not insert
		expect(store.size()).toBe(2)
		expect(store.get('a')).toBe(99)
		expect(store.get('b')).toBe(2)
	})

	it('delete and clear work', () => {
		const store = memoryStore()
		store.set('a', 1)
		store.set('b', 2)
		store.delete('a')
		expect(store.get('a')).toBeUndefined()
		expect(store.size()).toBe(1)
		store.clear()
		expect(store.size()).toBe(0)
	})
})

describe('defaultCacheKey', () => {
	it('returns a stable string for serializable args', () => {
		expect(defaultCacheKey('a', { b: 1 }, [2, 3])).toBe(JSON.stringify(['a', { b: 1 }, [2, 3]]))
	})

	it('falls back when args are not JSON-serializable', () => {
		const circular = {}
		circular.self = circular
		const key = defaultCacheKey(circular)
		expect(typeof key).toBe('string')
		expect(key.length).toBeGreaterThan(0)
	})
})

describe('withCache', () => {
	it('memoizes successful calls by argument signature', async () => {
		const inner = vi.fn(async (q, opts) => ({ q, hit: opts?.tag ?? null, n: Math.random() }))
		const cached = withCache(inner)
		const first = await cached('one piece', { tag: 'a' })
		const second = await cached('one piece', { tag: 'a' })
		const different = await cached('naruto', { tag: 'a' })

		expect(first).toEqual(second)
		expect(inner).toHaveBeenCalledTimes(2)
		expect(different.q).toBe('naruto')
	})

	it('does not cache thrown errors', async () => {
		let calls = 0
		const flaky = async () => {
			calls += 1
			if (calls === 1) throw new Error('first call boom')
			return 'ok'
		}
		const cached = withCache(flaky)
		await expect(cached('x')).rejects.toThrow('boom')
		await expect(cached('x')).resolves.toBe('ok')
		expect(calls).toBe(2)
	})

	it('respects ttlMs and re-fetches after expiry', async () => {
		let now = 0
		const store = memoryStore({ now: () => now })
		const inner = vi.fn(async q => `${q}:${now}`)
		const cached = withCache(inner, { store, ttlMs: 100 })

		await cached('q')
		await cached('q')
		expect(inner).toHaveBeenCalledTimes(1)
		now += 200
		await cached('q')
		expect(inner).toHaveBeenCalledTimes(2)
	})

	it('uses a custom key function', async () => {
		const inner = vi.fn(async (a, b) => a + b)
		const cached = withCache(inner, { key: a => `single:${a}` })
		await cached(1, 2) // key = single:1
		await cached(1, 99) // same key → cached
		expect(inner).toHaveBeenCalledTimes(1)
	})

	it('supports async store implementations', async () => {
		/** @type {Map<string, unknown>} */
		const map = new Map()
		const asyncStore = {
			async get(k) {
				return map.get(k)
			},
			async set(k, v) {
				map.set(k, v)
			},
			async delete(k) {
				map.delete(k)
			},
			async clear() {
				map.clear()
			}
		}
		const inner = vi.fn(async q => q.toUpperCase())
		const cached = withCache(inner, { store: asyncStore })
		expect(await cached('hi')).toBe('HI')
		expect(await cached('hi')).toBe('HI')
		expect(inner).toHaveBeenCalledTimes(1)
	})
})
