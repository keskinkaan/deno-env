import type { TSchemaDefinition } from './TSchemaDefinition.ts';

/**
 * Type definition for environment schema
 * @type {Record<string, TSchemaDefinition>}
 * @description Defines the shape of environment configuration schema
 * @example
 * ```ts
 * const schema: TSchema = {
 *   PORT: { type: 'number', required: true },
 *   DEBUG: { type: 'boolean', default: false }
 * };
 * ```
 */
export type TSchema = Record<string, TSchemaDefinition>;
