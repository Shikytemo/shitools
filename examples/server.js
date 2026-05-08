#!/usr/bin/env node
/**
 * Minimal REST server example. Dependency-free (uses only node:http) so it
 * runs out-of-the-box on Termux / Fly.io / serverless without extra installs.
 *
 *   node examples/server.js          # listens on :3000
 *   PORT=8787 node examples/server.js
 *
 * Routes:
 *   GET /health
 *   GET /pinterest?q=<query|url>&limit=10
 *   GET /anime/search?q=<query>
 *   GET /anime/top
 *   GET /anime/current
 *   GET /samehadaku/search?q=<query>
 *   GET /samehadaku/scrape?q=<input>
 *   GET /samehadaku/latest
 *   GET /katanime/search?q=<query>
 *   GET /katanime/random
 *   GET /github/repo?q=<owner/repo>
 *   GET /github/search?q=<query>
 *   GET /npm/package?q=<name>
 *   GET /npm/search?q=<query>
 *   GET /web/meta?url=<url>
 *   GET /url/shorten?url=<url>
 *   GET /url/qr?text=<text>
 *   GET /sources/list
 *   GET /sources/find?q=<query>
 *   GET /sources/get?id=<source-id>
 *   GET /sources/fetch?id=<source-id>
 *   GET /source/:id/search?q=<query>
 *   GET /source/:id/scrape?q=<input>
 *   GET /source/:id/latest
 */

import { createServer } from 'node:http'
import { URL } from 'node:url'

import {
	createQrImageUrl,
	fetchSource,
	getAnimeDetail,
	getCurrentSeasonAnime,
	getGithubRepo,
	getLatestSamehadaku,
	getNpmPackage,
	getRandomKatanimeQuotes,
	getSamehadakuStream,
	getSource,
	getTiktok,
	getTiktokUser,
	getTopAnime,
	latestSource,
	listSources,
	pinterest,
	scrapeSource,
	scrapeWebsite,
	searchAnime,
	searchGithubRepos,
	searchKatanimeQuotes,
	searchNpmPackages,
	searchSamehadaku,
	searchSource,
	searchSources,
	searchTiktok,
	shortenUrl
} from '../src/index.js'

const PORT = Number(process.env.PORT) || 3000

const json = (res, status, payload) => {
	res.writeHead(status, {
		'content-type': 'application/json; charset=utf-8',
		'access-control-allow-origin': '*'
	})
	res.end(JSON.stringify(payload))
}

const requireQuery = (params, key) => {
	const value = params.get(key)
	if (!value) throw new Error(`Missing query param: ${key}`)
	return value
}

const buildRoutes = () => {
	const exact = {
		'GET /health': () => ({ ok: true, ts: Date.now() }),

		'GET /pinterest': q => pinterest(requireQuery(q, 'q'), { limit: Number(q.get('limit')) || 10 }),

		'GET /anime/search': q => searchAnime(requireQuery(q, 'q')),
		'GET /anime/detail': q => getAnimeDetail(requireQuery(q, 'url')),
		'GET /anime/top': () => getTopAnime(),
		'GET /anime/current': () => getCurrentSeasonAnime(),

		'GET /samehadaku/search': q => searchSamehadaku(requireQuery(q, 'q')),
		'GET /samehadaku/scrape': q => getSamehadakuStream(requireQuery(q, 'q')),
		'GET /samehadaku/latest': () => getLatestSamehadaku(),

		'GET /katanime/search': q => searchKatanimeQuotes(requireQuery(q, 'q')),
		'GET /katanime/random': () => getRandomKatanimeQuotes(),

		'GET /github/repo': q => getGithubRepo(requireQuery(q, 'q')),
		'GET /github/search': q => searchGithubRepos(requireQuery(q, 'q')),
		'GET /npm/package': q => getNpmPackage(requireQuery(q, 'q')),
		'GET /npm/search': q => searchNpmPackages(requireQuery(q, 'q')),

		'GET /tiktok': q => getTiktok(requireQuery(q, 'url')),
		'GET /tiktok/search': q =>
			searchTiktok(requireQuery(q, 'q'), { limit: Number(q.get('limit')) || 10 }),
		'GET /tiktok/user': q => getTiktokUser(requireQuery(q, 'username')),

		'GET /web/meta': q => scrapeWebsite(requireQuery(q, 'url')),
		'GET /url/shorten': q => shortenUrl(requireQuery(q, 'url')),
		'GET /url/qr': q => ({ url: createQrImageUrl(requireQuery(q, 'text')) }),

		'GET /sources/list': () => listSources({}),
		'GET /sources/find': q => searchSources(requireQuery(q, 'q')),
		'GET /sources/get': q => getSource(requireQuery(q, 'id')),
		'GET /sources/fetch': q => fetchSource(requireQuery(q, 'id'))
	}

	const lookup = (method, pathname) => {
		const exactKey = `${method} ${pathname}`
		if (exact[exactKey]) return { handler: exact[exactKey] }

		const sourceMatch = pathname.match(/^\/source\/([^/]+)\/(search|scrape|latest)$/)
		if (sourceMatch && method === 'GET') {
			const [, id, op] = sourceMatch
			if (op === 'search') return { handler: q => searchSource(id, requireQuery(q, 'q')) }
			if (op === 'scrape') return { handler: q => scrapeSource(id, requireQuery(q, 'q')) }
			if (op === 'latest') return { handler: () => latestSource(id) }
		}

		return null
	}

	return { lookup }
}

const { lookup } = buildRoutes()

export const handleRequest = async (req, res) => {
	const method = req.method ?? 'GET'
	const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)

	if (method === 'OPTIONS') {
		res.writeHead(204, {
			'access-control-allow-origin': '*',
			'access-control-allow-methods': 'GET, OPTIONS',
			'access-control-allow-headers': 'content-type'
		})
		res.end()
		return
	}

	const route = lookup(method, url.pathname)
	if (!route) {
		json(res, 404, { error: 'Not found', method, path: url.pathname })
		return
	}

	try {
		const data = await route.handler(url.searchParams)
		json(res, 200, data)
	} catch (error) {
		const status =
			error?.name === 'RateLimitError'
				? 429
				: typeof error?.status === 'number'
					? error.status
					: error?.message?.startsWith('Missing query param')
						? 400
						: 500
		json(res, status, {
			error: error?.message ?? String(error),
			name: error?.name ?? 'Error',
			source: error?.source
		})
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	createServer(handleRequest).listen(PORT, () => {
		console.log(`shitools REST server listening on :${PORT}`)
	})
}
