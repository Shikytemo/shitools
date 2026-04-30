#!/usr/bin/env node

import { pinterest, toJsonResult } from '../src/index.js'

const usage = () => {
	console.log(`Usage:
  node examples/pinterest.js <pinterest-url-or-query>

Example:
  node examples/pinterest.js https://www.pinterest.com/pin/123456789/
  node examples/pinterest.js anime girl`)
}

const [url] = process.argv.slice(2)

if (!url) {
	usage()
	process.exit(0)
}

try {
	const result = await pinterest(url, { limit: 10 })
	console.log(toJsonResult(result))
} catch (error) {
	console.error(error.message)
	process.exit(1)
}
