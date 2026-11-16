import { assertEquals, assertRejects } from '@std/assert';
import { clearEnv, createEnv } from '../src/env.ts';
import { clearEnv as modClearEnv } from '../mod.ts';

const root = Deno.cwd();

Deno.test('ENV functionality tests', async (t) => {
	await t.step('should fail when env file does not exist', async () => {
		clearEnv();
		const error = (await assertRejects(() =>
			createEnv({
				APP_ENV: {
					type: 'string',
				},
			}).load({
				path: `${root}/tests/.env.undefined`,
				strict: true,
			})
		)) as Error;

		assertEquals(error.message, 'No environment file found');
	});

	await t.step('should throw error for missing required fields', async () => {
		clearEnv();
		const error = (await assertRejects(() =>
			createEnv({
				TEST_KEY: {
					type: 'string',
					required: true,
				},
			}).load({
				path: `${root}/tests/.env.test`,
				strict: true,
			})
		)) as Error;

		assertEquals(
			error.message,
			'Missing required environment variable: TEST_KEY',
		);
	});

	await t.step('should fail when value is not a valid number', async () => {
		clearEnv();
		const error = (await assertRejects(() =>
			createEnv({
				TEST_PORT: {
					type: 'number',
					required: true,
				},
			}).load({
				path: `${root}/tests/.env.test`,
				strict: true,
			})
		)) as Error;

		assertEquals(error.message, 'Invalid type for TEST_PORT: expected number');
	});

	await t.step('should fail when value is not a valid boolean', async () => {
		clearEnv();
		const error = (await assertRejects(() =>
			createEnv({
				TEST_DEBUG: {
					type: 'boolean',
					required: true,
				},
			}).load({
				path: `${root}/tests/.env.test`,
				strict: true,
			})
		)) as Error;

		assertEquals(
			error.message,
			'Invalid type for TEST_DEBUG: expected boolean',
		);
	});

	await t.step('should throw custom validation error', async () => {
		clearEnv();
		const error = (await assertRejects(() =>
			createEnv({
				APP_PORT: {
					type: 'number',
					validate: (value) =>
						typeof value === 'number' && value < 8000
							? 'Port must be >= 8000'
							: undefined,
				},
			}).load({
				path: `${root}/tests/.env.test`,
				strict: true,
			})
		)) as Error;

		assertEquals(error.message, 'Port must be >= 8000');
	});

	await t.step(
		'should return undefined for non-existent key in non-strict mode',
		async () => {
			clearEnv();
			const config = await createEnv({
				APP_ENV: {
					type: 'string',
				},
			}).load({
				path: `${root}/tests/.env.test`,
				strict: false,
			});

			// deno-lint-ignore no-explicit-any
			assertEquals((config as any).NON_EXISTENT_KEY, undefined);
		},
	);

	await t.step('should validate all types correctly', async () => {
		clearEnv();
		const config = await createEnv({
			APP_ENV: {
				type: 'string',
			},
			APP_PORT: {
				type: 'number',
			},
			APP_DEBUG: {
				type: 'boolean',
			},
			OVERRIDE_KEY: {
				type: 'string',
			},
		}).load({
			path: `${root}/tests/.env.test`,
			strict: true,
		});
		assertEquals(config.APP_ENV, 'development');
		assertEquals(config.APP_PORT, 3000);
		assertEquals(config.APP_DEBUG, true);
		assertEquals(config.OVERRIDE_KEY, 'override');
	});

	await t.step('should prefer env file value over default value', async () => {
		clearEnv();
		const config = await createEnv({
			APP_ENV: {
				type: 'string',
				default: 'production',
			},
		}).load({
			path: `${root}/tests/.env.test`,
			strict: true,
		});

		assertEquals(config.APP_ENV, 'development');
	});

	await t.step('should override values from previous env files', async () => {
		clearEnv();
		const config = await createEnv({
			OVERRIDE_KEY: { type: 'string' },
		}).load({
			path: [`${root}/tests/.env.test`, `${root}/tests/.env.override`],
		});

		assertEquals(config.OVERRIDE_KEY, 'override_key');
	});

	await t.step(
		'should collect all validation errors in strict mode',
		async () => {
			clearEnv();
			const error = (await assertRejects(() =>
				createEnv({
					PORT: { type: 'number', required: true },
					DEBUG: { type: 'boolean', required: true },
				}).load({
					strict: true,
				})
			)) as Error;

			assertEquals(error.message.includes('PORT'), true);
			assertEquals(error.message.includes('DEBUG'), true);
		},
	);

	await t.step(
		'should use default values when no env file is provided',
		async () => {
			clearEnv();
			const config = await createEnv({
				PORT: {
					type: 'number',
					default: 3000,
				},
				NODE_ENV: {
					type: 'string',
					default: 'development',
				},
				DEBUG: {
					type: 'boolean',
					default: false,
				},
			}).load();

			assertEquals(config.PORT, 3000);
			assertEquals(config.NODE_ENV, 'development');
			assertEquals(config.DEBUG, false);
		},
	);

	await t.step('should keep spaces and # inside quoted values', async () => {
		clearEnv();
		const config = await createEnv({
			QUOTED_DOUBLE: { type: 'string' },
			QUOTED_SINGLE: { type: 'string' },
			QUOTED_HASH: { type: 'string' },
			UNQUOTED_SPACES: { type: 'string' },
			APP_PORT: { type: 'number' },
		}).load({
			path: `${root}/tests/.env.test`,
		});

		assertEquals(config.QUOTED_DOUBLE, 'My App');
		assertEquals(config.QUOTED_SINGLE, 'Single Quoted');
		assertEquals(config.QUOTED_HASH, 'abc # not a comment');
		assertEquals(config.UNQUOTED_SPACES, 'hello world');
		assertEquals(config.APP_PORT, 3000);
	});

	await t.step(
		'should read .env from the working directory when no path is provided',
		async () => {
			clearEnv();
			Deno.chdir(`${root}/tests/default`);
			try {
				const config = await createEnv({
					DEFAULT_KEY: { type: 'string', required: true },
				}).load();

				assertEquals(config.DEFAULT_KEY, 'from_default_file');
			} finally {
				Deno.chdir(root);
			}
		},
	);

	await t.step(
		'should prefer system environment variables over file values',
		async () => {
			clearEnv();
			Deno.env.set('SHARED_KEY', 'from_system');
			try {
				const config = await createEnv({
					SHARED_KEY: { type: 'string', required: true },
				}).load({
					path: `${root}/tests/default/.env`,
				});

				assertEquals(config.SHARED_KEY, 'from_system');
			} finally {
				Deno.env.delete('SHARED_KEY');
			}
		},
	);

	await t.step('should export clearEnv from the module entry', () => {
		assertEquals(typeof modClearEnv, 'function');
	});

	await t.step(
		'should run the bug report reproduction as written',
		async () => {
			clearEnv();
			Deno.chdir(`${root}/tests/report`);
			try {
				//- Same calls as the report, without clearEnv in between
				await createEnv({
					API_KEY: { type: 'string', required: true },
				}).load();

				const config = await createEnv({
					API_KEY: { type: 'string', required: true },
					APP_NAME: { type: 'string', required: true },
				}).load({ path: '.env' });

				assertEquals({ ...config }, {
					API_KEY: 'secret123',
					APP_NAME: 'My App',
				});
			} finally {
				Deno.chdir(root);
			}
		},
	);

	await t.step('should cache results per loader', async () => {
		clearEnv();
		const loader = createEnv({ CACHE_KEY: { type: 'string' } });

		Deno.env.set('CACHE_KEY', 'first');
		try {
			const first = await loader.load();
			Deno.env.set('CACHE_KEY', 'second');

			//- Same loader returns the cached result
			const cached = await loader.load();
			assertEquals(cached, first);
			assertEquals(cached.CACHE_KEY, 'first');

			//- A new loader reads again
			const fresh = await createEnv({
				CACHE_KEY: { type: 'string' },
			}).load();
			assertEquals(fresh.CACHE_KEY, 'second');

			//- clearEnv invalidates every loader's cache
			clearEnv();
			const reloaded = await loader.load();
			assertEquals(reloaded.CACHE_KEY, 'second');
		} finally {
			Deno.env.delete('CACHE_KEY');
		}
	});

	await t.step('should not mix values between concurrent loads', async () => {
		clearEnv();
		const [a, b] = await Promise.all([
			createEnv({ APP_ENV: { type: 'string' } }).load({
				path: `${root}/tests/.env.test`,
			}),
			createEnv({ DEFAULT_KEY: { type: 'string' } }).load({
				path: `${root}/tests/default/.env`,
			}),
		]);

		assertEquals({ ...a }, { APP_ENV: 'development' });
		assertEquals({ ...b }, { DEFAULT_KEY: 'from_default_file' });
	});
});
