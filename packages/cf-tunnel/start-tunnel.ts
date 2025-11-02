#!/usr/bin/env bun

/**
 * Start Cloudflare Tunnel for local development
 * Exposes the backend API to GitLab runners via adi-local-tunel.the-ihor.com
 *
 * Features:
 * - Auto-restart on failures with exponential backoff
 * - Graceful shutdown handling
 * - Connection monitoring
 */

import { spawn } from 'child_process'
import type { ChildProcess } from 'child_process'
import { TUNNEL_CONFIG } from '@adi-simple/config'

const TUNNEL_TOKEN = process.env.CLOUDFLARED_TUNNEL_TOKEN
const TUNNEL_URL = TUNNEL_CONFIG.url
const MAX_RESTART_DELAY = TUNNEL_CONFIG.maxRestartDelayMs
const INITIAL_RESTART_DELAY = TUNNEL_CONFIG.initialRestartDelayMs
const MAX_CONSECUTIVE_FAILURES = TUNNEL_CONFIG.maxConsecutiveFailures

if (!TUNNEL_TOKEN) {
  console.error('❌ CLOUDFLARED_TUNNEL_TOKEN not found in environment')
  console.error('Please add it to your .env file')
  process.exit(1)
}

let currentTunnel: ChildProcess | null = null
let restartCount = 0
let consecutiveFailures = 0
let isShuttingDown = false
let currentRestartDelay = INITIAL_RESTART_DELAY

function getRestartDelay(): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
  const delay = Math.min(currentRestartDelay, MAX_RESTART_DELAY)
  currentRestartDelay = Math.min(currentRestartDelay * 2, MAX_RESTART_DELAY)
  return delay
}

function resetRestartDelay() {
  currentRestartDelay = INITIAL_RESTART_DELAY
  consecutiveFailures = 0
}

function startTunnel() {
  if (isShuttingDown) {
    return
  }

  const isRestart = restartCount > 0

  if (isRestart) {
    console.log(`\n🔄 Restarting Cloudflare Tunnel (attempt ${restartCount + 1})...`)
  } else {
    console.log('\n🌐 Starting Cloudflare Tunnel...')
    console.log(`🔗 Public URL: ${TUNNEL_URL}`)
    console.log(`📍 Tunneling to localhost:5174\n`)
  }

  const tunnel = spawn('cloudflared', ['tunnel', 'run', '--token', TUNNEL_TOKEN], {
    stdio: ['ignore', 'pipe', 'pipe']
  })

  currentTunnel = tunnel
  const tunnelStartTime = Date.now()
  let hasConnected = false

  tunnel.stdout.on('data', (data) => {
    const output = data.toString()
    process.stdout.write(output)

    // Detect successful connection
    if (!hasConnected && (output.includes('Registered tunnel') || output.includes('Connection'))) {
      hasConnected = true
      consecutiveFailures = 0
      resetRestartDelay()

      if (isRestart) {
        const uptime = ((Date.now() - tunnelStartTime) / 1000).toFixed(1)
        console.log(`✅ Tunnel reconnected successfully after ${uptime}s`)
      }
    }
  })

  tunnel.stderr.on('data', (data) => {
    process.stderr.write(data.toString())
  })

  tunnel.on('close', (code) => {
    currentTunnel = null

    if (isShuttingDown) {
      console.log(`\n✅ Cloudflare tunnel stopped gracefully`)
      process.exit(0)
      return
    }

    const uptime = ((Date.now() - tunnelStartTime) / 1000).toFixed(1)

    // If tunnel ran for more than 30 seconds, consider it a successful run
    if (uptime > 30) {
      consecutiveFailures = 0
      resetRestartDelay()
    } else {
      consecutiveFailures++
    }

    console.log(`\n⚠️  Cloudflare tunnel closed (code: ${code}, uptime: ${uptime}s)`)

    // Check if we've exceeded max consecutive failures
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.error(`\n❌ Tunnel failed ${MAX_CONSECUTIVE_FAILURES} times consecutively. Giving up.`)
      console.error('Please check your network connection and CLOUDFLARED_TUNNEL_TOKEN')
      process.exit(1)
      return
    }

    // Auto-restart with exponential backoff
    const delay = getRestartDelay()
    console.log(`⏳ Restarting in ${(delay / 1000).toFixed(1)}s... (consecutive failures: ${consecutiveFailures})`)

    setTimeout(() => {
      restartCount++
      startTunnel()
    }, delay)
  })

  tunnel.on('error', (error) => {
    console.error(`\n❌ Tunnel process error: ${error.message}`)

    if (error.message.includes('ENOENT')) {
      console.error('\n💡 Cloudflared not found. Please install it:')
      console.error('   brew install cloudflared (macOS)')
      console.error('   Or visit: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/')
      process.exit(1)
    }
  })
}

// Handle termination signals
process.on('SIGINT', () => {
  if (isShuttingDown) return

  isShuttingDown = true
  console.log('\n⏹️  Stopping tunnel...')

  if (currentTunnel) {
    currentTunnel.kill('SIGINT')
    // Give it 5 seconds to shut down gracefully
    setTimeout(() => {
      if (currentTunnel) {
        console.log('⚠️  Forcing tunnel shutdown...')
        currentTunnel.kill('SIGKILL')
      }
      process.exit(0)
    }, 5000)
  } else {
    process.exit(0)
  }
})

process.on('SIGTERM', () => {
  if (isShuttingDown) return

  isShuttingDown = true
  if (currentTunnel) {
    currentTunnel.kill('SIGTERM')
  }
})

// Start the tunnel
startTunnel()
