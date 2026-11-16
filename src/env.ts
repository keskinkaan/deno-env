import type { TSchema, TypeMap } from './types/mod.ts';

/**
 * Environment configuration manager with schema validation
 * @class
 * @description Manages environment variables with type-safe validation and caching
 */
class Env {
	static #instance: Env;
	#config: Record<string, unknown> = {};
	#loadedConfig: Record<string, unknown> | null = null;
	#env: Record<string, string> = {};

	/**
	 * Gets singleton instance of Env class
	 * @returns {Env} The singleton instance
	 */
	static getInstance(): Env {
		if (!Env.#instance) {
			Env.#instance = new Env();
		}
		return Env.#instance;
	}

	/**
	 * Parses the contents of a .env file
	 * @private
	 * @param {string} content - Raw file content
	 * @returns {Record<string, string>} Parsed key/value pairs
	 * @description Quoted values keep their inner spaces and `#` characters.
	 * For unquoted values, everything after ` #` is treated as a comment.
	 */
	static #parseEnvFile(content: string): Record<string, string> {
		const result: Record<string, string> = {};

		for (const rawLine of content.split(/\r?\n/)) {
			const line = rawLine.trim();
			if (!line || line.startsWith('#')) continue;

			// Divide by the first = sign
			const separatorIndex = line.indexOf('=');
			if (separatorIndex < 1) continue;

			const key = line.slice(0, separatorIndex).trim();
			const rawValue = line.slice(separatorIndex + 1).trim();
			const quote = rawValue[0];

			// Quoted value: take everything up to the matching closing quote
			if (quote === '"' || quote === "'") {
				const closingIndex = rawValue.indexOf(quote, 1);
				if (closingIndex !== -1) {
					result[key] = rawValue.slice(1, closingIndex);
					continue;
				}
			}

			// Unquoted value: strip an inline comment
			const commentMatch = rawValue.match(/(^|\s)#/);
			result[key] = commentMatch
				? rawValue.slice(0, commentMatch.index).trim()
				: rawValue;
		}

		return result;
	}

	/**
	 * Reads a system environment variable without prompting for permission
	 * @private
	 * @param {string} key - Variable name
	 * @returns {string|undefined} The value, or undefined when unset or not permitted
	 */
	static #readSystemEnv(key: string): string | undefined {
		try {
			const { state } = Deno.permissions.querySync({
				name: 'env',
				variable: key,
			});
			if (state !== 'granted') return undefined;
			return Deno.env.get(key);
		} catch {
			return undefined;
		}
	}

	/**
	 * Validates environment variables against provided schema
	 * @private
	 * @param {TSchema} schema - Schema to validate against
	 * @returns {Object} Parsed values and validation errors
	 */
	#validateSchema(schema: TSchema) {
		const errors: string[] = [];
		const parsed: Record<string, unknown> = {};

		for (const [key, definition] of Object.entries(schema)) {
			const value = this.#env[key];

			if (definition.required && !value) {
				errors.push(`Missing required environment variable: ${key}`);
				continue;
			}

			if (!value && definition.default !== undefined) {
				parsed[key] = definition.default;
				continue;
			}

			if (value) {
				try {
					let parsedValue: unknown;

					switch (definition.type) {
						case 'number': {
							parsedValue = Number(value);
							if (isNaN(parsedValue as number)) throw new Error();
							break;
						}
						case 'boolean': {
							const lowerValue = value.toLowerCase();
							if (lowerValue !== 'true' && lowerValue !== 'false') {
								throw new Error();
							}
							parsedValue = lowerValue === 'true';
							break;
						}
						default: {
							parsedValue = value;
						}
					}

					parsed[key] = parsedValue;

					// Type-safe validation
					if (definition.validate) {
						const validationError = (
							definition.validate as (value: unknown) => string | undefined
						)(parsedValue);
						if (validationError) {
							errors.push(validationError);
						}
					}
				} catch {
					errors.push(`Invalid type for ${key}: expected ${definition.type}`);
					continue;
				}
			}
		}

		return { parsed, errors };
	}

	/**
	 * Loads and validates environment variables from file(s)
	 * @private
	 * @param {Object} options - Load configuration options
	 * @param {string|string[]} [options.path] - Path to .env file(s)
	 * @param {TSchema} options.schema - Schema to validate against
	 * @param {boolean} [options.strict] - Whether to throw on validation errors
	 * @returns {Promise<Record<string, unknown>>} Parsed configuration
	 * @throws {Error} When validation fails in strict mode
	 */
	async #load(options: {
		path?: string | string[];
		schema: TSchema;
		strict?: boolean;
	}) {
		try {
			// Clear cache in case of error
			this.#loadedConfig = null;
			this.#env = {};
			this.#config = {};

			const paths = Array.isArray(options.path)
				? options.path
				: [options.path || '.env'];

			let foundAnyFile = false;

			// Read files (defaults to .env when no path is provided)
			for (const path of paths) {
				try {
					const envFile = await Deno.readTextFile(path);
					foundAnyFile = true;
					Object.assign(this.#env, Env.#parseEnvFile(envFile));
				} catch (error) {
					if (error instanceof Deno.errors.NotFound) {
						continue;
					}
					throw error;
				}
			}

			// Throw error if path is provided but no file is found in strict mode
			if (options.path && !foundAnyFile && options.strict) {
				throw new Error('No environment file found');
			}

			// System environment variables take precedence over file values
			for (const key of Object.keys(options.schema)) {
				const value = Env.#readSystemEnv(key);
				if (value !== undefined) {
					this.#env[key] = value;
				}
			}

			const { parsed, errors } = this.#validateSchema(options.schema);

			// Error checking, regardless of strict mode
			if (errors.length > 0) {
				throw new Error(errors.join('\n'));
			}

			this.#config = parsed;
			return this.#config;
		} catch (error) {
			// Clear cache in case of error
			this.#loadedConfig = null;
			this.#env = {};
			this.#config = {};
			throw error;
		}
	}

	/**
	 * Clears cached environment configuration
	 * @static
	 * @description Clears the cached environment configuration
	 * @example
	 * ```ts
	 * clearEnv();
	 * ```
	 * @returns {void}
	 */
	public static clearEnv() {
		const env = Env.getInstance();
		env.#loadedConfig = null;
		env.#env = {};
		env.#config = {};
	}

	/**
	 * Creates a schema-based environment configuration loader
	 * @static
	 * @template T Schema type
	 * @param {T} schema - Environment variable schema
	 * @returns {Object} A loader object with a load method that returns a type-safe config object
	 * @returns {Function} loader.load - Async function to load and validate environment variables
	 * @example
	 * ```ts
	 * const config = await createEnv({
	 *   PORT: { type: 'number', required: true },
	 *   DEBUG: { type: 'boolean', default: false }
	 * }).load();
	 * ```
	 */
	public static schema = <T extends TSchema>(
		schema: T,
	): {
		load: (options?: {
			path?: string | string[];
			strict?: boolean;
		}) => Promise<
			{
				[K in keyof T]: T[K] extends { type: infer Type }
					? Type extends keyof TypeMap ? TypeMap[Type]
					: never
					: never;
			}
		>;
	} => {
		return {
			load: async (options?) => {
				const env = Env.getInstance();

				// If config is already loaded, revert it
				if (env.#loadedConfig) {
					return env.#loadedConfig as {
						[K in keyof T]: T[K] extends { type: infer Type }
							? Type extends keyof TypeMap ? TypeMap[Type]
							: never
							: never;
					};
				}

				const config = await env.#load({ schema, ...options });

				// Cache config
				env.#loadedConfig = new Proxy(config, {
					get(target: typeof config, prop: string) {
						if (prop === 'then') {
							return undefined;
						}

						if (!(prop in target)) {
							if (options?.strict) {
								throw new Error(`Configuration key "${prop}" not found`);
							}
							return undefined;
						}
						return target[prop];
					},
				});

				return env.#loadedConfig as {
					[K in keyof T]: T[K] extends { type: infer Type }
						? Type extends keyof TypeMap ? TypeMap[Type]
						: never
						: never;
				};
			},
		};
	};
}

/**
 * Creates an environment configuration with schema validation
 * @function
 * @description Factory function to create type-safe environment configuration
 * @example
 * ```ts
 * const config = await createEnv({
 *   PORT: { type: 'number', default: 3000 },
 *   API_KEY: { type: 'string', required: true },
 *   DEBUG: { type: 'boolean', default: false }
 * }).load();
 * ```
 */
export const createEnv = Env.schema;

/**
 * Clears cached environment configuration
 * @function
 * @description Clears the cached environment configuration
 * @example
 * ```ts
 * clearEnv();
 * ```
 */
export const clearEnv = Env.clearEnv;
