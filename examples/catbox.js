#!/usr/bin/env node

import {
	addToAlbum,
	createAlbum,
	deleteAlbum,
	deleteFiles,
	editAlbum,
	removeFromAlbum,
	uploadFile,
	uploadUrl
} from '../src/catbox.js'
import { toJsonResult } from '../src/index.js'

const usage = () => {
	console.log(`Usage:
  node examples/catbox.js upload-file <path>
  node examples/catbox.js upload-url <url>
  node examples/catbox.js delete-files <filename...>
  node examples/catbox.js create-album <title> <filename...>
  node examples/catbox.js edit-album <album-short> <title> <filename...>
  node examples/catbox.js add-album <album-short> <filename...>
  node examples/catbox.js remove-album <album-short> <filename...>
  node examples/catbox.js delete-album <album-short>

Env:
  CATBOX_USER_HASH=optional_user_hash`)
}

const [command, ...args] = process.argv.slice(2)

if (!command) {
	usage()
	process.exit(0)
}

const run = async () => {
	switch (command) {
		case 'upload-file':
			if (!args[0]) throw new Error('upload-file requires <path>')
			return uploadFile(args[0])

		case 'upload-url':
			if (!args[0]) throw new Error('upload-url requires <url>')
			return uploadUrl(args[0])

		case 'delete-files':
			if (!args.length) throw new Error('delete-files requires <filename...>')
			return deleteFiles(args)

		case 'create-album':
			if (!args[0] || !args[1]) throw new Error('create-album requires <title> <filename...>')
			return createAlbum({
				title: args[0],
				files: args.slice(1)
			})

		case 'add-album':
			if (!args[0] || !args[1]) throw new Error('add-album requires <album-short> <filename...>')
			return addToAlbum(args[0], args.slice(1))

		case 'edit-album':
			if (!args[0] || !args[1])
				throw new Error('edit-album requires <album-short> <title> <filename...>')
			return editAlbum({
				short: args[0],
				title: args[1],
				files: args.slice(2)
			})

		case 'remove-album':
			if (!args[0] || !args[1]) throw new Error('remove-album requires <album-short> <filename...>')
			return removeFromAlbum(args[0], args.slice(1))

		case 'delete-album':
			if (!args[0]) throw new Error('delete-album requires <album-short>')
			return deleteAlbum(args[0])

		default:
			throw new Error(`Unknown command: ${command}`)
	}
}

try {
	const result = await run()
	console.log(toJsonResult(result))
} catch (error) {
	console.error(error.message)
	process.exit(1)
}
