import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError, ParseError } from '../src/errors.js'
import { randomMeme } from '../src/meme.js'

const mockResponse = body => ({
	ok: true,
	status: 200,
	statusText: 'OK',
	url: 'https://example.com/',
	headers: new Headers(),
	text: async () => JSON.stringify(body)
})

describe('randomMeme', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns mapped meme', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				mockResponse({
					title: 'Funny',
					url: 'https://i.redd.it/abc.jpg',
					subreddit: 'memes',
					author: 'someone',
					postLink: 'https://reddit.com/r/memes/abc',
					nsfw: false
				})
			)
		)
		const m = await randomMeme()
		expect(m.url).toContain('redd.it')
		expect(m.subreddit).toBe('memes')
		expect(m.source).toBe('meme-api.com')
	})

	it('rejects bad subreddit names', async () => {
		await expect(randomMeme({ subreddit: '!!bad!!' })).rejects.toBeInstanceOf(InvalidInputError)
	})

	it('throws on api error code', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse({ code: 404, message: 'no such sub' }))
		)
		await expect(randomMeme({ subreddit: 'someSubThatDoesNotExist' })).rejects.toBeInstanceOf(
			ParseError
		)
	})
})
