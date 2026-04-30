import { fetchText } from './index.js'

const BASE_URL = 'https://v2.samehadaku.how'
const JINA_BASE_URL = 'https://r.jina.ai'

const jinaFetch = async url => {
	const text = await fetchText(`${JINA_BASE_URL}/${url}`)
	if (text.includes('Attention Required!') || text.includes('Forbidden') || text.includes('Cloudflare')) {
		throw new Error('Jina block or Cloudflare detected')
	}
	return text
}

const parseSearch = markdown => {
	const results = []
	const sections = markdown.split(/\[!\[Image \d+:/g).slice(1)

	for (const section of sections) {
		const titleMatch = section.match(/^(.*?)\]\((.*?)\) (.*?) ([\d\.]+)? ## \[(.*?)\]\((.*?)\)/s)
		if (titleMatch) {
			const item = {
				title: titleMatch[5].trim(),
				url: titleMatch[6].trim(),
				image: titleMatch[2].trim(),
				type: titleMatch[3].trim(),
				score: titleMatch[4] ? titleMatch[4].trim() : null,
				status: section.includes('Completed') ? 'Completed' : (section.includes('Ongoing') ? 'Ongoing' : 'Unknown')
			}
			const viewsMatch = section.match(/(\d+) Views/)
			if (viewsMatch) item.views = viewsMatch[1]
			
			const genreMatch = section.match(/\[(.*?)\]\(https:\/\/v2\.samehadaku\.how\/genre\/.*?\)/g)
			if (genreMatch) {
				item.genres = genreMatch.map(g => g.match(/\[(.*?)\]/)[1])
			}

			results.push(item)
		}
	}
	return results
}

const parseDetail = markdown => {
	const info = {}
	const synopsisMatch = markdown.match(/Synopsis\n\n(.*?)\n\n/s)
	if (synopsisMatch) info.synopsis = synopsisMatch[1].trim()

	const metadata = {}
	const metaMatches = markdown.matchAll(/\*\* (.*?) \*\* : (.*?)\n/g)
	for (const match of metaMatches) {
		metadata[match[1].toLowerCase().replace(/\s+/g, '')] = match[2].trim()
	}
	
	const episodes = []
	const episodeMatches = markdown.matchAll(/\*   \[(\d+)\]\((.*?)\) \[(.*?)\]\(.*?\)(\d+ .*? \d+)/g)
	for (const match of episodeMatches) {
		episodes.push({
			episode: match[1],
			url: match[2],
			title: match[3],
			date: match[4]
		})
	}

	return { ...info, metadata, episodes }
}

export const searchAnime = async (query) => {
	const markdown = await jinaFetch(`${BASE_URL}/?s=${encodeURIComponent(query)}`)
	return {
		query,
		results: parseSearch(markdown)
	}
}

export const getAnimeDetail = async (url) => {
	const markdown = await jinaFetch(url)
	return parseDetail(markdown)
}

export const getTopAnime = async () => {
	const markdown = await jinaFetch(`${BASE_URL}/daftar-anime-2/?order=popular`)
	return {
		results: parseSearch(markdown)
	}
}

export const getCurrentSeasonAnime = async () => {
	const markdown = await jinaFetch(`${BASE_URL}/jadwal-rilis/`)
	return {
		results: parseSearch(markdown)
	}
}

export const anime = searchAnime
