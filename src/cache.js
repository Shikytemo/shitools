/**
 * Tiny pluggable cache layer for memoizing scraper calls.
 *
 * Two pieces:
 *
 * - {@link memoryStore} — in-process, TTL-aware, optional max-entry FIFO eviction.
 * - {@link withCache}   — function decorator that memoizes async scraper calls.
 *
 * The store interface is intentionally minimal so users can drop in a Redis /
 * file-backed store without changing the call site.
 *
 * @example
 * import { withCache, memoryStore, getSamehadakuStream } from '@shikytemo/shitools'
 * const cached = withCache(getSamehadakuStream, {
 *   store: memoryStore({ ttlMs: 10 * 60_000 })
 * })
 * await cached('one piece episode 1124')   // hits upstream
 * await cached('one piece episode 1124')   // hits cache
 *
 * @example  // bring-your-own store (Redis-shaped)
 * const redisStore = {
 *   async get(key) { return JSON.parse((await redis.get(key)) ?? 'null') ?? undefined },
 *   async set(key, value, ttlMs) { await redis.set(key, JSON.stringify(value), 'PX', ttlMs ?? 60000) },
 *   async delete(key) { await redis.del(key) },
 *   async clear() {}
 * }
 * const cached = withCache(scrapePinterest, { store: redisStore, ttlMs: 60_000 })
 */

/**
 * @typedef {Object} CacheStore
 * @property {(key: string) => unknown | Promise<unknown>} get
 * @property {(key: string, value: unknown, ttlMs?: number) => void | Promise<void>} set
 * @property {(key: string) => void | Promise<void>} delete
 * @property {() => void | Promise<void>} clear
 * @property {() => number} [size]
 */

const FOREVER = Number.POSITIVE_INFINITY

/**
 * Build an in-memory {@link CacheStore} backed by a `Map`.
 *
 * - TTL is checked lazily on read (no background timers, safe in serverless).
 * - When `maxEntries` is set, FIFO eviction kicks in once full. The oldest key
 *   is dropped before inserting a new one.
 *
 * @param {Object} [options]
 * @param {number} [options.ttlMs]        Default TTL applied when `set` omits one. Omit / 0 = forever.
 * @param {number} [options.maxEntries]   Maximum number of live entries. Omit = unbounded.
 * @param {() => number} [options.now]    Inject a clock in tests.
 * @returns {CacheStore & { size: () => number }}
 */
export const memoryStore = (options = {}) => {
	const map = new Map()
	const defaultTtl = options.ttlMs ?? 0
	const maxEntries = options.maxEntries
	const now = options.now ?? (() => Date.now())

	const expiresFor = ttl => {
		const effective = ttl ?? defaultTtl
		return effective > 0 ? now() + effective : FOREVER
	}

	return {
		get(key) {
			const entry = map.get(key)
			if (!entry) return undefined
			if (entry.expires <= now()) {
				map.delete(key)
				return undefined
			}
			return entry.value
		},
		set(key, value, ttlMs) {
			if (maxEntries !== undefined && !map.has(key) && map.size >= maxEntries) {
				const firstKey = map.keys().next().value
				if (firstKey !== undefined) map.delete(firstKey)
			}
			map.set(key, { value, expires: expiresFor(ttlMs) })
		},
		delete(key) {
			map.delete(key)
		},
		clear() {
			map.clear()
		},
		size() {
			return map.size
		}
	}
}

/**
 * Default key builder used by {@link withCache}: stringifies the call args.
 * Falls back to `String(arg)` when an arg is not JSON-serializable
 * (e.g. functions, symbols).
 *
 * @param  {...unknown} args
 * @returns {string}
 */
export const defaultCacheKey = (...args) => {
	try {
		return JSON.stringify(args)
	} catch {
		return args.map(value => String(value)).join('|')
	}
}

/**
 * Wrap an async function so its return value is cached by argument signature.
 * If the wrapped function throws, the error is **not** cached.
 *
 * @template {(...args: any[]) => Promise<any>} Fn
 * @param {Fn} fn
 * @param {Object} [options]
 * @param {CacheStore} [options.store]                          Defaults to a fresh `memoryStore({ ttlMs })`.
 * @param {number} [options.ttlMs]                              Per-entry TTL (default: forever).
 * @param {(...args: Parameters<Fn>) => string} [options.key]   Custom key derivation.
 * @returns {Fn}
 */
export const withCache = (fn, options = {}) => {
	const store = options.store ?? memoryStore({ ttlMs: options.ttlMs })
	const keyFn = options.key ?? defaultCacheKey
	const ttlMs = options.ttlMs

	return /** @type {Fn} */ (
		async (...args) => {
			const key = keyFn(...args)
			const cached = await store.get(key)
			if (cached !== undefined) return cached
			const result = await fn(...args)
			await store.set(key, result, ttlMs)
			return result
		}
	)
}
