import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError } from '../src/errors.js'
import { getSubreddit } from '../src/reddit.js'

const mockResponse = body => ({
	ok: true,
	status: 200,
	statusText: 'OK',
	url: 'https://example.com/',
	headers: new Headers(),
	text: async () => JSON.stringify(body)
})

const FIXTURE = {
	data: {
		children: [
			{
				data: {
					id: 'abc',
					title: 'Top post',
					author: 'someone',
					subreddit: 'ProgrammerHumor',
					permalink: '/r/ProgrammerHumor/comments/abc',
					url_overridden_by_dest: 'https://i.redd.it/abc.jpg',
					thumbnail: 'https://b.thumbs.redditmedia.com/abc.jpg',
					score: 1000,
					num_comments: 50,
					over_18: false,
					spoiler: false,
					link_flair_text: 'Meta',
					created_utc: 1715000000,
					selftext: '',
					is_video: false
				}
			}
		]
	}
}

describe('getSubreddit', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns mapped posts', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(FIXTURE))
		)
		const posts = await getSubreddit('ProgrammerHumor', { sort: 'top', limit: 5, t: 'day' })
		expect(posts).toHaveLength(1)
		expect(posts[0].id).toBe('abc')
		expect(posts[0].permalink).toContain('reddit.com')
		expect(posts[0].score).toBe(1000)
	})

	it('rejects empty subreddit', async () => {
		await expect(getSubreddit('')).rejects.toBeInstanceOf(InvalidInputError)
	})

	it('rejects bad sort/t', async () => {
		await expect(getSubreddit('memes', { sort: 'fakesort' })).rejects.toBeInstanceOf(
			InvalidInputError
		)
		await expect(getSubreddit('memes', { t: 'forever' })).rejects.toBeInstanceOf(InvalidInputError)
	})
})
