import { assertEquals, assertRejects } from 'jsr:@std/assert@^1.0.11';
import { clearEnv, createEnv } from '../src/env.ts';

const root = Deno.cwd();

Deno.test('ENV functionality tests', async (t) => {
	await t.step('should fail when env file does not exist', async () => {
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
});
