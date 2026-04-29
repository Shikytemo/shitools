import { fetchText } from '../src/index.js'

const url = process.argv[2] || 'https://example.com'
const html = await fetchText(url)

console.log(html.slice(0, 500))
