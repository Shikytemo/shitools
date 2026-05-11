export const defaultHeaders = {
	'user-agent': process.env.USER_AGENT || 'Shitools/1.0'
}

export const fetchText = async (url, options = {}) => {
	const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 30000)
	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), options.timeoutMs || timeoutMs)

	try {
		const response = await fetch(url, {
			...options,
			headers: {
				...defaultHeaders,
				...options.headers
			},
			signal: options.signal || controller.signal
		})

		if (!response.ok) {
			throw new Error(`Request failed ${response.status} ${response.statusText}`)
		}

		return await response.text()
	} finally {
		clearTimeout(timer)
	}
}

export const toJsonResult = data => JSON.stringify(data, null, 2)

export * from './aiimage.js'

export * from './anime.js'
export * from './anoboy.js'
export * from './bmkg.js'
export * from './cache.js'
export * from './catbox.js'
export * from './converter.js'
export * from './currency.js'
export * from './errors.js'
export * from './fact.js'
export * from './githubtrending.js'
export * from './http.js'
export * from './indo.js'
export * from './iplookup.js'
export * from './joke.js'
export * from './kateglo.js'
export * from './lyrics.js'
export * from './mediafire.js'
export * from './meme.js'
export * from './news.js'
export * from './otakudesu.js'
export * from './pinterest.js'
export * from './pypi.js'
export * from './quote.js'
export * from './quran.js'
export * from './reddit.js'
export * from './registry.js'
export * from './samehadaku.js'
export * from './screenshot.js'
export * from './sholat.js'
export * from './source-profiles.js'
export * from './spotify.js'
export * from './sources.js'
export * from './tiktok.js'
export * from './translate.js'
export * from './utility.js'
export * from './wallhaven.js'
export * from './weather.js'
export * from './web.js'
export * from './wikipedia.js'
export * from './youtubesearch.js'