import type { TSchemaType } from './TSchemaType.ts';

/**
 * Type mapping for environment variable types
 * @type {Object}
 * @description Maps schema types to their TypeScript equivalents
 */
export type TypeMap = {
	string: string;
	number: number;
	boolean: boolean;
};

/**
 * Type definition for schema field configuration
 * @template T - Type of the environment variable
 * @property {T} type - The type of the environment variable
 * @property {boolean} [required] - Whether the variable is required
 * @property {TypeMap[T]} [default] - Default value if not provided
 * @property {Function} [validate] - Custom validation function
 * @example
 * ```ts
 * const portConfig: TSchemaDefinition = {
 *   type: 'number',
 *   required: true,
 *   validate: (value) => value < 1000 ? 'Port must be >= 1000' : undefined
 * };
 * ```
 */
export type TSchemaDefinition<T extends TSchemaType = TSchemaType> = {
	type: T;
	required?: boolean;
	default?: TypeMap[T];
	validate?: (value: TypeMap[T]) => string | undefined;
};
