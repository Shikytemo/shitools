import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError, ParseError } from '../src/errors.js'
import { tiktokStalk } from '../src/tiktokstalk.js'

const mockResponse = (body, init = {}) => ({
	ok: init.ok ?? true,
	status: init.status ?? 200,
	statusText: init.statusText ?? 'OK',
	url: init.url ?? 'https://example.com/',
	headers: new Headers(init.headers ?? {}),
	text: async () => JSON.stringify(body)
})

const FIXTURE = {
	code: 0,
	msg: 'success',
	data: {
		user: {
			id: '123',
			uniqueId: 'khaby.lame',
			nickname: 'Khaby Lame',
			avatarLarger: 'https://avatar.tiktok/lg.jpg',
			signature: 'no words',
			verified: true,
			privateAccount: false,
			region: 'IT'
		},
		stats: {
			followerCount: 162000000,
			followingCount: 80,
			heartCount: 2400000000,
			videoCount: 1100,
			friendCount: 50
		}
	}
}

describe('tiktokStalk', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns normalized profile from TikWM', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(FIXTURE))
		)
		const result = await tiktokStalk('khaby.lame')
		expect(result.uniqueId).toBe('khaby.lame')
		expect(result.followers).toBe(162000000)
		expect(result.likes).toBe(2400000000)
		expect(result.verified).toBe(true)
	})

	it('throws on TikWM error response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse({ code: -1, msg: 'not found' }))
		)
		await expect(tiktokStalk('nope')).rejects.toBeInstanceOf(ParseError)
	})

	it('throws on empty username', async () => {
		await expect(tiktokStalk('  ')).rejects.toBeInstanceOf(InvalidInputError)
	})
})
