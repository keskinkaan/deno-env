# @kinbay/env

[![JSR](https://jsr.io/badges/@kinbay/env)](https://jsr.io/@kinbay/env)
[![JSR Score](https://jsr.io/badges/@kinbay/env/score)](https://jsr.io/@kinbay/env)
[![CI](https://github.com/keskinkaan/deno-env/actions/workflows/ci.yml/badge.svg)](https://github.com/keskinkaan/deno-env/actions/workflows/ci.yml)
[![GitHub](https://img.shields.io/github/license/keskinkaan/deno-env?color=blue)](https://github.com/keskinkaan/deno-env/blob/dev/LICENSE)

A type-safe environment variable loader for Deno with schema validation.

## Features

- 🦕 Load environment variables from multiple `.env` files
- 🔒 Type-safe configuration with TypeScript
- ✅ Schema validation with custom validators
- 📝 Support for string, number, and boolean types
- 🎯 Default values and required fields
- 🚨 Strict mode for enhanced validation
- 💪 Full TypeScript support with type inference

## Installation

```sh
deno add jsr:@kinbay/env
```

Add to your `deno.json`:

```json
{
	"imports": {
		"@env": "jsr:@kinbay/env"
	}
}
```

## Usage

### Basic Usage

```typescript
import { createEnv } from '@env';

const config = await createEnv({
	PORT: {
		type: 'number',
		default: 3000,
	},
	API_KEY: {
		type: 'string',
		required: true,
	},
	DEBUG: {
		type: 'boolean',
		default: false,
	},
}).load();

console.log(config.PORT); // number
console.log(config.API_KEY); // string
console.log(config.DEBUG); // boolean
```

### Multiple .env Files

```typescript
const config = await createEnv({
	// ... schema
}).load({
	path: ['.env', '.env.local', '.env.development'],
	strict: true,
});
```

### Custom Validation

```typescript
const config = await createEnv({
	PORT: {
		type: 'number',
		validate: (value) => (value < 1000 ? 'Port must be >= 1000' : undefined),
	},
	API_URL: {
		type: 'string',
		validate: (value) =>
			!value.startsWith('https://') ? 'Must be HTTPS URL' : undefined,
	},
}).load();
```

### Strict Mode

```typescript
const config = await createEnv({
	// ... schema
}).load({
	strict: true, // Throws on validation errors
});
```

### Type Safety

```typescript
const config = await createEnv({
	PORT: { type: 'number' },
	DEBUG: { type: 'boolean' },
}).load();

const port = config.PORT; // TypeScript knows this is a number
const debug = config.DEBUG; // TypeScript knows this is a boolean
const invalid = config.INVALID; // TypeScript error!
```

### Singleton Configuration

The configuration is cached after the first load, so you can safely import and use it across multiple files:

Benefits of Singleton Pattern:

- ♻️ Environment variables are loaded only once
- 🚀 Same configuration instance across all imports
- 📦 Memory efficient - no duplicate configs
- ⚡ No unnecessary file reads or parsing
- 🔒 Thread-safe configuration access

```typescript
// env.ts
import { createEnv } from '@env';

export const config = await createEnv({
	PG_HOST: { type: 'string', required: true },
	PG_PORT: { type: 'number', default: 5432 },
	API_KEY: { type: 'string', required: true },
}).load({
	path: '.env',
	strict: true,
});

// connectPostgres.ts
import { config } from './env.ts';

async function connectToPostgres() {
	const { PG_HOST, PG_PORT } = config;
	// ...connection logic
}

// api.ts
import { config } from './env.ts';
console.log(config.API_KEY); // your API key
```

## API Reference

### Schema Definition

```typescript
type TSchemaDefinition = {
	type: 'string' | 'number' | 'boolean';
	required?: boolean;
	default?: string | number | boolean;
	validate?: (value: any) => string | undefined;
};
```

### Load Options

```typescript
type TLoadOptions = {
	path?: string | string[]; // Path to .env file(s)
	strict?: boolean; // Enable strict mode
};
```

## Error Handling

```typescript
try {
	const config = await createEnv({
		API_KEY: { type: 'string', required: true },
	}).load({
		strict: true,
	});
} catch (error) {
	// Handle validation errors
	console.error(error.message);
}
```

## Contributing

This project welcomes contributions and suggestions. Here's how you can help:

### Development

1. Fork the repository

2. Create your feature branch:

```sh
git checkout -b feature/amazing-feature
```

3. Run tests to ensure everything works:

```sh
deno task test
```

4. Set up pre-commit hook for code formatting:

```sh
# Copy pre-commit hook
cp hooks/pre-commit .git/hooks/
chmod +x .git/hooks/pre-commit
```

5. Make your changes and ensure:

   - Code follows the existing style
   - Tests pass (`deno task test`)
   - Types are correct (`deno task check`)
   - Code is formatted (`deno task prettify`)

6. Commit your changes:

```sh
git commit -m 'feat: add some amazing feature'
```

7. Push to the branch:

```sh
git push origin feature/amazing-feature
```

8. Open a Pull Request

### Bug Reports

Found a bug? Please open an issue with:

- Clear description of the bug
- Steps to reproduce with code example
- Expected vs actual behavior
- Environment details (Deno version, OS, package version)

## License

MIT © [Kaan Keskin](LICENSE)
