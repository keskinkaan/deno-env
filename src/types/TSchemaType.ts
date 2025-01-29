/**
 * Type for valid environment variable types
 * @type {TOV<typeof ESchemaType>}
 * @description Union type of all possible environment variable types
 */
import type { TOV } from './TTypeOfValues.ts';
import type { ESchemaType } from '../enums/mod.ts';

export type TSchemaType = TOV<typeof ESchemaType>;
