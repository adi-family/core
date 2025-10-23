#!/usr/bin/env bun

/**
 * Start Cloudflare Tunnel for local development
 * Exposes the backend API to GitLab runners via adi-local-tunel.the-ihor.com
 */

import { spawn } from 'child_process'

const TUNNEL_TOKEN = process.env.CLOUDFLARED_TUNNEL_TOKEN
const TUNNEL_URL = 'https://adi-local-tunel.the-ihor.com'

if (!TUNNEL_TOKEN) {
  console.error('❌ CLOUDFLARED_TUNNEL_TOKEN not found in environment')
  console.error('Please add it to your .env file')
  process.exit(1)
}

console.log('\n🌐 Starting Cloudflare Tunnel...')
console.log(`🔗 Public URL: ${TUNNEL_URL}`)
console.log(`📍 Tunneling to localhost:5174\n`)

const tunnel = spawn('cloudflared', ['tunnel', 'run', '--token', TUNNEL_TOKEN], {
  stdio: ['ignore', 'pipe', 'pipe']
})

tunnel.stdout.on('data', (data) => {
  process.stdout.write(data.toString())
})

tunnel.stderr.on('data', (data) => {
  process.stderr.write(data.toString())
})

tunnel.on('close', (code) => {
  console.log(`\n🛑 Cloudflare tunnel closed (code: ${code})`)
  process.exit(code || 0)
})

// Handle termination signals
process.on('SIGINT', () => {
  console.log('\n⏹️  Stopping tunnel...')
  tunnel.kill('SIGINT')
})

process.on('SIGTERM', () => {
  tunnel.kill('SIGTERM')
})
