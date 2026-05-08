import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError } from '../src/errors.js'
import { githubProfile } from '../src/githubprofile.js'

const mockResponse = (body, init = {}) => ({
	ok: init.ok ?? true,
	status: init.status ?? 200,
	statusText: init.statusText ?? 'OK',
	url: init.url ?? 'https://example.com/',
	headers: new Headers(init.headers ?? {}),
	text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
})

const USER_FIXTURE = {
	login: 'shikytemo',
	name: 'Shiky',
	bio: 'indie maker',
	avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
	html_url: 'https://github.com/shikytemo',
	followers: 12,
	following: 5,
	public_repos: 9,
	public_gists: 1,
	created_at: '2024-01-01T00:00:00Z',
	location: 'Indonesia'
}

const REPOS_FIXTURE = [
	{
		name: 'shitools',
		full_name: 'shikytemo/shitools',
		html_url: 'https://github.com/shikytemo/shitools',
		description: 'Reusable scraping toolkit',
		language: 'JavaScript',
		stargazers_count: 42,
		forks_count: 3,
		updated_at: '2026-05-08T00:00:00Z'
	}
]

describe('githubProfile', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns normalized profile + repos', async () => {
		let calls = 0
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				calls += 1
				return mockResponse(calls === 1 ? USER_FIXTURE : REPOS_FIXTURE)
			})
		)
		const result = await githubProfile('shikytemo')
		expect(result.login).toBe('shikytemo')
		expect(result.followers).toBe(12)
		expect(result.repos).toHaveLength(1)
		expect(result.repos[0].stars).toBe(42)
		expect(result.repos[0].language).toBe('JavaScript')
	})

	it('throws InvalidInputError on empty username', async () => {
		await expect(githubProfile('  ')).rejects.toBeInstanceOf(InvalidInputError)
	})
})
