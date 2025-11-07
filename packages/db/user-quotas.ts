import type { Sql, MaybeRow, PendingQuery } from 'postgres'

/**
 * UserQuota represents the evaluation and implementation quota limits and usage for a user
 * Quotas are per-user and never reset (one-time allocation)
 */
export interface UserQuota {
  user_id: string
  simple_evaluations_used: number
  simple_evaluations_soft_limit: number
  simple_evaluations_hard_limit: number
  advanced_evaluations_used: number
  advanced_evaluations_soft_limit: number
  advanced_evaluations_hard_limit: number
  implementations_used: number
  implementations_soft_limit: number
  implementations_hard_limit: number
  created_at: Date
  updated_at: Date
}

/**
 * QuotaCheck result indicating if operation can proceed
 * Used for: simple evaluations, advanced evaluations, and implementations
 */
export interface QuotaCheck {
  can_proceed: boolean
  at_soft_limit: boolean
  at_hard_limit: boolean
  used: number
  soft_limit: number
  hard_limit: number
  remaining: number
}

function get<T extends readonly MaybeRow[]>(q: PendingQuery<T>) {
  return q.then(v => v)
}

/**
 * Get quota for a user, creating default quota if it doesn't exist
 */
export async function getUserQuota(sql: Sql, userId: string): Promise<UserQuota> {
  const quotas = await get(sql<UserQuota[]>`
    SELECT * FROM user_quotas WHERE user_id = ${userId}
  `)

  if (quotas.length > 0 && quotas[0]) {
    return quotas[0]
  }

  // Create default quota for new user
  return createDefaultQuota(sql, userId)
}

/**
 * Create default quota allocation for a new user
 */
async function createDefaultQuota(sql: Sql, userId: string): Promise<UserQuota> {
  const [quota] = await get(sql<UserQuota[]>`
    INSERT INTO user_quotas (user_id)
    VALUES (${userId})
    RETURNING *
  `)

  if (!quota) {
    throw new Error('Failed to create user quota')
  }

  return quota
}

/**
 * Check if user has quota available for an operation type
 * Returns detailed information about quota status including soft/hard limits
 */
export async function checkQuotaAvailable(
  sql: Sql,
  userId: string,
  operationType: 'simple' | 'advanced' | 'implementation'
): Promise<QuotaCheck> {
  const quota = await getUserQuota(sql, userId)

  if (operationType === 'simple') {
    const used = quota.simple_evaluations_used
    const softLimit = quota.simple_evaluations_soft_limit
    const hardLimit = quota.simple_evaluations_hard_limit
    const remaining = Math.max(0, hardLimit - used)

    return {
      can_proceed: used < hardLimit,
      at_soft_limit: used >= softLimit && used < hardLimit,
      at_hard_limit: used >= hardLimit,
      used,
      soft_limit: softLimit,
      hard_limit: hardLimit,
      remaining,
    }
  } else if (operationType === 'advanced') {
    const used = quota.advanced_evaluations_used
    const softLimit = quota.advanced_evaluations_soft_limit
    const hardLimit = quota.advanced_evaluations_hard_limit
    const remaining = Math.max(0, hardLimit - used)

    return {
      can_proceed: used < hardLimit,
      at_soft_limit: used >= softLimit && used < hardLimit,
      at_hard_limit: used >= hardLimit,
      used,
      soft_limit: softLimit,
      hard_limit: hardLimit,
      remaining,
    }
  } else {
    const used = quota.implementations_used
    const softLimit = quota.implementations_soft_limit
    const hardLimit = quota.implementations_hard_limit
    const remaining = Math.max(0, hardLimit - used)

    return {
      can_proceed: used < hardLimit,
      at_soft_limit: used >= softLimit && used < hardLimit,
      at_hard_limit: used >= hardLimit,
      used,
      soft_limit: softLimit,
      hard_limit: hardLimit,
      remaining,
    }
  }
}

/**
 * Increment quota usage for a user after successful operation
 * This should be called atomically with the operation start
 */
export async function incrementQuotaUsage(
  sql: Sql,
  userId: string,
  operationType: 'simple' | 'advanced' | 'implementation'
): Promise<UserQuota> {
  const field = operationType === 'simple'
    ? sql`simple_evaluations_used`
    : operationType === 'advanced'
    ? sql`advanced_evaluations_used`
    : sql`implementations_used`

  const quotas = await get(sql<UserQuota[]>`
    UPDATE user_quotas
    SET ${field} = ${field} + 1,
        updated_at = NOW()
    WHERE user_id = ${userId}
    RETURNING *
  `)

  const [quota] = quotas
  if (!quota) {
    throw new Error(`Quota not found for user ${userId}`)
  }

  return quota
}

/**
 * Admin function: Set custom quota limits for a user
 */
export async function setUserQuotaLimits(
  sql: Sql,
  userId: string,
  limits: {
    simple_soft?: number
    simple_hard?: number
    advanced_soft?: number
    advanced_hard?: number
    implementation_soft?: number
    implementation_hard?: number
  }
): Promise<UserQuota> {
  // Get current quota to ensure user exists
  const currentQuota = await getUserQuota(sql, userId)

  const updates: Record<string, number> = {}

  if (limits.simple_soft !== undefined) {
    updates.simple_evaluations_soft_limit = limits.simple_soft
  }
  if (limits.simple_hard !== undefined) {
    updates.simple_evaluations_hard_limit = limits.simple_hard
  }
  if (limits.advanced_soft !== undefined) {
    updates.advanced_evaluations_soft_limit = limits.advanced_soft
  }
  if (limits.advanced_hard !== undefined) {
    updates.advanced_evaluations_hard_limit = limits.advanced_hard
  }
  if (limits.implementation_soft !== undefined) {
    updates.implementations_soft_limit = limits.implementation_soft
  }
  if (limits.implementation_hard !== undefined) {
    updates.implementations_hard_limit = limits.implementation_hard
  }

  if (Object.keys(updates).length === 0) {
    return currentQuota
  }

  const quotas = await get(sql<UserQuota[]>`
    UPDATE user_quotas
    SET ${sql(updates)},
        updated_at = NOW()
    WHERE user_id = ${userId}
    RETURNING *
  `)

  const [quota] = quotas
  if (!quota) {
    throw new Error(`Failed to update quota for user ${userId}`)
  }

  return quota
}

/**
 * Admin function: Reset usage count for a user (keeps limits)
 */
export async function resetUserQuotaUsage(
  sql: Sql,
  userId: string,
  resetType: 'simple' | 'advanced' | 'implementation' | 'all'
): Promise<UserQuota> {
  const updates: any = {}

  if (resetType === 'simple' || resetType === 'all') {
    updates.simple_evaluations_used = 0
  }
  if (resetType === 'advanced' || resetType === 'all') {
    updates.advanced_evaluations_used = 0
  }
  if (resetType === 'implementation' || resetType === 'all') {
    updates.implementations_used = 0
  }

  const quotas = await get(sql<UserQuota[]>`
    UPDATE user_quotas
    SET ${sql(updates)},
        updated_at = NOW()
    WHERE user_id = ${userId}
    RETURNING *
  `)

  const [quota] = quotas
  if (!quota) {
    throw new Error(`Quota not found for user ${userId}`)
  }

  return quota
}

/**
 * Get all user quotas (for admin dashboard)
 */
export async function getAllUserQuotas(sql: Sql): Promise<UserQuota[]> {
  return get(sql<UserQuota[]>`
    SELECT * FROM user_quotas
    ORDER BY created_at DESC
  `)
}

/**
 * Get users who have exceeded their soft limits
 */
export async function getUsersAtSoftLimit(sql: Sql): Promise<UserQuota[]> {
  return get(sql<UserQuota[]>`
    SELECT * FROM user_quotas
    WHERE
      (simple_evaluations_used >= simple_evaluations_soft_limit) OR
      (advanced_evaluations_used >= advanced_evaluations_soft_limit)
    ORDER BY updated_at DESC
  `)
}

/**
 * Get users who have exceeded their hard limits
 */
export async function getUsersAtHardLimit(sql: Sql): Promise<UserQuota[]> {
  return get(sql<UserQuota[]>`
    SELECT * FROM user_quotas
    WHERE
      (simple_evaluations_used >= simple_evaluations_hard_limit) OR
      (advanced_evaluations_used >= advanced_evaluations_hard_limit)
    ORDER BY updated_at DESC
  `)
}
