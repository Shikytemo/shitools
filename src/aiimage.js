/**
 * Free text-to-image generator backed by [Pollinations.ai](https://pollinations.ai).
 *
 * Pollinations exposes a public, key-less image endpoint at
 * `https://image.pollinations.ai/prompt/<encoded prompt>` that returns a
 * JPEG/PNG synchronously (it queues the prompt and streams the bytes when
 * the model finishes). It is widely used by bot makers because it has no
 * registration, no rate-limit token, and no daily cap (per IP).
 *
 * @example
 * import { generateImage, fetchImage, MODELS } from '@shikytemo/shitools'
 *
 * // Just build a hot-link URL (no upstream call):
 * const { url } = await generateImage('a cyberpunk corgi', {
 *   model: 'flux',
 *   width: 1024,
 *   height: 1024
 * })
 *
 * // Or fetch the bytes (Uint8Array) and save:
 * import { writeFile } from 'node:fs/promises'
 * const bytes = await fetchImage('mecha samurai, ukiyo-e style', { seed: 42 })
 * await writeFile('out.jpg', bytes)
 */

import { InvalidInputError, ScrapeError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'aiimage'
const ENDPOINT = 'https://image.pollinations.ai/prompt'
const DEFAULT_MODEL = 'flux'
const DEFAULT_WIDTH = 1024
const DEFAULT_HEIGHT = 1024
const MAX_PROMPT_LENGTH = 2000

/**
 * Known Pollinations models. Pollinations occasionally adds/renames models —
 * use {@link listModels} to fetch the live list.
 */
export const MODELS = Object.freeze([
	'flux',
	'flux-realism',
	'flux-anime',
	'flux-3d',
	'turbo',
	'any-dark'
])

/**
 * @typedef {Object} GenerateImageOptions
 * @property {string} [model]      Model slug, default `'flux'`.
 * @property {number} [width]      Output width, default 1024.
 * @property {number} [height]     Output height, default 1024.
 * @property {number} [seed]       Deterministic seed (omit for random).
 * @property {boolean} [nologo]    Strip Pollinations watermark, default true.
 * @property {boolean} [enhance]   Let Pollinations rewrite the prompt, default false.
 * @property {boolean} [private]   Don't surface in public Pollinations feed, default true.
 * @property {string} [referrer]   Referrer to send (some endpoints rate-limit anonymous traffic).
 */

/**
 * @typedef {Object} GenerateImageResult
 * @property {string} url
 * @property {string} prompt
 * @property {string} model
 * @property {number} width
 * @property {number} height
 * @property {number|null} seed
 */

const validatePrompt = prompt => {
	if (typeof prompt !== 'string' || !prompt.trim()) {
		throw new InvalidInputError('prompt is required', { source: SOURCE })
	}
	if (prompt.length > MAX_PROMPT_LENGTH) {
		throw new InvalidInputError(
			`prompt exceeds ${MAX_PROMPT_LENGTH} character limit (got ${prompt.length})`,
			{ source: SOURCE }
		)
	}
}

const buildUrl = (prompt, options = {}) => {
	const model = options.model ?? DEFAULT_MODEL
	const width = options.width ?? DEFAULT_WIDTH
	const height = options.height ?? DEFAULT_HEIGHT
	const seed = options.seed ?? null
	const nologo = options.nologo ?? true
	const enhance = options.enhance ?? false
	const isPrivate = options.private ?? true

	const params = new URLSearchParams({
		model,
		width: String(width),
		height: String(height),
		nologo: String(Boolean(nologo)),
		enhance: String(Boolean(enhance)),
		private: String(Boolean(isPrivate))
	})
	if (seed !== null && seed !== undefined) params.set('seed', String(seed))
	if (options.referrer) params.set('referrer', options.referrer)

	const encoded = encodeURIComponent(prompt.trim())
	return {
		url: `${ENDPOINT}/${encoded}?${params.toString()}`,
		model,
		width,
		height,
		seed
	}
}

/**
 * Build a hot-link Pollinations URL for `prompt` without contacting the API.
 * Useful when you just need a `<img src=...>` ready URL — Pollinations will
 * generate the image lazily on first request.
 *
 * @param {string} prompt
 * @param {GenerateImageOptions} [options]
 * @returns {Promise<GenerateImageResult>}
 */
export const generateImage = async (prompt, options = {}) => {
	validatePrompt(prompt)
	const built = buildUrl(prompt, options)
	return {
		url: built.url,
		prompt: prompt.trim(),
		model: built.model,
		width: built.width,
		height: built.height,
		seed: built.seed
	}
}

/**
 * Fetch the generated image bytes synchronously. Returns a `Uint8Array`
 * suitable for `writeFile`, Buffer wrap, or piping back to a Telegram /
 * WhatsApp client.
 *
 * @param {string} prompt
 * @param {GenerateImageOptions & { retries?: number, timeout?: number }} [options]
 * @returns {Promise<Uint8Array>}
 */
export const fetchImage = async (prompt, options = {}) => {
	const { url } = await generateImage(prompt, options)
	const response = await fetch(url, {
		headers: { 'user-agent': 'shitools/1.x (+https://github.com/Shikytemo/shitools)' }
	})
	if (!response.ok) {
		throw new ScrapeError(`Pollinations responded ${response.status} ${response.statusText}`, {
			source: SOURCE,
			url,
			status: response.status
		})
	}
	const buffer = await response.arrayBuffer()
	return new Uint8Array(buffer)
}

/**
 * List the live model catalog from Pollinations. Falls back to {@link MODELS}
 * if the upstream call fails (e.g. offline tests).
 *
 * @param {{ retries?: number, timeout?: number }} [options]
 * @returns {Promise<string[]>}
 */
export const listModels = async (options = {}) => {
	const url = 'https://image.pollinations.ai/models'
	try {
		const response = await httpClient.get(url, { source: SOURCE, ...options })
		const parsed = JSON.parse(response.body)
		if (Array.isArray(parsed)) {
			return parsed.map(item => (typeof item === 'string' ? item : item?.name)).filter(Boolean)
		}
	} catch {
		// fall through
	}
	return [...MODELS]
}
