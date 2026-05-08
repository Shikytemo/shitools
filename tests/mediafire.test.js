import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError, ParseError } from '../src/errors.js'
import { getMediafire } from '../src/mediafire.js'

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
  <a id="downloadButton" href="https://download.mediafire.com/abc/file.zip">Download (12.34MB)</a>
</body></html>
`

describe('getMediafire', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('extracts direct download link', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(HTML))
		)
		const file = await getMediafire('https://www.mediafire.com/file/abc/file.zip')
		expect(file.url).toContain('download.mediafire.com')
		expect(file.filename).toBe('file.zip')
		expect(file.mime).toBe('zip')
		expect(file.size).toBe('12.34MB')
	})

	it('rejects non-mediafire URL', async () => {
		await expect(getMediafire('https://example.com/x')).rejects.toBeInstanceOf(InvalidInputError)
	})

	it('throws ParseError when no download link present', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse('<html></html>'))
		)
		await expect(
			getMediafire('https://www.mediafire.com/file/abc/file.zip')
		).rejects.toBeInstanceOf(ParseError)
	})
})
