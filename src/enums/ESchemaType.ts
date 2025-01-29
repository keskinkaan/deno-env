/**
 * Enum for environment variable types
 * @enum {string}
 * @readonly
 * @description Defines the available data types for environment variables
 */
export const ESchemaType = {
	/** String type for text values */
	STRING: 'string',
	/** Number type for numeric values */
	NUMBER: 'number',
	/** Boolean type for true/false values */
	BOOLEAN: 'boolean',
} as const;
