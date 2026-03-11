import path from 'path';

/**
 * Single source of truth for the saved auth session file path.
 * Path is relative to project root (parent of Tests/), so it works no matter where you run the command from.
 */
export const AUTH_FILE_PATH = path.resolve(__dirname, '..', 'playwright', '.auth', 'user.json');
