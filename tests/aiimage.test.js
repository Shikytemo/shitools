import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchImage, generateImage, listModels, MODELS } from '../src/aiimage.js'
import { InvalidInputError, ScrapeError } from '../src/errors.js'

const mockResponse = (body, init = {}) => ({
	ok: init.ok ?? true,
	status: init.status ?? 200,
	statusText: init.statusText ?? 'OK',
	url: init.url ?? 'https://image.pollinations.ai/',
	headers: new Headers(init.headers ?? {}),
	text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
	arrayBuffer: async () => {
		if (body instanceof Uint8Array) return body.buffer
		const bytes = new TextEncoder().encode(typeof body === 'string' ? body : JSON.stringify(body))
		return bytes.buffer
	}
})

describe('generateImage', () => {
	it('builds a Pollinations URL with sensible defaults', async () => {
		const out = await generateImage('a cyberpunk corgi')
		expect(out.url.startsWith('https://image.pollinations.ai/prompt/')).toBe(true)
		expect(out.url).toContain('a%20cyberpunk%20corgi')
		expect(out.url).toContain('model=flux')
		expect(out.url).toContain('width=1024')
		expect(out.url).toContain('height=1024')
		expect(out.url).toContain('nologo=true')
		expect(out.url).toContain('enhance=false')
		expect(out.url).toContain('private=true')
		expect(out.model).toBe('flux')
		expect(out.width).toBe(1024)
		expect(out.height).toBe(1024)
		expect(out.seed).toBeNull()
		expect(out.prompt).toBe('a cyberpunk corgi')
	})

	it('honors model, width, height, seed, enhance, nologo, referrer', async () => {
		const out = await generateImage('mecha samurai', {
			model: 'flux-anime',
			width: 512,
			height: 768,
			seed: 42,
			enhance: true,
			nologo: false,
			private: false,
			referrer: 'shitools'
		})
		expect(out.url).toContain('model=flux-anime')
		expect(out.url).toContain('width=512')
		expect(out.url).toContain('height=768')
		expect(out.url).toContain('seed=42')
		expect(out.url).toContain('enhance=true')
		expect(out.url).toContain('nologo=false')
		expect(out.url).toContain('private=false')
		expect(out.url).toContain('referrer=shitools')
		expect(out.seed).toBe(42)
	})

	it('encodes prompts with special characters', async () => {
		const out = await generateImage('cat & dog, "epic" #1')
		expect(out.url).toContain('cat%20%26%20dog%2C%20%22epic%22%20%231')
	})

	it('rejects empty prompt', async () => {
		await expect(generateImage('   ')).rejects.toBeInstanceOf(InvalidInputError)
		await expect(generateImage('')).rejects.toBeInstanceOf(InvalidInputError)
	})

	it('rejects prompt > 2000 chars', async () => {
		await expect(generateImage('x'.repeat(2001))).rejects.toBeInstanceOf(InvalidInputError)
	})
})

describe('fetchImage', () => {
	beforeEach(() => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])))
		)
	})
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('returns a Uint8Array on success', async () => {
		const bytes = await fetchImage('hello world')
		expect(bytes).toBeInstanceOf(Uint8Array)
		expect(bytes.length).toBe(4)
		expect(Array.from(bytes)).toEqual([0xff, 0xd8, 0xff, 0xe0])
	})

	it('throws ScrapeError on non-2xx', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				mockResponse('error', { ok: false, status: 502, statusText: 'Bad Gateway' })
			)
		)
		await expect(fetchImage('hello')).rejects.toBeInstanceOf(ScrapeError)
	})

	it('still validates prompt before calling fetch', async () => {
		await expect(fetchImage('   ')).rejects.toBeInstanceOf(InvalidInputError)
	})
})

describe('listModels', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('returns the upstream array of model slugs (string array)', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(['flux', 'turbo', 'flux-anime']))
		)
		const models = await listModels()
		expect(models).toEqual(['flux', 'turbo', 'flux-anime'])
	})

	it('returns the upstream array of model objects ({ name })', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse([{ name: 'flux' }, { name: 'turbo' }, { other: 'x' }]))
		)
		const models = await listModels()
		expect(models).toEqual(['flux', 'turbo'])
	})

	it('falls back to MODELS constant on upstream failure', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse('not json', { ok: true }))
		)
		const models = await listModels()
		expect(models).toEqual([...MODELS])
	})
})
