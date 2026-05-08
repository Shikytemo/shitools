#!/usr/bin/env node
import {
	fetchSource,
	getSource,
	latestSource,
	listSources,
	scrapeSource,
	searchSource,
	searchSources,
	toJsonResult
} from '../src/index.js'

const [mode, ...args] = process.argv.slice(2)
const print = data => console.log(toJsonResult(data))

if (!mode) {
	console.log('Usage:')
	console.log('  node examples/sources.js list')
	console.log('  node examples/sources.js list anime')
	console.log('  node examples/sources.js find weather')
	console.log('  node examples/sources.js get weather-open-meteo')
	console.log('  node examples/sources.js search samehadaku "one piece"')
	console.log('  node examples/sources.js scrape samehadaku "gnosia episode 20"')
	console.log('  node examples/sources.js latest samehadaku')
	console.log('  node examples/sources.js fetch animals-axolotl')
	process.exit(1)
}

switch (mode) {
	case 'list':
		print(listSources({ category: args[0], limit: Number(args[1]) || 0 }))
		break
	case 'find':
		print(searchSources(args.join(' ')))
		break
	case 'get':
		print(getSource(args[0]))
		break
	case 'search':
		print(await searchSource(args[0], args.slice(1).join(' ')))
		break
	case 'scrape':
		print(await scrapeSource(args[0], args.slice(1).join(' ')))
		break
	case 'latest':
		print(await latestSource(args[0]))
		break
	case 'fetch':
		print(await fetchSource(args[0]))
		break
	default:
		throw new Error(`Unknown mode: ${mode}`)
}
