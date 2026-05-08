import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ParseError, RateLimitError, ScrapeError } from '../src/errors.js'
import { getTiktok, getTiktokUser, isTiktokUrl, searchTiktok, tiktok } from '../src/tiktok.js'

const mockResponse = (body, init = {}) => ({
	ok: init.ok ?? true,
	status: init.status ?? 200,
	statusText: init.statusText ?? 'OK',
	url: init.url ?? 'https://tikwm.com/api/',
	headers: new Headers(init.headers ?? {}),
	text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
})

const VIDEO_FIXTURE = {
	code: 0,
	msg: 'success',
	data: {
		id: '7137423965982858498',
		title: 'kucing lucu',
		play: 'https://tikwm.com/play/7137423965982858498.mp4',
		wmplay: 'https://tikwm.com/wm/7137423965982858498.mp4',
		hdplay: 'https://tikwm.com/hd/7137423965982858498.mp4',
		cover: 'https://tikwm.com/cover/abc.jpg',
		origin_cover: 'https://tikwm.com/cover/abc-orig.jpg',
		duration: 14,
		region: 'ID',
		create_time: 1_700_000_000,
		play_count: 12345,
		digg_count: 678,
		comment_count: 9,
		share_count: 1,
		collect_count: 2,
		music: 'https://tikwm.com/music/abc.mp3',
		music_info: {
			id: 'm-1',
			title: 'lagu kucing',
			author: 'DJ Cat',
			play: 'https://tikwm.com/music/abc.mp3'
		},
		author: {
			id: 'a-1',
			unique_id: 'kucing.id',
			nickname: 'Kucing Lucu',
			avatar: 'https://tikwm.com/avatar/a-1.jpg'
		}
	}
}

const SEARCH_FIXTURE = {
	code: 0,
	data: {
		videos: [VIDEO_FIXTURE.data],
		cursor: '10',
		has_more: true
	}
}

const USER_FIXTURE = {
	code: 0,
	data: {
		user: {
			id: 'u-1',
			uniqueId: 'kucing.id',
			nickname: 'Kucing Lucu',
			avatarLarger: 'https://tikwm.com/avatar/u-1-large.jpg',
			signature: 'meong meong',
			verified: true,
			privateAccount: false,
			region: 'ID'
		},
		stats: {
			followerCount: 50_000,
			followingCount: 10,
			heartCount: 1_000_000,
			videoCount: 42
		}
	}
}

describe('isTiktokUrl', () => {
	it.each([
		['https://www.tiktok.com/@khaby.lame/video/7137423965982858498', true],
		['https://vm.tiktok.com/ZSNFRtUJj/', true],
		['https://vt.tiktok.com/ZSNFR123/', true],
		['https://m.tiktok.com/v/7137423965982858498', true],
		['https://tiktok.com/t/ZSnotreal/', true],
		['kucing lucu', false],
		['https://www.youtube.com/watch?v=abc', false],
		['', false]
	])('%s -> %s', (input, expected) => {
		expect(isTiktokUrl(input)).toBe(expected)
	})
})

describe('getTiktok', () => {
	beforeEach(() => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(VIDEO_FIXTURE))
		)
	})
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('resolves a TikTok URL to a normalized video object', async () => {
		const video = await getTiktok('https://www.tiktok.com/@khaby.lame/video/7137423965982858498')
		expect(video.id).toBe('7137423965982858498')
		expect(video.url).toBe('https://tikwm.com/play/7137423965982858498.mp4')
		expect(video.noWatermarkUrl).toBe('https://tikwm.com/play/7137423965982858498.mp4')
		expect(video.watermarkUrl).toBe('https://tikwm.com/wm/7137423965982858498.mp4')
		expect(video.hdUrl).toBe('https://tikwm.com/hd/7137423965982858498.mp4')
		expect(video.duration).toBe(14)
		expect(video.author).toMatchObject({ username: 'kucing.id', name: 'Kucing Lucu' })
		expect(video.music).toMatchObject({ title: 'lagu kucing' })
		expect(video.stats).toMatchObject({ plays: 12345, likes: 678 })
		expect(video.createdAt).toBe(1_700_000_000_000)
		expect(video.permalink).toBe('https://www.tiktok.com/@kucing.id/video/7137423965982858498')
	})

	it('hits TikWM /api with the encoded url + hd=1', async () => {
		await getTiktok('https://vm.tiktok.com/ZSNFRtUJj/')
		const calledUrl = global.fetch.mock.calls[0][0]
		expect(calledUrl).toContain('tikwm.com/api/?url=')
		expect(calledUrl).toContain(encodeURIComponent('https://vm.tiktok.com/ZSNFRtUJj/'))
		expect(calledUrl).toContain('hd=1')
	})

	it('throws InvalidInputError on empty input', async () => {
		await expect(getTiktok('')).rejects.toThrow('TikTok URL is required')
	})

	it('maps non-zero code to ScrapeError', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse({ code: -1, msg: 'video not found' }))
		)
		await expect(getTiktok('https://vm.tiktok.com/ZSNFRtUJj/')).rejects.toBeInstanceOf(ScrapeError)
	})

	it('maps "frequency limit" message to RateLimitError', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse({ code: -1, msg: 'frequency limit' }))
		)
		await expect(
			getTiktok('https://vm.tiktok.com/ZSNFRtUJj/', { retries: 0 })
		).rejects.toBeInstanceOf(RateLimitError)
	})

	it('throws ParseError on non-JSON response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse('<html>cloudflare</html>'))
		)
		await expect(getTiktok('https://vm.tiktok.com/ZSNFRtUJj/')).rejects.toBeInstanceOf(ParseError)
	})
})

describe('searchTiktok', () => {
	beforeEach(() => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(SEARCH_FIXTURE))
		)
	})
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('returns normalized videos + cursor + hasMore', async () => {
		const result = await searchTiktok('kucing lucu', { limit: 5, cursor: 0 })
		expect(result.videos).toHaveLength(1)
		expect(result.videos[0].id).toBe('7137423965982858498')
		expect(result.hasMore).toBe(true)
		expect(result.cursor).toBe('10')
	})

	it('hits feed/search with keywords + count + cursor', async () => {
		await searchTiktok('axolotl', { limit: 3, cursor: 7 })
		const calledUrl = global.fetch.mock.calls[0][0]
		expect(calledUrl).toContain('tikwm.com/api/feed/search?')
		expect(calledUrl).toContain('keywords=axolotl')
		expect(calledUrl).toContain('count=3')
		expect(calledUrl).toContain('cursor=7')
	})

	it('throws InvalidInputError on empty keyword', async () => {
		await expect(searchTiktok('  ')).rejects.toThrow('TikTok keyword is required')
	})

	it('returns empty videos[] gracefully when upstream omits the array', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse({ code: 0, data: { cursor: '0', hasMore: false } }))
		)
		const result = await searchTiktok('nothing')
		expect(result.videos).toEqual([])
		expect(result.hasMore).toBe(false)
	})
})

describe('getTiktokUser', () => {
	beforeEach(() => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(USER_FIXTURE))
		)
	})
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('strips leading @ and normalizes user shape', async () => {
		const user = await getTiktokUser('@kucing.id')
		expect(user.username).toBe('kucing.id')
		expect(user.name).toBe('Kucing Lucu')
		expect(user.verified).toBe(true)
		expect(user.stats).toEqual({
			followers: 50_000,
			following: 10,
			likes: 1_000_000,
			videos: 42
		})
	})

	it('hits user/info?unique_id=...', async () => {
		await getTiktokUser('without.at')
		const calledUrl = global.fetch.mock.calls[0][0]
		expect(calledUrl).toContain('tikwm.com/api/user/info?unique_id=without.at')
	})

	it('throws InvalidInputError on empty username', async () => {
		await expect(getTiktokUser('')).rejects.toThrow('TikTok username is required')
	})
})

describe('tiktok dispatch', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('dispatches to getTiktok when input is a TikTok URL', async () => {
		const fetchMock = vi.fn(async () => mockResponse(VIDEO_FIXTURE))
		vi.stubGlobal('fetch', fetchMock)
		const result = await tiktok('https://vm.tiktok.com/ZSNFRtUJj/')
		expect(result.id).toBe('7137423965982858498')
		expect(fetchMock.mock.calls[0][0]).toContain('tikwm.com/api/?url=')
	})

	it('dispatches to searchTiktok when input is a keyword', async () => {
		const fetchMock = vi.fn(async () => mockResponse(SEARCH_FIXTURE))
		vi.stubGlobal('fetch', fetchMock)
		const result = await tiktok('kucing lucu', { limit: 5 })
		expect(result.videos).toHaveLength(1)
		expect(fetchMock.mock.calls[0][0]).toContain('feed/search')
		expect(fetchMock.mock.calls[0][0]).toContain('count=5')
	})
})
