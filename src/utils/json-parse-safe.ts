import { logger } from './logger';

/**
 * Safely parses a JSON string.
 */
export function jsonParseSafe(value?: any): unknown | void {
  try {
    return JSON.parse(value);
  } catch (error) {
    logger.error('Failed to parse JSON', { error, value });
  }
}
