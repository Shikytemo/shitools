import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError, ParseError } from '../src/errors.js'
import { getIpInfo } from '../src/iplookup.js'

const mockResponse = body => ({
	ok: true,
	status: 200,
	statusText: 'OK',
	url: 'https://example.com/',
	headers: new Headers(),
	text: async () => JSON.stringify(body)
})

const FIXTURE = {
	ip: '8.8.8.8',
	type: 'IPv4',
	country: 'United States',
	country_code: 'US',
	region: 'California',
	city: 'Mountain View',
	postal: '94043',
	latitude: 37.4056,
	longitude: -122.0775,
	timezone: { id: 'America/Los_Angeles' },
	connection: { isp: 'Google LLC', org: 'Google LLC', asn: 15169 },
	flag: { emoji: '🇺🇸' }
}

describe('getIpInfo', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns mapped info', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(FIXTURE))
		)
		const info = await getIpInfo('8.8.8.8')
		expect(info.country).toBe('United States')
		expect(info.city).toBe('Mountain View')
		expect(info.isp).toContain('Google')
		expect(info.asn).toBe('15169')
		expect(info.mapUrl).toContain('google.com/maps')
	})

	it('rejects malformed ip', async () => {
		await expect(getIpInfo('not an ip!')).rejects.toBeInstanceOf(InvalidInputError)
	})

	it('throws when api signals failure', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse({ success: false, message: 'reserved' }))
		)
		await expect(getIpInfo('192.168.1.1')).rejects.toBeInstanceOf(ParseError)
	})
})
