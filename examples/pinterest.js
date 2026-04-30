#!/usr/bin/env node

import { scrapePinterest, toJsonResult } from '../src/index.js'

const usage = () => {
	console.log(`Usage:
  node examples/pinterest.js <pinterest-url>

Example:
  node examples/pinterest.js https://www.pinterest.com/pin/123456789/`)
}

const [url] = process.argv.slice(2)

if (!url) {
	usage()
	process.exit(0)
}

try {
	const result = await scrapePinterest(url)
	console.log(toJsonResult(result))
} catch (error) {
	console.error(error.message)
	process.exit(1)
}
