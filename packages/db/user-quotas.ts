import type { Sql, MaybeRow, PendingQuery } from 'postgres'

/**
 * UserQuota represents the evaluation quota limits and usage for a user
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
  created_at: Date
  updated_at: Date
}

/**
 * QuotaCheck result indicating if evaluation can proceed
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
 * Check if user has quota available for an evaluation type
 * Returns detailed information about quota status including soft/hard limits
 */
export async function checkQuotaAvailable(
  sql: Sql,
  userId: string,
  evaluationType: 'simple' | 'advanced'
): Promise<QuotaCheck> {
  const quota = await getUserQuota(sql, userId)

  if (evaluationType === 'simple') {
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
  } else {
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
  }
}

/**
 * Increment quota usage for a user after successful evaluation
 * This should be called atomically with the evaluation start
 */
export async function incrementQuotaUsage(
  sql: Sql,
  userId: string,
  evaluationType: 'simple' | 'advanced'
): Promise<UserQuota> {
  const field = evaluationType === 'simple'
    ? sql`simple_evaluations_used`
    : sql`advanced_evaluations_used`

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
  }
): Promise<UserQuota> {
  // Get current quota to ensure user exists
  const currentQuota = await getUserQuota(sql, userId)

  const updates: string[] = []
  const values: number[] = []

  if (limits.simple_soft !== undefined) {
    updates.push('simple_evaluations_soft_limit = $' + (values.length + 1))
    values.push(limits.simple_soft)
  }
  if (limits.simple_hard !== undefined) {
    updates.push('simple_evaluations_hard_limit = $' + (values.length + 1))
    values.push(limits.simple_hard)
  }
  if (limits.advanced_soft !== undefined) {
    updates.push('advanced_evaluations_soft_limit = $' + (values.length + 1))
    values.push(limits.advanced_soft)
  }
  if (limits.advanced_hard !== undefined) {
    updates.push('advanced_evaluations_hard_limit = $' + (values.length + 1))
    values.push(limits.advanced_hard)
  }

  if (updates.length === 0) {
    return currentQuota
  }

  const quotas = await get(sql<UserQuota[]>`
    UPDATE user_quotas
    SET ${sql(limits, Object.keys(limits) as any)},
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
  resetType: 'simple' | 'advanced' | 'both'
): Promise<UserQuota> {
  const updates: any = {}

  if (resetType === 'simple' || resetType === 'both') {
    updates.simple_evaluations_used = 0
  }
  if (resetType === 'advanced' || resetType === 'both') {
    updates.advanced_evaluations_used = 0
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
