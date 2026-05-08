import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError } from '../src/errors.js'
import { spotifyDl } from '../src/spotifydl.js'

const mockResponse = (body, init = {}) => ({
	ok: init.ok ?? true,
	status: init.status ?? 200,
	statusText: init.statusText ?? 'OK',
	url: init.url ?? 'https://example.com/',
	headers: new Headers(init.headers ?? {}),
	text: async () => JSON.stringify(body)
})

describe('spotifyDl', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns metadata + download URL after 2-step lookup', async () => {
		let calls = 0
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				calls += 1
				if (calls === 1) {
					return mockResponse({
						result: {
							gid: 'gid1',
							id: 'id1',
							name: 'Bohemian Rhapsody',
							type: 'track',
							artists: 'Queen',
							duration_ms: 354000,
							image: 'https://img/queen.jpg'
						}
					})
				}
				return mockResponse({ result: { download_url: '/spotify/mp3/get/gid1' } })
			})
		)
		const result = await spotifyDl('https://open.spotify.com/track/2takcwOaAZWiXQijPHIx7B')
		expect(result.title).toBe('Bohemian Rhapsody')
		expect(result.artists).toBe('Queen')
		expect(result.download).toBe('https://api.fabdl.com/spotify/mp3/get/gid1')
	})

	it('rejects non-spotify URL', async () => {
		await expect(spotifyDl('https://example.com/song')).rejects.toBeInstanceOf(InvalidInputError)
	})
})
