import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError } from '../src/errors.js'
import { npmStalk } from '../src/npmstalk.js'

const mockResponse = (body, init = {}) => ({
	ok: init.ok ?? true,
	status: init.status ?? 200,
	statusText: init.statusText ?? 'OK',
	url: init.url ?? 'https://example.com/',
	headers: new Headers(init.headers ?? {}),
	text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
})

const FIXTURE = {
	name: 'axios',
	description: 'Promise based HTTP client',
	homepage: 'https://axios-http.com',
	'dist-tags': { latest: '1.7.0' },
	versions: {
		'0.1.0': { license: 'MIT', dependencies: {} },
		'1.7.0': { license: 'MIT', dependencies: { foo: '^1.0.0', bar: '^2.0.0' } }
	},
	time: {
		created: '2014-08-29T00:00:00.000Z',
		'1.7.0': '2024-04-12T00:00:00.000Z'
	},
	maintainers: [{ name: 'matt' }, { name: 'emily' }]
}

describe('npmStalk', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns normalized package info', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(FIXTURE))
		)
		const result = await npmStalk('axios')
		expect(result.name).toBe('axios')
		expect(result.versionLatest).toBe('1.7.0')
		expect(result.versionPublish).toBe('0.1.0')
		expect(result.latestDependencies).toBe(2)
		expect(result.publishDependencies).toBe(0)
		expect(result.maintainers).toEqual(['matt', 'emily'])
	})

	it('throws InvalidInputError on empty package', async () => {
		await expect(npmStalk('  ')).rejects.toBeInstanceOf(InvalidInputError)
	})
})
