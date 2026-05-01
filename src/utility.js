import { execFile } from 'node:child_process'
import { constants } from 'node:fs'
import { access } from 'node:fs/promises'
import { delimiter, join } from 'node:path'

const defaultUserAgent = 'shitools/1.2'

export const isHttpUrl = value => {
	try {
		const url = new URL(String(value || '').trim())
		return ['http:', 'https:'].includes(url.protocol)
	} catch {
		return false
	}
}

export const normalizeHttpUrl = value => {
	const input = String(value || '').trim()
	if (!input) return ''

	const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`
	try {
		const url = new URL(withProtocol)
		return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''
	} catch {
		return ''
	}
}

export const createQrImageUrl = (text, options = {}) => {
	const size = options.size || '600x600'
	return `https://api.qrserver.com/v1/create-qr-code/?size=${encodeURIComponent(size)}&data=${encodeURIComponent(String(text || ''))}`
}

export const shortenUrl = async (input, options = {}) => {
	const url = String(input || '').trim()
	if (!isHttpUrl(url)) {
		return {
			ok: false,
			text: 'URL is invalid'
		}
	}

	const endpoint = options.endpoint || 'https://tinyurl.com/api-create.php'
	const response = await fetch(`${endpoint}?url=${encodeURIComponent(url)}`, {
		...(options.fetchOptions || {}),
		headers: {
			'user-agent': defaultUserAgent,
			...(options.fetchOptions?.headers || {})
		}
	})
	if (!response.ok) {
		return {
			ok: false,
			text: `Shortlink failed ${response.status}`
		}
	}

	return {
		ok: true,
		url,
		shortUrl: (await response.text()).trim()
	}
}

export const readQrBuffer = async (buffer, options = {}) => {
	if (!buffer) {
		return {
			ok: false,
			text: 'QR image buffer is required'
		}
	}

	const form = new FormData()
	form.append(
		'file',
		new Blob([buffer], { type: options.mimetype || 'image/png' }),
		options.fileName || 'qr.png'
	)

	const response = await fetch(options.endpoint || 'https://api.qrserver.com/v1/read-qr-code/', {
		method: 'POST',
		body: form,
		...options.fetchOptions
	})
	if (!response.ok) {
		return {
			ok: false,
			text: `Read QR failed ${response.status}`
		}
	}

	const data = await response.json()
	const text = data?.[0]?.symbol?.[0]?.data || ''
	return text
		? { ok: true, text }
		: { ok: false, text: 'QR not readable' }
}

const downloadAliases = {
	tiktok: 'TikTok',
	tt: 'TikTok',
	instagram: 'Instagram',
	ig: 'Instagram',
	youtube: 'YouTube',
	yt: 'YouTube',
	ytmp4: 'YouTube'
}

const allowedDownloaderHosts = {
	tiktok: ['tiktok.com', 'vt.tiktok.com', 'vm.tiktok.com'],
	instagram: ['instagram.com'],
	youtube: ['youtube.com', 'youtu.be', 'music.youtube.com', 'm.youtube.com']
}

const execFileAsync = (file, args, options = {}) =>
	new Promise((resolve, reject) => {
		execFile(file, args, options, (error, stdout, stderr) => {
			if (error) {
				reject(new Error(stderr.trim() || error.message))
				return
			}

			resolve(stdout)
		})
	})

const hasCommand = async command => {
	const paths = String(process.env.PATH || '').split(delimiter).filter(Boolean)

	for (const dir of paths) {
		try {
			await access(join(dir, command), constants.X_OK)
			return true
		} catch {
			// Keep looking through PATH.
		}
	}

	return false
}

const getHost = url => {
	try {
		return new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
	} catch {
		return ''
	}
}

const platformFromCommand = commandName => {
	if (['tt', 'tiktok'].includes(commandName)) return 'tiktok'
	if (['ig', 'instagram'].includes(commandName)) return 'instagram'
	return 'youtube'
}

const isAllowedPlatformUrl = (platform, url) => {
	const allowedHosts = allowedDownloaderHosts[platform] || []
	const host = getHost(url)
	return allowedHosts.some(allowed => host === allowed || host.endsWith(`.${allowed}`))
}

const resolveWithYtDlp = async (url, options = {}) => {
	const command = options.command || 'yt-dlp'
	if (!(await hasCommand(command))) return null

	const stdout = await execFileAsync(
		command,
		[
			'--no-playlist',
			'--dump-single-json',
			'--no-warnings',
			'--no-call-home',
			'--format',
			options.format || 'b[ext=mp4]/b',
			url
		],
		{
			timeout: options.timeout || 30000,
			maxBuffer: options.maxBuffer || 1024 * 1024 * 8
		}
	)

	const info = JSON.parse(stdout)
	const requested = Array.isArray(info.requested_downloads) ? info.requested_downloads[0] : null
	const mediaUrl = requested?.url || info.url

	if (!isHttpUrl(mediaUrl)) return null

	return {
		title: info.title || 'Media',
		sourceUrl: info.webpage_url || url,
		mediaUrl,
		ext: requested?.ext || info.ext || '',
		duration: info.duration || 0
	}
}

export const resolveSocialDownloader = async ({ commandName = 'youtube', input, ...options }) => {
	const url = normalizeHttpUrl(input)
	const platform = platformFromCommand(String(commandName).toLowerCase())
	const label = downloadAliases[commandName] || downloadAliases[platform] || 'Downloader'

	if (!url) {
		return {
			ok: false,
			text: 'URL is invalid'
		}
	}

	if (!isAllowedPlatformUrl(platform, url)) {
		return {
			ok: false,
			text: `URL is not supported for ${label}`
		}
	}

	try {
		const resolved = await resolveWithYtDlp(url, options)
		if (resolved) {
			return {
				ok: true,
				mode: 'direct',
				platform: label,
				...resolved
			}
		}
	} catch (error) {
		return {
			ok: true,
			mode: 'source',
			platform: label,
			sourceUrl: url,
			error: error.message || String(error)
		}
	}

	return {
		ok: true,
		mode: 'source',
		platform: label,
		sourceUrl: url
	}
}

export const socialDownloadInfo = input => {
	const url = String(input || '').trim()
	if (!isHttpUrl(url)) {
		return {
			ok: false,
			text: 'URL is invalid'
		}
	}

	return {
		ok: true,
		url,
		text: 'Direct downloader is not bundled. Use the returned URL with an external downloader service.'
	}
}
