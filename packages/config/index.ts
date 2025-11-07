/**
 * Main entry point - exports everything from shared and server
 * For server-side use only. Client code should import from '@adi-simple/config/shared'
 */

// Re-export shared constants (safe for both client and server)
export * from './shared'

// Re-export server-only config
export * from './server'
