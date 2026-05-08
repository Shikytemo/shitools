import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError } from '../src/errors.js'
import { getPypiPackage } from '../src/pypi.js'

const mockResponse = body => ({
	ok: true,
	status: 200,
	statusText: 'OK',
	url: 'https://example.com/',
	headers: new Headers(),
	text: async () => JSON.stringify(body)
})

const FIXTURE = {
	info: {
		name: 'requests',
		version: '2.32.3',
		summary: 'Python HTTP for Humans.',
		author: 'Kenneth Reitz',
		author_email: 'me@kennethreitz.org',
		license: 'Apache 2.0',
		home_page: 'https://requests.readthedocs.io',
		project_url: 'https://pypi.org/project/requests/',
		requires_dist: ['charset-normalizer', 'idna'],
		requires_python: '>=3.8'
	},
	releases: {
		'0.1.0': [{ upload_time: '2011-02-14' }],
		'2.32.3': [{ upload_time: '2024-05-29' }]
	}
}

describe('getPypiPackage', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns mapped metadata', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(FIXTURE))
		)
		const p = await getPypiPackage('requests')
		expect(p.name).toBe('requests')
		expect(p.versionLatest).toBe('2.32.3')
		expect(p.summary).toContain('HTTP')
		expect(p.releaseDate).toBe('2024-05-29')
	})

	it('throws on empty name', async () => {
		await expect(getPypiPackage('')).rejects.toBeInstanceOf(InvalidInputError)
	})
})
