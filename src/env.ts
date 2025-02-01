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

			// If path is provided, read files
			if (options.path) {
				for (const path of paths) {
					try {
						const envFile = await Deno.readTextFile(path);
						foundAnyFile = true;

						const splitEnvFile = envFile.split('\n');
						for (const line of splitEnvFile) {
							if (!line || line.startsWith('#')) continue;

							// First divide by = sign
							const [key, ...valueParts] = line.split('=');
							if (!key) continue;

							// Merge the value part
							const fullValue = valueParts.join('=');

							// Get the part up to the first space (or the entire value if there is no space)
							const value = fullValue.split(' ')[0]?.trim() ?? '';

							this.#env[key.trim()] = value.replace(/(^['"]|['"]$)/g, '');
						}
					} catch (error) {
						if (error instanceof Deno.errors.NotFound) {
							continue;
						}
						throw error;
					}
				}

				// Throw error if path is provided but no file is found in strict mode
				if (!foundAnyFile && options.strict) {
					throw new Error('No environment file found');
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
