import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError } from '../src/errors.js'
import { getWeather } from '../src/weather.js'

const mockResponse = body => ({
	ok: true,
	status: 200,
	statusText: 'OK',
	url: 'https://example.com/',
	headers: new Headers(),
	text: async () => JSON.stringify(body)
})

const WEATHER_FIXTURE = {
	current_condition: [
		{
			temp_C: '27',
			FeelsLikeC: '30',
			humidity: '80',
			windspeedKmph: '12',
			winddir16Point: 'NE',
			visibility: '10',
			observation_time: '10:00 AM',
			weatherDesc: [{ value: 'Partly cloudy' }]
		}
	],
	nearest_area: [{ areaName: [{ value: 'Jakarta' }], country: [{ value: 'Indonesia' }] }]
}

describe('getWeather', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns normalized weather', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(WEATHER_FIXTURE))
		)
		const w = await getWeather('Jakarta')
		expect(w.temperature).toBe('27°C')
		expect(w.feelsLike).toBe('30°C')
		expect(w.country).toBe('Indonesia')
		expect(w.condition).toBe('Partly cloudy')
		expect(w.source).toBe('wttr.in')
	})

	it('throws on empty location', async () => {
		await expect(getWeather('')).rejects.toBeInstanceOf(InvalidInputError)
	})
})
