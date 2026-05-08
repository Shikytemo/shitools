import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		environment: 'node',
		include: ['tests/**/*.test.js'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov'],
			include: ['src/errors.js', 'src/http.js', 'src/utility.js'],
			exclude: ['src/source-profiles.js']
		},
		testTimeout: 10_000
	}
})
