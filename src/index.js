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

export * from './catbox.js'
