#!/usr/bin/env node
import {
	getAnoboyStream,
	getGithubRepo,
	getLatestAnoboy,
	getLatestOtakudesu,
	getLatestSamehadaku,
	getNpmPackage,
	getOtakudesuStream,
	getSamehadakuLegacyStream,
	getSamehadakuStream,
	getSpotifyTrack,
	scrapeWebsite,
	searchAnime,
	searchGithubRepos,
	searchNpmPackages,
	searchSpotifyTracks,
	spotifyDl,
	toJsonResult
} from '../src/index.js'

const [mode, ...args] = process.argv.slice(2)
const input = args.join(' ')

const print = data => console.log(toJsonResult(data))

if (!mode || !input) {
	console.log('Usage:')
	console.log('  node examples/scrapers.js web https://example.com')
	console.log('  node examples/scrapers.js npm express')
	console.log('  node examples/scrapers.js npm-search whatsapp bot')
	console.log('  node examples/scrapers.js github Shikytemo/shitools')
	console.log('  node examples/scrapers.js github-search whatsapp bot scraper')
	console.log('  node examples/scrapers.js anime one piece')
	console.log('  node examples/scrapers.js samehadaku gnosia episode 20')
	console.log('  node examples/scrapers.js samehadaku-legacy one-piece-episode-1155')
	console.log('  node examples/scrapers.js samehadaku-latest latest')
	console.log('  node examples/scrapers.js otakudesu one piece episode 1')
	console.log('  node examples/scrapers.js otakudesu-latest latest')
	console.log('  node examples/scrapers.js anoboy one piece')
	console.log('  node examples/scrapers.js anoboy-latest latest')
	console.log('  node examples/scrapers.js spotify-search imagine dragons')
	console.log('  node examples/scrapers.js spotify-track 3n3Gp0U8wu3Y0YD1KmSPBZ')
	console.log('  node examples/scrapers.js spotify-dl https://open.spotify.com/track/3n3Gp0U8wu3Y0YD1KmSPBZ')
	process.exit(1)
}

switch (mode) {
	case 'web':
		print(await scrapeWebsite(input))
		break
	case 'npm':
		print(await getNpmPackage(input))
		break
	case 'npm-search':
		print(await searchNpmPackages(input))
		break
	case 'github':
		print(await getGithubRepo(input))
		break
	case 'github-search':
		print(await searchGithubRepos(input))
		break
	case 'anime':
		print(await searchAnime(input))
		break
	case 'samehadaku':
		print(await getSamehadakuStream(input))
		break
	case 'samehadaku-legacy':
		print(await getSamehadakuLegacyStream(input))
		break
	case 'samehadaku-latest':
		print(await getLatestSamehadaku())
		break
	case 'otakudesu':
		print(await getOtakudesuStream(input))
		break
	case 'otakudesu-latest':
		print(await getLatestOtakudesu())
		break
	case 'anoboy':
		print(await getAnoboyStream(input))
		break
	case 'anoboy-latest':
		print(await getLatestAnoboy())
		break
	case 'spotify-search':
		print(await searchSpotifyTracks(input))
		break
	case 'spotify-track':
		print(await getSpotifyTrack(input))
		break
	case 'spotify-dl':
		print(await spotifyDl(input))
		break
	default:
		throw new Error(`Unknown mode: ${mode}`)
}