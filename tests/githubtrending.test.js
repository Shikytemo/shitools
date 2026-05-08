import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError } from '../src/errors.js'
import { getGithubTrending } from '../src/githubtrending.js'

const mockResponse = body => ({
	ok: true,
	status: 200,
	statusText: 'OK',
	url: 'https://example.com/',
	headers: new Headers(),
	text: async () => body
})

const HTML = `
<html><body>
  <article class="Box-row">
    <h2><a href="/openai/whisper">openai/whisper</a></h2>
    <p>Speech recognition</p>
    <span itemprop="programmingLanguage">Python</span>
    <a class="Link--muted">12,345</a>
    <a class="Link--muted">678</a>
    <span class="d-inline-block float-sm-right">1,234 stars today</span>
  </article>
  <article class="Box-row">
    <h2><a href="/rust-lang/rust">rust-lang/rust</a></h2>
    <p>The Rust programming language</p>
    <span itemprop="programmingLanguage">Rust</span>
    <a class="Link--muted">90.5k</a>
    <a class="Link--muted">12.4k</a>
    <span class="d-inline-block float-sm-right">200 stars today</span>
  </article>
</body></html>
`

describe('getGithubTrending', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('parses two articles with stats', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(HTML))
		)
		const repos = await getGithubTrending({ language: 'python', since: 'daily' })
		expect(repos).toHaveLength(2)
		expect(repos[0].fullName).toBe('openai/whisper')
		expect(repos[0].stars).toBe(12345)
		expect(repos[0].starsAdded).toBe(1234)
		expect(repos[1].stars).toBe(90500)
	})

	it('rejects invalid since', async () => {
		await expect(getGithubTrending({ since: 'yearly' })).rejects.toBeInstanceOf(InvalidInputError)
	})
})
