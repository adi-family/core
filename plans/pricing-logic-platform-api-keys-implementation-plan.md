# Implementation Plan: Pricing Logic for Platform API Keys

**Generated:** 2025-11-21
**Objective:** Enable paid usage of platform API keys (Anthropic, Google) with billing and credit management

---

## Table of Contents

- [Current State Analysis](#current-state-analysis)
- [Phase 1: Billing Infrastructure](#phase-1-billing-infrastructure)
- [Phase 2: Pricing Engine](#phase-2-pricing-engine)
- [Phase 3: Payment Integration](#phase-3-payment-integration)
- [Phase 4: Billing Workflow](#phase-4-billing-workflow)
- [Phase 5: UI Components](#phase-5-ui-components)
- [Phase 6: Testing & Rollout](#phase-6-testing--rollout)
- [Phase 7: Monitoring & Alerts](#phase-7-monitoring--alerts)
- [File Structure Summary](#file-structure-summary)
- [Timeline & Resources](#timeline--resources)
- [Security Considerations](#security-considerations)

---

## Current State Analysis

### ✅ Already Implemented

- **User quota system** - Free tier with 20 operations per user
- **Usage tracking** - `api_usage_metrics` table with token counts
- **Cost calculation engine** - $1.00/1M tokens, $0.0778/CI hour
- **Multi-provider AI configuration** - Support for Anthropic, OpenAI, Google
- **Smart provider fallback** - Platform key → Project key logic
- **Encrypted secret management** - AES-256-GCM encryption for API keys

### ❌ Missing Components

- Payment/billing infrastructure
- Credit balance system
- Automatic billing calculations
- Payment method integration (Stripe)
- Billing cycles and invoicing
- Cost alerts and spending limits
- Auto-recharge functionality

---

## Phase 1: Billing Infrastructure 🏗️

### 1.1 Database Schema Changes

#### New Tables

**1. User Credits Table**
```sql
CREATE TABLE user_credits (
    user_id TEXT PRIMARY KEY,
    balance_cents INTEGER NOT NULL DEFAULT 0,
    reserved_cents INTEGER NOT NULL DEFAULT 0,  -- Pending charges
    lifetime_spent_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    auto_recharge_enabled BOOLEAN DEFAULT false,
    auto_recharge_threshold_cents INTEGER,
    auto_recharge_amount_cents INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose:** Track user credit balances in cents to avoid floating-point precision issues.

---

**2. Credit Transactions Table**
```sql
CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES user_credits(user_id),
    amount_cents INTEGER NOT NULL,  -- Positive = credit, Negative = debit
    transaction_type TEXT NOT NULL,  -- 'purchase', 'usage', 'refund', 'bonus'
    description TEXT,
    related_usage_metric_id UUID REFERENCES api_usage_metrics(id),
    related_payment_id TEXT,  -- Stripe payment intent ID
    balance_after_cents INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_credit_transactions_user_id
ON credit_transactions(user_id, created_at DESC);
```

**Purpose:** Immutable ledger for all credit transactions with full audit trail.

---

**3. Provider Pricing Configuration**
```sql
CREATE TABLE provider_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,  -- 'anthropic', 'google', 'openai'
    model TEXT NOT NULL,
    effective_date TIMESTAMP NOT NULL DEFAULT NOW(),
    input_token_price_per_million DECIMAL(10,6) NOT NULL,
    output_token_price_per_million DECIMAL(10,6) NOT NULL,
    cache_creation_price_per_million DECIMAL(10,6),
    cache_read_price_per_million DECIMAL(10,6),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(provider, model, effective_date)
);

CREATE INDEX idx_provider_pricing_lookup
ON provider_pricing(provider, model, is_active, effective_date DESC);
```

**Purpose:** Dynamic pricing configuration supporting historical price changes.

---

**4. Billing Periods Table**
```sql
CREATE TABLE billing_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    total_tokens_input BIGINT DEFAULT 0,
    total_tokens_output BIGINT DEFAULT 0,
    total_ci_seconds INTEGER DEFAULT 0,
    calculated_cost_cents INTEGER DEFAULT 0,
    charged_cost_cents INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'finalized', 'paid'
    finalized_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_billing_periods_user
ON billing_periods(user_id, period_start DESC);
```

**Purpose:** Track monthly billing cycles for invoicing and reporting.

---

**5. Payment Methods Table**
```sql
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'stripe',
    provider_payment_method_id TEXT NOT NULL,  -- Stripe pm_xxx
    type TEXT NOT NULL,  -- 'card', 'bank_account'
    is_default BOOLEAN DEFAULT false,
    last_four TEXT,
    brand TEXT,  -- 'visa', 'mastercard'
    exp_month INTEGER,
    exp_year INTEGER,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payment_methods_user ON payment_methods(user_id);
```

**Purpose:** Store tokenized payment methods for auto-recharge and purchases.

---

### 1.2 Enhanced Usage Tracking

**Update Existing `api_usage_metrics` Table:**

```sql
ALTER TABLE api_usage_metrics
ADD COLUMN calculated_cost_cents INTEGER,
ADD COLUMN billing_status TEXT DEFAULT 'pending',  -- 'pending', 'billed', 'credited'
ADD COLUMN billing_reservation_id TEXT,
ADD COLUMN using_project_key BOOLEAN DEFAULT false;

CREATE INDEX idx_api_usage_metrics_billing
ON api_usage_metrics(user_id, billing_status, created_at);
```

**Migration Files:**
- `migrations/20251121000001_create_billing_tables.up.sql`
- `migrations/20251121000002_enhance_usage_tracking.up.sql`

---

## Phase 2: Pricing Engine 💰

### 2.1 Provider Pricing Service

**File:** `packages/backend/services/provider-pricing.ts`

```typescript
export interface ProviderCost {
  provider: string;
  model: string;
  inputTokensPerMillion: number;
  outputTokensPerMillion: number;
  cacheCreationPerMillion?: number;
  cacheReadPerMillion?: number;
}

export class ProviderPricingService {
  /**
   * Get current pricing for a provider/model combination
   */
  async getCurrentPricing(
    provider: string,
    model: string
  ): Promise<ProviderCost> {
    const pricing = await db.query(
      `SELECT * FROM provider_pricing
       WHERE provider = $1 AND model = $2 AND is_active = true
       ORDER BY effective_date DESC LIMIT 1`,
      [provider, model]
    );

    if (!pricing) {
      throw new Error(`No pricing found for ${provider}/${model}`);
    }

    return pricing;
  }

  /**
   * Calculate cost for a usage metric
   */
  async calculateUsageCost(metric: ApiUsageMetric): Promise<number> {
    const pricing = await this.getCurrentPricing(
      metric.provider,
      metric.model
    );

    let totalCostCents = 0;

    // Input tokens
    if (metric.input_tokens) {
      totalCostCents += (metric.input_tokens / 1_000_000) *
                        pricing.inputTokensPerMillion;
    }

    // Output tokens
    if (metric.output_tokens) {
      totalCostCents += (metric.output_tokens / 1_000_000) *
                        pricing.outputTokensPerMillion;
    }

    // Cache creation tokens
    if (metric.cache_creation_input_tokens && pricing.cacheCreationPerMillion) {
      totalCostCents += (metric.cache_creation_input_tokens / 1_000_000) *
                        pricing.cacheCreationPerMillion;
    }

    // Cache read tokens
    if (metric.cache_read_input_tokens && pricing.cacheReadPerMillion) {
      totalCostCents += (metric.cache_read_input_tokens / 1_000_000) *
                        pricing.cacheReadPerMillion;
    }

    // Round to nearest cent
    return Math.round(totalCostCents * 100);
  }

  /**
   * Seed database with current provider pricing
   */
  async seedProviderPricing(): Promise<void> {
    const pricingData: ProviderCost[] = [
      // Anthropic Claude 3.5 Sonnet
      {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        inputTokensPerMillion: 3.00,
        outputTokensPerMillion: 15.00,
        cacheCreationPerMillion: 3.75,
        cacheReadPerMillion: 0.30
      },
      // Anthropic Claude 3 Opus
      {
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        inputTokensPerMillion: 15.00,
        outputTokensPerMillion: 75.00,
        cacheCreationPerMillion: 18.75,
        cacheReadPerMillion: 1.50
      },
      // Google Gemini 1.5 Pro
      {
        provider: 'google',
        model: 'gemini-1.5-pro',
        inputTokensPerMillion: 1.25,
        outputTokensPerMillion: 5.00
      },
      // Google Gemini 1.5 Flash
      {
        provider: 'google',
        model: 'gemini-1.5-flash',
        inputTokensPerMillion: 0.075,
        outputTokensPerMillion: 0.30
      }
    ];

    for (const pricing of pricingData) {
      await this.upsertPricing(pricing);
    }
  }

  /**
   * Update pricing (admin only)
   */
  async updatePricing(pricing: ProviderCost): Promise<void> {
    await db.query(
      `INSERT INTO provider_pricing
       (provider, model, input_token_price_per_million,
        output_token_price_per_million, cache_creation_price_per_million,
        cache_read_price_per_million, effective_date, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), true)`,
      [
        pricing.provider,
        pricing.model,
        pricing.inputTokensPerMillion,
        pricing.outputTokensPerMillion,
        pricing.cacheCreationPerMillion,
        pricing.cacheReadPerMillion
      ]
    );
  }
}
```

---

### 2.2 Credit Management Service

**File:** `packages/backend/services/credit-manager.ts`

```typescript
export interface UserCredit {
  userId: string;
  balanceCents: number;
  reservedCents: number;
  availableCents: number;
  lifetimeSpentCents: number;
  autoRechargeEnabled: boolean;
  autoRechargeThresholdCents?: number;
  autoRechargeAmountCents?: number;
}

export class CreditManager {
  /**
   * Get user's current credit balance
   */
  async getBalance(userId: string): Promise<UserCredit> {
    let credit = await db.query(
      `SELECT * FROM user_credits WHERE user_id = $1`,
      [userId]
    );

    // Initialize if doesn't exist
    if (!credit) {
      credit = await this.initializeUserCredits(userId);
    }

    return {
      ...credit,
      availableCents: credit.balance_cents - credit.reserved_cents
    };
  }

  /**
   * Check if user has sufficient balance for operation
   */
  async hasSufficientBalance(
    userId: string,
    requiredCents: number
  ): Promise<boolean> {
    const credit = await this.getBalance(userId);
    return credit.availableCents >= requiredCents;
  }

  /**
   * Reserve credits before operation (optimistic locking)
   * Returns reservation ID for later commit/release
   */
  async reserveCredits(
    userId: string,
    amountCents: number
  ): Promise<string> {
    const reservationId = uuidv4();

    await db.transaction(async (trx) => {
      // Lock row and check balance
      const credit = await trx.query(
        `SELECT * FROM user_credits WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );

      const available = credit.balance_cents - credit.reserved_cents;

      if (available < amountCents) {
        throw new InsufficientCreditsError(
          `Insufficient credits. Available: ${available}, Required: ${amountCents}`
        );
      }

      // Update reserved amount
      await trx.query(
        `UPDATE user_credits
         SET reserved_cents = reserved_cents + $1,
             updated_at = NOW()
         WHERE user_id = $2`,
        [amountCents, userId]
      );

      // Store reservation in metadata
      await trx.query(
        `INSERT INTO credit_transactions
         (user_id, amount_cents, transaction_type, description,
          balance_after_cents, metadata)
         VALUES ($1, $2, 'reservation', $3, $4, $5)`,
        [
          userId,
          0, // No actual charge yet
          `Reserved ${amountCents} cents`,
          credit.balance_cents,
          { reservationId, amountReserved: amountCents }
        ]
      );
    });

    return reservationId;
  }

  /**
   * Commit reserved credits (charge actual cost)
   */
  async commitReservedCredits(
    reservationId: string,
    actualCostCents: number
  ): Promise<void> {
    await db.transaction(async (trx) => {
      // Find reservation
      const reservation = await trx.query(
        `SELECT * FROM credit_transactions
         WHERE metadata->>'reservationId' = $1
         AND transaction_type = 'reservation'`,
        [reservationId]
      );

      if (!reservation) {
        throw new Error(`Reservation not found: ${reservationId}`);
      }

      const userId = reservation.user_id;
      const reservedAmount = reservation.metadata.amountReserved;

      // Lock user credits
      const credit = await trx.query(
        `SELECT * FROM user_credits WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );

      // Deduct actual cost
      const newBalance = credit.balance_cents - actualCostCents;
      const newReserved = credit.reserved_cents - reservedAmount;

      await trx.query(
        `UPDATE user_credits
         SET balance_cents = $1,
             reserved_cents = $2,
             lifetime_spent_cents = lifetime_spent_cents + $3,
             updated_at = NOW()
         WHERE user_id = $4`,
        [newBalance, newReserved, actualCostCents, userId]
      );

      // Record transaction
      await trx.query(
        `INSERT INTO credit_transactions
         (user_id, amount_cents, transaction_type, description,
          balance_after_cents, metadata)
         VALUES ($1, $2, 'usage', $3, $4, $5)`,
        [
          userId,
          -actualCostCents,
          `Charged ${actualCostCents} cents (reservation ${reservationId})`,
          newBalance,
          {
            reservationId,
            amountReserved: reservedAmount,
            actualCost: actualCostCents
          }
        ]
      );
    });
  }

  /**
   * Release reservation if operation fails
   */
  async releaseReservedCredits(reservationId: string): Promise<void> {
    await db.transaction(async (trx) => {
      const reservation = await trx.query(
        `SELECT * FROM credit_transactions
         WHERE metadata->>'reservationId' = $1`,
        [reservationId]
      );

      if (!reservation) return;

      const userId = reservation.user_id;
      const reservedAmount = reservation.metadata.amountReserved;

      await trx.query(
        `UPDATE user_credits
         SET reserved_cents = reserved_cents - $1,
             updated_at = NOW()
         WHERE user_id = $2`,
        [reservedAmount, userId]
      );

      await trx.query(
        `UPDATE credit_transactions
         SET description = description || ' (RELEASED)'
         WHERE metadata->>'reservationId' = $1`,
        [reservationId]
      );
    });
  }

  /**
   * Add credits (purchase, bonus, refund)
   */
  async addCredits(
    userId: string,
    amountCents: number,
    type: 'purchase' | 'bonus' | 'refund',
    metadata?: any
  ): Promise<void> {
    await db.transaction(async (trx) => {
      const credit = await trx.query(
        `SELECT * FROM user_credits WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );

      const newBalance = credit.balance_cents + amountCents;

      await trx.query(
        `UPDATE user_credits
         SET balance_cents = $1, updated_at = NOW()
         WHERE user_id = $2`,
        [newBalance, userId]
      );

      await trx.query(
        `INSERT INTO credit_transactions
         (user_id, amount_cents, transaction_type, description,
          balance_after_cents, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          amountCents,
          type,
          `Added ${amountCents} cents (${type})`,
          newBalance,
          metadata
        ]
      );
    });
  }

  /**
   * Get transaction history
   */
  async getTransactions(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<CreditTransaction[]> {
    return db.query(
      `SELECT * FROM credit_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
  }

  /**
   * Check and trigger auto-recharge if needed
   */
  async checkAutoRecharge(userId: string): Promise<void> {
    const credit = await this.getBalance(userId);

    if (!credit.autoRechargeEnabled) return;

    if (credit.balanceCents <= (credit.autoRechargeThresholdCents || 0)) {
      // Trigger auto-recharge via payment provider
      await paymentProvider.processAutoRecharge(
        userId,
        credit.autoRechargeAmountCents || 1000 // Default $10
      );
    }
  }
}
```

---

### 2.3 Updated AI Provider Selector

**File:** `packages/backend/services/ai-provider-selector.ts` (Update)

```typescript
interface BillingContext {
  reservationId?: string;
  userId: string;
  estimatedCostCents: number;
}

export async function selectProviderWithBilling(
  userId: string,
  projectId: string,
  goal: 'evaluation' | 'implementation'
): Promise<{
  config: ProviderConfig;
  billingContext?: BillingContext;
  usingPlatformKey: boolean;
}> {

  // 1. Check free quota (existing logic)
  const quota = await checkQuotaAvailable(userId, goal);

  if (quota.can_proceed && !quota.at_hard_limit) {
    // Use platform API key (free tier)
    await incrementQuotaUsage(userId, goal);

    return {
      config: getPlatformProviderConfig(),
      usingPlatformKey: true
    };
  }

  // 2. Free quota exceeded - check for paid credits
  const estimatedCostCents = await estimateOperationCost(goal);
  const hasFunds = await creditManager.hasSufficientBalance(
    userId,
    estimatedCostCents
  );

  if (hasFunds) {
    // Reserve estimated cost before operation
    const reservationId = await creditManager.reserveCredits(
      userId,
      estimatedCostCents
    );

    // Return platform API with billing context
    return {
      config: getPlatformProviderConfig(),
      billingContext: {
        reservationId,
        userId,
        estimatedCostCents
      },
      usingPlatformKey: true
    };
  }

  // 3. No credits - check for project API key
  const projectConfig = await getProjectAIProviderConfig(projectId);

  if (projectConfig?.api_key_secret_id) {
    // Use project's own API key (bypass billing)
    return {
      config: projectConfig,
      usingPlatformKey: false
    };
  }

  // 4. No options available
  throw new InsufficientCreditsError(
    'Free quota exceeded and no credits available. ' +
    'Please add credits or configure a project API key.'
  );
}

/**
 * Estimate operation cost based on historical averages
 */
async function estimateOperationCost(
  goal: 'evaluation' | 'implementation'
): Promise<number> {
  // Query average cost for this operation type
  const avgCost = await db.query(
    `SELECT AVG(calculated_cost_cents) as avg_cost
     FROM api_usage_metrics
     WHERE goal = $1
     AND created_at > NOW() - INTERVAL '30 days'
     AND calculated_cost_cents IS NOT NULL`,
    [goal]
  );

  // Fallback estimates if no data
  const fallbackCosts = {
    evaluation: 50,    // $0.50
    implementation: 200 // $2.00
  };

  const estimated = avgCost?.avg_cost || fallbackCosts[goal];

  // Add 20% buffer for safety
  return Math.ceil(estimated * 1.2);
}
```

---

## Phase 3: Payment Integration 💳

### 3.1 Stripe Integration

**File:** `packages/backend/services/payment-provider.ts`

```typescript
import Stripe from 'stripe';

export class PaymentProvider {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16'
    });
  }

  /**
   * Create payment intent for credit purchase
   */
  async createPaymentIntent(
    userId: string,
    amountCents: number,
    currency: string = 'USD'
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
    // Enforce minimum purchase
    if (amountCents < parseInt(process.env.MINIMUM_PURCHASE_CENTS || '500')) {
      throw new Error('Minimum purchase is $5.00');
    }

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountCents,
      currency: currency.toLowerCase(),
      metadata: {
        userId,
        type: 'credit_purchase'
      },
      automatic_payment_methods: {
        enabled: true
      }
    });

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id
    };
  }

  /**
   * Confirm payment and add credits
   */
  async handlePaymentSuccess(paymentIntentId: string): Promise<void> {
    const paymentIntent = await this.stripe.paymentIntents.retrieve(
      paymentIntentId
    );

    if (paymentIntent.status !== 'succeeded') {
      throw new Error('Payment not successful');
    }

    const { userId } = paymentIntent.metadata;
    const amountCents = paymentIntent.amount;

    // Add credits to user account
    await creditManager.addCredits(
      userId,
      amountCents,
      'purchase',
      { paymentIntentId }
    );

    // Send confirmation email
    await sendCreditPurchaseConfirmation(userId, amountCents);
  }

  /**
   * Save payment method for future use
   */
  async savePaymentMethod(
    userId: string,
    paymentMethodId: string,
    setAsDefault: boolean = false
  ): Promise<void> {
    const paymentMethod = await this.stripe.paymentMethods.retrieve(
      paymentMethodId
    );

    await db.query(
      `INSERT INTO payment_methods
       (user_id, provider, provider_payment_method_id, type,
        is_default, last_four, brand, exp_month, exp_year)
       VALUES ($1, 'stripe', $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        paymentMethodId,
        paymentMethod.type,
        setAsDefault,
        paymentMethod.card?.last4,
        paymentMethod.card?.brand,
        paymentMethod.card?.exp_month,
        paymentMethod.card?.exp_year
      ]
    );

    if (setAsDefault) {
      await this.setDefaultPaymentMethod(userId, paymentMethodId);
    }
  }

  /**
   * Process auto-recharge
   */
  async processAutoRecharge(
    userId: string,
    amountCents: number
  ): Promise<void> {
    // Get default payment method
    const paymentMethod = await db.query(
      `SELECT * FROM payment_methods
       WHERE user_id = $1 AND is_default = true
       LIMIT 1`,
      [userId]
    );

    if (!paymentMethod) {
      throw new Error('No default payment method found');
    }

    // Create and confirm payment intent
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      payment_method: paymentMethod.provider_payment_method_id,
      confirm: true,
      off_session: true,
      metadata: {
        userId,
        type: 'auto_recharge'
      }
    });

    if (paymentIntent.status === 'succeeded') {
      await creditManager.addCredits(
        userId,
        amountCents,
        'purchase',
        { paymentIntentId: paymentIntent.id, autoRecharge: true }
      );

      await sendAutoRechargeSuccessEmail(userId, amountCents);
    } else {
      await sendAutoRechargeFailedEmail(userId, amountCents);
      throw new Error('Auto-recharge payment failed');
    }
  }

  /**
   * Handle Stripe webhooks
   */
  async handleWebhook(
    body: any,
    signature: string
  ): Promise<Stripe.Event> {
    const event = this.stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object.id);
        break;

      case 'payment_intent.payment_failed':
        // Log failure, notify user
        logger.error('Payment failed', { event });
        break;

      case 'payment_method.attached':
        // Payment method saved
        break;

      default:
        logger.info('Unhandled webhook event', { type: event.type });
    }

    return event;
  }
}
```

---

### 3.2 API Endpoints

**File:** `packages/backend/handlers/billing.ts`

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * GET /api/billing/balance
 * Get current credit balance
 */
router.get('/balance', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const balance = await creditManager.getBalance(userId);

    res.json({
      success: true,
      data: balance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/billing/purchase
 * Create payment intent for credit purchase
 */
router.post('/purchase', authenticate, async (req, res) => {
  try {
    const { amountCents } = req.body;

    if (!amountCents || amountCents < 500) {
      return res.status(400).json({
        success: false,
        error: 'Minimum purchase is $5.00'
      });
    }

    const paymentIntent = await paymentProvider.createPaymentIntent(
      req.user!.id,
      amountCents
    );

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.clientSecret,
        paymentIntentId: paymentIntent.paymentIntentId
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/billing/transactions
 * Get transaction history
 */
router.get('/transactions', authenticate, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const transactions = await creditManager.getTransactions(
      req.user!.id,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/billing/usage
 * Get usage metrics with costs
 */
router.get('/usage', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, provider } = req.query;

    const usage = await getAggregatedUsageWithCosts(
      req.user!.id,
      startDate as string,
      endDate as string,
      provider as string
    );

    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/billing/payment-methods
 * Add payment method
 */
router.post('/payment-methods', authenticate, async (req, res) => {
  try {
    const { paymentMethodId, setAsDefault } = req.body;

    await paymentProvider.savePaymentMethod(
      req.user!.id,
      paymentMethodId,
      setAsDefault
    );

    res.json({
      success: true
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/billing/payment-methods
 * List payment methods
 */
router.get('/payment-methods', authenticate, async (req, res) => {
  try {
    const methods = await db.query(
      `SELECT id, type, last_four, brand, exp_month, exp_year, is_default
       FROM payment_methods
       WHERE user_id = $1`,
      [req.user!.id]
    );

    res.json({
      success: true,
      data: methods
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/billing/auto-recharge
 * Configure auto-recharge settings
 */
router.put('/auto-recharge', authenticate, async (req, res) => {
  try {
    const { enabled, thresholdCents, amountCents } = req.body;

    await db.query(
      `UPDATE user_credits
       SET auto_recharge_enabled = $1,
           auto_recharge_threshold_cents = $2,
           auto_recharge_amount_cents = $3,
           updated_at = NOW()
       WHERE user_id = $4`,
      [enabled, thresholdCents, amountCents, req.user!.id]
    );

    res.json({
      success: true
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/billing/webhooks/stripe
 * Stripe webhook handler
 */
router.post('/webhooks/stripe', async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'] as string;

    await paymentProvider.handleWebhook(req.body, signature);

    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook error', { error });
    res.status(400).json({
      error: 'Webhook processing failed'
    });
  }
});

export default router;
```

**Route Registration in `packages/backend/server.ts`:**

```typescript
import billingRoutes from './handlers/billing';

app.use('/api/billing', billingRoutes);
```

---

### 3.3 Environment Configuration

**Add to `.env`:**

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Billing Settings
MINIMUM_PURCHASE_CENTS=500
MINIMUM_BALANCE_CENTS=100
LOW_BALANCE_THRESHOLD_CENTS=1000
```

---

## Phase 4: Billing Workflow 🔄

### 4.1 Usage Billing Hook

**File:** `packages/backend/services/usage-billing.ts`

```typescript
/**
 * Called after each API usage metric is recorded
 * Calculates cost and charges user credits
 */
export async function billUsageMetric(metricId: string): Promise<void> {
  const metric = await findApiUsageMetricById(metricId);

  if (!metric) {
    throw new Error(`Usage metric not found: ${metricId}`);
  }

  // Skip if using project API key (not billable)
  if (metric.using_project_key) {
    await updateApiUsageMetric(metricId, {
      billing_status: 'not_billable'
    });
    return;
  }

  try {
    // Calculate cost based on provider pricing
    const costCents = await providerPricing.calculateUsageCost(metric);

    // Update metric with calculated cost
    await updateApiUsageMetric(metricId, {
      calculated_cost_cents: costCents,
      billing_status: 'calculated'
    });

    // Charge user credits
    if (metric.billing_reservation_id) {
      // Commit previously reserved credits
      await creditManager.commitReservedCredits(
        metric.billing_reservation_id,
        costCents
      );
    } else {
      // Direct deduction (legacy path)
      await creditManager.deductCredits(
        metric.user_id,
        costCents,
        metricId
      );
    }

    // Mark as billed
    await updateApiUsageMetric(metricId, {
      billing_status: 'billed'
    });

    // Check if auto-recharge needed
    await creditManager.checkAutoRecharge(metric.user_id);

    logger.info('Usage billed successfully', {
      metricId,
      userId: metric.user_id,
      costCents
    });

  } catch (error) {
    logger.error('Billing error', {
      metricId,
      error: error.message
    });

    // Mark as failed for retry
    await updateApiUsageMetric(metricId, {
      billing_status: 'failed'
    });

    throw error;
  }
}

/**
 * Retry failed billing attempts
 */
export async function retryFailedBilling(): Promise<void> {
  const failedMetrics = await db.query(
    `SELECT id FROM api_usage_metrics
     WHERE billing_status = 'failed'
     AND created_at > NOW() - INTERVAL '7 days'
     LIMIT 100`
  );

  for (const metric of failedMetrics) {
    try {
      await billUsageMetric(metric.id);
    } catch (error) {
      logger.error('Retry billing failed', {
        metricId: metric.id,
        error: error.message
      });
    }
  }
}
```

---

### 4.2 Integration with Pipeline Executor

**Update:** `packages/backend/worker-orchestration/pipeline-executor.ts`

```typescript
// After pipeline execution completes
async function handlePipelineCompletion(
  execution: PipelineExecution,
  billingContext?: BillingContext
): Promise<void> {

  // Create usage metric
  const metricId = await createApiUsageMetric({
    session_id: execution.session_id,
    task_id: execution.task_id,
    pipeline_execution_id: execution.id,
    provider: execution.provider,
    model: execution.model,
    input_tokens: execution.input_tokens,
    output_tokens: execution.output_tokens,
    cache_creation_input_tokens: execution.cache_creation_tokens,
    cache_read_input_tokens: execution.cache_read_tokens,
    ci_duration_seconds: execution.duration_seconds,
    goal: execution.goal,
    operation_phase: execution.phase,
    using_project_key: !billingContext,
    billing_reservation_id: billingContext?.reservationId
  });

  // Bill the usage
  if (billingContext) {
    try {
      await billUsageMetric(metricId);
    } catch (error) {
      // Release reservation if billing fails
      if (billingContext.reservationId) {
        await creditManager.releaseReservedCredits(
          billingContext.reservationId
        );
      }
      throw error;
    }
  }
}
```

---

### 4.3 Background Jobs

**File:** `packages/backend/jobs/billing-jobs.ts`

```typescript
import cron from 'node-cron';

/**
 * Daily: Finalize billing periods (runs at midnight UTC)
 */
cron.schedule('0 0 * * *', async () => {
  logger.info('Starting billing period finalization');

  try {
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);

    const activePeriods = await db.query(
      `SELECT * FROM billing_periods
       WHERE status = 'active'
       AND period_end <= $1`,
      [endDate]
    );

    for (const period of activePeriods) {
      // Calculate total cost for period
      const totalCost = await db.query(
        `SELECT SUM(calculated_cost_cents) as total
         FROM api_usage_metrics
         WHERE user_id = $1
         AND created_at >= $2
         AND created_at < $3
         AND billing_status = 'billed'`,
        [period.user_id, period.period_start, period.period_end]
      );

      // Finalize period
      await db.query(
        `UPDATE billing_periods
         SET status = 'finalized',
             calculated_cost_cents = $1,
             finalized_at = NOW()
         WHERE id = $2`,
        [totalCost.total || 0, period.id]
      );

      // Generate invoice/receipt
      await generateInvoice(period.id);

      logger.info('Billing period finalized', {
        periodId: period.id,
        userId: period.user_id,
        totalCost: totalCost.total
      });
    }

  } catch (error) {
    logger.error('Billing finalization error', { error });
  }
});

/**
 * Hourly: Process auto-recharges
 */
cron.schedule('0 * * * *', async () => {
  logger.info('Checking auto-recharges');

  try {
    const usersNeedingRecharge = await db.query(
      `SELECT * FROM user_credits
       WHERE auto_recharge_enabled = true
       AND balance_cents <= auto_recharge_threshold_cents`
    );

    for (const user of usersNeedingRecharge) {
      try {
        await paymentProvider.processAutoRecharge(
          user.user_id,
          user.auto_recharge_amount_cents
        );

        logger.info('Auto-recharge processed', {
          userId: user.user_id,
          amount: user.auto_recharge_amount_cents
        });

      } catch (error) {
        logger.error('Auto-recharge failed', {
          userId: user.user_id,
          error: error.message
        });

        // Send notification about failed auto-recharge
        await sendAutoRechargeFailedEmail(
          user.user_id,
          user.auto_recharge_amount_cents
        );
      }
    }

  } catch (error) {
    logger.error('Auto-recharge check error', { error });
  }
});

/**
 * Daily: Send low balance warnings (runs at 9am UTC)
 */
cron.schedule('0 9 * * *', async () => {
  logger.info('Checking low balances');

  try {
    const lowBalanceThreshold = parseInt(
      process.env.LOW_BALANCE_THRESHOLD_CENTS || '1000'
    );

    const usersLowBalance = await db.query(
      `SELECT * FROM user_credits
       WHERE balance_cents <= $1
       AND balance_cents > 0`,
      [lowBalanceThreshold]
    );

    for (const user of usersLowBalance) {
      await sendLowBalanceEmail(user.user_id, user.balance_cents);

      logger.info('Low balance alert sent', {
        userId: user.user_id,
        balance: user.balance_cents
      });
    }

  } catch (error) {
    logger.error('Low balance check error', { error });
  }
});

/**
 * Hourly: Retry failed billing
 */
cron.schedule('15 * * * *', async () => {
  logger.info('Retrying failed billing');

  try {
    await retryFailedBilling();
  } catch (error) {
    logger.error('Retry billing error', { error });
  }
});
```

---

## Phase 5: UI Components 🎨

### 5.1 Billing Dashboard Page

**File:** `packages/client/src/pages/BillingPage.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  TrendingUp,
  DollarSign,
  Settings
} from 'lucide-react';

export function BillingPage() {
  const [balance, setBalance] = useState<UserCredit | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [usage, setUsage] = useState<UsageMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBillingData();
  }, []);

  async function loadBillingData() {
    setLoading(true);

    try {
      const [balanceRes, transactionsRes, usageRes] = await Promise.all([
        fetch('/api/billing/balance'),
        fetch('/api/billing/transactions?limit=20'),
        fetch('/api/billing/usage')
      ]);

      setBalance(await balanceRes.json());
      setTransactions(await transactionsRes.json());
      setUsage(await usageRes.json());
    } catch (error) {
      console.error('Failed to load billing data', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="billing-page">
      <h1>Billing & Credits</h1>

      {/* Balance Card */}
      <div className="balance-card">
        <div className="balance-header">
          <DollarSign size={24} />
          <h2>Current Balance</h2>
        </div>

        <div className="balance-amount">
          ${(balance?.balanceCents || 0) / 100}
        </div>

        <div className="balance-details">
          <span>Available: ${(balance?.availableCents || 0) / 100}</span>
          <span>Reserved: ${(balance?.reservedCents || 0) / 100}</span>
        </div>

        <button onClick={() => openPurchaseModal()}>
          Add Credits
        </button>
      </div>

      {/* Usage Chart */}
      <div className="usage-chart">
        <h3>Usage Overview</h3>
        <UsageChart data={usage} />
      </div>

      {/* Transaction History */}
      <div className="transaction-history">
        <h3>Recent Transactions</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => (
              <tr key={tx.id}>
                <td>{formatDate(tx.created_at)}</td>
                <td>{tx.transaction_type}</td>
                <td>{tx.description}</td>
                <td className={tx.amount_cents > 0 ? 'positive' : 'negative'}>
                  {tx.amount_cents > 0 ? '+' : ''}
                  ${tx.amount_cents / 100}
                </td>
                <td>${tx.balance_after_cents / 100}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payment Methods */}
      <div className="payment-methods">
        <h3>Payment Methods</h3>
        <PaymentMethodList />
      </div>

      {/* Auto-Recharge Settings */}
      <div className="auto-recharge">
        <h3>Auto-Recharge</h3>
        <AutoRechargeSettings balance={balance} />
      </div>
    </div>
  );
}
```

---

### 5.2 Balance Indicator Component

**File:** `packages/client/src/components/BalanceIndicator.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { DollarSign, AlertTriangle } from 'lucide-react';

export function BalanceIndicator() {
  const [balance, setBalance] = useState<UserCredit | null>(null);

  useEffect(() => {
    loadBalance();

    // Refresh every 30 seconds
    const interval = setInterval(loadBalance, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadBalance() {
    try {
      const res = await fetch('/api/billing/balance');
      const data = await res.json();
      setBalance(data.data);
    } catch (error) {
      console.error('Failed to load balance', error);
    }
  }

  if (!balance) return null;

  const balanceDollars = balance.balanceCents / 100;
  const isLow = balance.balanceCents < 1000; // $10 threshold

  return (
    <div className={`balance-indicator ${isLow ? 'low' : ''}`}>
      {isLow && <AlertTriangle size={16} />}
      <DollarSign size={16} />
      <span>${balanceDollars.toFixed(2)}</span>

      <button
        className="add-credits-btn"
        onClick={() => window.location.href = '/billing'}
      >
        Add Credits
      </button>
    </div>
  );
}
```

---

### 5.3 Cost Estimator Component

**File:** `packages/client/src/components/CostEstimator.tsx`

```typescript
import React from 'react';
import { DollarSign } from 'lucide-react';

interface CostEstimatorProps {
  operationType: 'evaluation' | 'implementation';
  estimatedCents?: number;
  actualCents?: number;
}

export function CostEstimator({
  operationType,
  estimatedCents,
  actualCents
}: CostEstimatorProps) {

  if (!estimatedCents && !actualCents) {
    return null;
  }

  return (
    <div className="cost-estimator">
      <DollarSign size={16} />

      {actualCents ? (
        <div className="actual-cost">
          <span className="label">Cost:</span>
          <span className="amount">${(actualCents / 100).toFixed(4)}</span>
        </div>
      ) : (
        <div className="estimated-cost">
          <span className="label">Estimated cost:</span>
          <span className="amount">~${(estimatedCents! / 100).toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}
```

---

### 5.4 Purchase Credits Modal

**File:** `packages/client/src/components/PurchaseCreditsModal.tsx`

```typescript
import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.STRIPE_PUBLISHABLE_KEY!);

function PurchaseForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [amount, setAmount] = useState(1000); // $10 default
  const [processing, setProcessing] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!stripe || !elements) return;

    setProcessing(true);

    try {
      // Create payment intent
      const res = await fetch('/api/billing/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents: amount })
      });

      const { clientSecret } = await res.json();

      // Confirm payment
      const { error } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: window.location.origin + '/billing?success=true'
        }
      });

      if (error) {
        console.error('Payment failed', error);
        alert('Payment failed: ' + error.message);
      } else {
        onSuccess();
      }

    } catch (error) {
      console.error('Purchase error', error);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Amount (minimum $5.00):
        <input
          type="number"
          min="5"
          step="0.01"
          value={amount / 100}
          onChange={e => setAmount(Math.round(parseFloat(e.target.value) * 100))}
        />
      </label>

      <PaymentElement />

      <button type="submit" disabled={processing || !stripe}>
        {processing ? 'Processing...' : `Purchase $${(amount / 100).toFixed(2)}`}
      </button>
    </form>
  );
}

export function PurchaseCreditsModal({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="modal">
      <div className="modal-content">
        <h2>Add Credits</h2>

        <Elements stripe={stripePromise}>
          <PurchaseForm onSuccess={onClose} />
        </Elements>

        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
```

---

## Phase 6: Testing & Rollout ✅

### 6.1 Unit Tests

**File:** `packages/backend/__tests__/credit-manager.test.ts`

```typescript
import { CreditManager } from '../services/credit-manager';

describe('CreditManager', () => {
  let creditManager: CreditManager;
  const testUserId = 'test-user-123';

  beforeEach(async () => {
    creditManager = new CreditManager();
    await setupTestDatabase();
  });

  test('reserves credits correctly', async () => {
    await creditManager.addCredits(testUserId, 1000, 'bonus');

    const reservationId = await creditManager.reserveCredits(testUserId, 500);

    const balance = await creditManager.getBalance(testUserId);
    expect(balance.balanceCents).toBe(1000);
    expect(balance.reservedCents).toBe(500);
    expect(balance.availableCents).toBe(500);
  });

  test('commits reserved credits', async () => {
    await creditManager.addCredits(testUserId, 1000, 'bonus');
    const reservationId = await creditManager.reserveCredits(testUserId, 500);

    await creditManager.commitReservedCredits(reservationId, 400);

    const balance = await creditManager.getBalance(testUserId);
    expect(balance.balanceCents).toBe(600);
    expect(balance.reservedCents).toBe(0);
  });

  test('prevents double-charging', async () => {
    await creditManager.addCredits(testUserId, 1000, 'bonus');
    const reservationId = await creditManager.reserveCredits(testUserId, 500);

    await creditManager.commitReservedCredits(reservationId, 400);

    // Attempt to commit again should fail
    await expect(
      creditManager.commitReservedCredits(reservationId, 400)
    ).rejects.toThrow('Reservation not found');
  });

  test('handles concurrent reservations', async () => {
    await creditManager.addCredits(testUserId, 1000, 'bonus');

    const [res1, res2] = await Promise.all([
      creditManager.reserveCredits(testUserId, 600),
      creditManager.reserveCredits(testUserId, 600)
    ]);

    // One should succeed, one should fail
    expect(res1 || res2).toBeTruthy();
    // Check that total reserved doesn't exceed balance
    const balance = await creditManager.getBalance(testUserId);
    expect(balance.reservedCents).toBeLessThanOrEqual(1000);
  });

  test('triggers auto-recharge at threshold', async () => {
    await db.query(
      `UPDATE user_credits
       SET auto_recharge_enabled = true,
           auto_recharge_threshold_cents = 500,
           auto_recharge_amount_cents = 1000,
           balance_cents = 600
       WHERE user_id = $1`,
      [testUserId]
    );

    // Deduct credits to trigger threshold
    await creditManager.deductCredits(testUserId, 200, 'test-metric');

    await creditManager.checkAutoRecharge(testUserId);

    // Verify auto-recharge was triggered (mock payment provider)
    // This would actually be tested with a mock
  });
});
```

---

**File:** `packages/backend/__tests__/provider-pricing.test.ts`

```typescript
import { ProviderPricingService } from '../services/provider-pricing';

describe('ProviderPricingService', () => {
  let pricingService: ProviderPricingService;

  beforeEach(() => {
    pricingService = new ProviderPricingService();
  });

  test('calculates Anthropic costs correctly', async () => {
    const metric = {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      input_tokens: 1_000_000,
      output_tokens: 500_000,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0
    };

    const cost = await pricingService.calculateUsageCost(metric);

    // $3.00 for 1M input + $7.50 for 500K output = $10.50
    expect(cost).toBe(1050); // 1050 cents
  });

  test('calculates cache pricing correctly', async () => {
    const metric = {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      input_tokens: 0,
      output_tokens: 500_000,
      cache_creation_input_tokens: 1_000_000,
      cache_read_input_tokens: 2_000_000
    };

    const cost = await pricingService.calculateUsageCost(metric);

    // $3.75 cache write + $0.60 cache read + $7.50 output = $11.85
    expect(cost).toBe(1185);
  });

  test('calculates Google costs correctly', async () => {
    const metric = {
      provider: 'google',
      model: 'gemini-1.5-pro',
      input_tokens: 1_000_000,
      output_tokens: 500_000
    };

    const cost = await pricingService.calculateUsageCost(metric);

    // $1.25 for 1M input + $2.50 for 500K output = $3.75
    expect(cost).toBe(375);
  });
});
```

---

### 6.2 Integration Tests

**File:** `packages/backend/__tests__/billing-integration.test.ts`

```typescript
describe('Billing Integration', () => {
  test('end-to-end billing flow', async () => {
    const userId = 'test-user';
    const projectId = 'test-project';

    // 1. Purchase credits
    await creditManager.addCredits(userId, 5000, 'purchase');

    // 2. Select provider (should use platform with billing)
    const { config, billingContext } = await selectProviderWithBilling(
      userId,
      projectId,
      'evaluation'
    );

    expect(billingContext).toBeDefined();
    expect(billingContext!.reservationId).toBeTruthy();

    // 3. Simulate execution
    const metricId = await createApiUsageMetric({
      user_id: userId,
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      input_tokens: 100_000,
      output_tokens: 50_000,
      billing_reservation_id: billingContext!.reservationId
    });

    // 4. Bill usage
    await billUsageMetric(metricId);

    // 5. Verify charge
    const balance = await creditManager.getBalance(userId);
    expect(balance.balanceCents).toBeLessThan(5000);
    expect(balance.reservedCents).toBe(0);

    // 6. Verify metric updated
    const metric = await findApiUsageMetricById(metricId);
    expect(metric.billing_status).toBe('billed');
    expect(metric.calculated_cost_cents).toBeGreaterThan(0);
  });

  test('auto-recharge triggers correctly', async () => {
    const userId = 'test-user';

    // Setup auto-recharge
    await db.query(
      `UPDATE user_credits
       SET auto_recharge_enabled = true,
           auto_recharge_threshold_cents = 1000,
           auto_recharge_amount_cents = 2000,
           balance_cents = 1500
       WHERE user_id = $1`,
      [userId]
    );

    // Mock payment provider
    const mockPayment = jest.spyOn(paymentProvider, 'processAutoRecharge')
      .mockResolvedValue();

    // Deduct to trigger threshold
    await creditManager.deductCredits(userId, 600, 'test');
    await creditManager.checkAutoRecharge(userId);

    expect(mockPayment).toHaveBeenCalledWith(userId, 2000);
  });
});
```

---

### 6.3 Rollout Strategy

#### Stage 1: Internal Beta (Week 1-2)
- **Audience:** Admin users only
- **Credit Amount:** $5-$10 test credits
- **Monitoring:** Close monitoring of all transactions
- **Goals:**
  - Verify billing accuracy
  - Test payment flow
  - Identify edge cases

#### Stage 2: Opt-in Beta (Week 3-4)
- **Audience:** Users who opt-in to paid tier
- **Incentive:** $5 free credits for early adopters
- **Features:**
  - Full billing dashboard
  - Auto-recharge (optional)
  - Email notifications
- **Goals:**
  - Gather user feedback
  - Monitor conversion rates
  - Optimize UX

#### Stage 3: General Availability (Week 5+)
- **Audience:** All users
- **Marketing:**
  - Blog post announcement
  - Email campaign
  - In-app notifications
- **Documentation:**
  - Pricing guide
  - FAQ
  - Billing support docs
- **Support:**
  - Dedicated billing support channel
  - Refund policy documentation

---

## Phase 7: Monitoring & Alerts 📊

### 7.1 Key Metrics to Track

**Revenue Metrics:**
```typescript
// Daily revenue
SELECT
  DATE(created_at) as date,
  SUM(amount_cents) / 100 as daily_revenue
FROM credit_transactions
WHERE transaction_type = 'purchase'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

// Average purchase amount
SELECT
  AVG(amount_cents) / 100 as avg_purchase
FROM credit_transactions
WHERE transaction_type = 'purchase';

// Conversion rate (free → paid)
SELECT
  COUNT(DISTINCT CASE WHEN lifetime_spent_cents > 0 THEN user_id END) * 100.0 /
  COUNT(DISTINCT user_id) as conversion_rate
FROM user_credits;
```

**Usage Metrics:**
```typescript
// Credits consumed per day
SELECT
  DATE(created_at) as date,
  SUM(ABS(amount_cents)) / 100 as daily_consumption
FROM credit_transactions
WHERE transaction_type = 'usage'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at);

// Average cost per operation
SELECT
  goal,
  AVG(calculated_cost_cents) / 100 as avg_cost
FROM api_usage_metrics
WHERE calculated_cost_cents IS NOT NULL
GROUP BY goal;

// Provider distribution
SELECT
  provider,
  COUNT(*) as usage_count,
  SUM(calculated_cost_cents) / 100 as total_cost
FROM api_usage_metrics
WHERE billing_status = 'billed'
GROUP BY provider;
```

---

### 7.2 Alerting Configuration

**File:** `packages/backend/monitoring/alerts.ts`

```typescript
import { logger } from '../utils/logger';

/**
 * Check for payment processing errors
 */
export async function checkPaymentErrors() {
  const recentErrors = await db.query(
    `SELECT COUNT(*) as error_count
     FROM payment_logs
     WHERE status = 'failed'
     AND created_at > NOW() - INTERVAL '1 hour'`
  );

  if (recentErrors.error_count > 10) {
    await sendAlert({
      severity: 'high',
      title: 'High Payment Failure Rate',
      message: `${recentErrors.error_count} payment failures in the last hour`,
      channel: 'ops'
    });
  }
}

/**
 * Check for unusual cost spikes
 */
export async function checkCostSpikes() {
  const avgCost = await db.query(
    `SELECT AVG(calculated_cost_cents) as avg_cost
     FROM api_usage_metrics
     WHERE created_at > NOW() - INTERVAL '7 days'`
  );

  const recentCost = await db.query(
    `SELECT AVG(calculated_cost_cents) as avg_cost
     FROM api_usage_metrics
     WHERE created_at > NOW() - INTERVAL '1 hour'`
  );

  if (recentCost.avg_cost > avgCost.avg_cost * 2) {
    await sendAlert({
      severity: 'medium',
      title: 'Cost Spike Detected',
      message: `Recent costs are 2x higher than average`,
      channel: 'ops'
    });
  }
}

/**
 * Check for users with negative balance attempts
 */
export async function checkNegativeBalanceAttempts() {
  const attempts = await db.query(
    `SELECT user_id, COUNT(*) as attempt_count
     FROM billing_errors
     WHERE error_type = 'insufficient_credits'
     AND created_at > NOW() - INTERVAL '1 hour'
     GROUP BY user_id
     HAVING COUNT(*) > 5`
  );

  if (attempts.length > 0) {
    await sendAlert({
      severity: 'low',
      title: 'Frequent Insufficient Credit Errors',
      message: `${attempts.length} users hitting credit limits repeatedly`,
      channel: 'support'
    });
  }
}

/**
 * Monitor auto-recharge failures
 */
export async function checkAutoRechargeFailures() {
  const failures = await db.query(
    `SELECT COUNT(*) as failure_count
     FROM payment_logs
     WHERE type = 'auto_recharge'
     AND status = 'failed'
     AND created_at > NOW() - INTERVAL '24 hours'`
  );

  if (failures.failure_count > 20) {
    await sendAlert({
      severity: 'medium',
      title: 'High Auto-Recharge Failure Rate',
      message: `${failures.failure_count} auto-recharge failures in 24 hours`,
      channel: 'ops'
    });
  }
}
```

---

## File Structure Summary

```
packages/
├── db/
│   ├── user-credits.ts                  [NEW] Credit CRUD operations
│   ├── credit-transactions.ts           [NEW] Transaction ledger
│   ├── provider-pricing.ts              [NEW] Pricing config operations
│   ├── billing-periods.ts               [NEW] Billing period management
│   ├── payment-methods.ts               [NEW] Payment method CRUD
│   └── api-usage-metrics.ts             [UPDATE] Add cost calculations
│
├── backend/
│   ├── services/
│   │   ├── credit-manager.ts            [NEW] Core credit logic
│   │   ├── provider-pricing.ts          [NEW] Cost calculation engine
│   │   ├── payment-provider.ts          [NEW] Stripe integration
│   │   ├── usage-billing.ts             [NEW] Billing workflow
│   │   └── ai-provider-selector.ts      [UPDATE] Add billing logic
│   │
│   ├── handlers/
│   │   └── billing.ts                   [NEW] Billing API endpoints
│   │
│   ├── jobs/
│   │   └── billing-jobs.ts              [NEW] Cron jobs for billing
│   │
│   ├── monitoring/
│   │   └── alerts.ts                    [NEW] Alerting system
│   │
│   └── server.ts                        [UPDATE] Register billing routes
│
├── client/
│   └── src/
│       ├── pages/
│       │   └── BillingPage.tsx          [NEW] Billing dashboard
│       │
│       └── components/
│           ├── BalanceIndicator.tsx     [NEW] Header balance display
│           ├── CostEstimator.tsx        [NEW] Operation cost preview
│           ├── PurchaseCreditsModal.tsx [NEW] Credit purchase UI
│           ├── PaymentMethodList.tsx    [NEW] Payment method mgmt
│           └── AutoRechargeSettings.tsx [NEW] Auto-recharge config
│
├── types/
│   └── billing.ts                       [NEW] Billing type definitions
│
└── api-contracts/
    └── billing.ts                       [NEW] API contracts

migrations/
├── 20251121000001_create_billing_tables.up.sql
├── 20251121000002_enhance_usage_tracking.up.sql
└── 20251121000003_seed_provider_pricing.up.sql

tests/
├── backend/
│   ├── credit-manager.test.ts           [NEW] Credit manager tests
│   ├── provider-pricing.test.ts         [NEW] Pricing service tests
│   ├── billing-integration.test.ts      [NEW] E2E billing tests
│   └── payment-provider.test.ts         [NEW] Stripe integration tests
│
└── client/
    ├── BillingPage.test.tsx             [NEW] UI component tests
    └── PurchaseCreditsModal.test.tsx    [NEW] Payment UI tests
```

---

## Timeline & Resources

### Estimated Timeline

| Phase | Duration | Engineer Days | Dependencies |
|-------|----------|---------------|--------------|
| **Phase 1:** Database Schema | 2 days | 2 days | None |
| **Phase 2:** Pricing Engine | 3 days | 3 days | Phase 1 complete |
| **Phase 3:** Payment Integration | 5 days | 5 days | Phase 1-2 complete |
| **Phase 4:** Billing Workflow | 4 days | 4 days | Phase 1-3 complete |
| **Phase 5:** UI Components | 5 days | 5 days | Phase 1-4 complete |
| **Phase 6:** Testing | 4 days | 4 days | All phases complete |
| **Phase 7:** Monitoring & Alerts | 2 days | 2 days | Phase 3-4 complete |
| **Documentation & Rollout** | 3 days | 3 days | All phases complete |

**Total Estimated Time:** 28 engineer days (~4 weeks with 1 developer)

---

### Team Recommendations

**Minimum Team:**
- 1 Full-stack engineer (backend + frontend)
- 1 Product manager (part-time for rollout)

**Optimal Team:**
- 1 Backend engineer (database, billing logic, Stripe)
- 1 Frontend engineer (UI components, billing dashboard)
- 1 QA engineer (testing, integration tests)
- 1 Product manager (requirements, rollout strategy)

---

## Security Considerations 🔒

### 1. Credit Reservation Race Conditions
- **Solution:** Use database row-level locking (`FOR UPDATE`)
- **Implementation:** PostgreSQL transactions with exclusive locks
- **Testing:** Concurrent reservation tests

### 2. Webhook Verification
- **Solution:** Always verify Stripe webhook signatures
- **Implementation:** `stripe.webhooks.constructEvent()`
- **Monitoring:** Log all failed signature verifications

### 3. PCI Compliance
- **Solution:** Never store raw credit card data
- **Implementation:** Use Stripe Payment Elements (tokenization)
- **Audit:** Regular security audits

### 4. Rate Limiting
- **Solution:** Rate limit credit purchase endpoints
- **Implementation:** Express rate limiter middleware
- **Limits:** 10 purchases per hour per user

### 5. Audit Logging
- **Solution:** Immutable transaction ledger
- **Implementation:** `credit_transactions` table with no updates
- **Retention:** 7 years for compliance

### 6. Refund Policy
- **Solution:** Clear refund mechanism
- **Implementation:** Admin endpoint for refunds with approval
- **Documentation:** Public refund policy

### 7. Spending Limits
- **Solution:** Allow users to set maximum daily/monthly spend
- **Implementation:** Add spend limit columns to `user_credits`
- **Enforcement:** Check before each reservation

### 8. Fraud Detection
- **Solution:** Monitor for unusual purchase patterns
- **Implementation:** Alert on >$100 purchases from new accounts
- **Action:** Manual review process

---

## Cost Optimization Tips 💡

### For Users

**1. Leverage Prompt Caching**
- **Savings:** 90% reduction ($3.00 → $0.30 per 1M tokens)
- **How:** Reuse prompts across evaluations
- **UI:** Show cache hit rates in dashboard

**2. Choose Appropriate Models**
- **Comparison:**
  - Claude 3.5 Sonnet: $3-15/1M tokens (best quality)
  - Gemini 1.5 Pro: $1.25-5/1M tokens (good value)
  - Gemini 1.5 Flash: $0.075-0.30/1M tokens (fastest/cheapest)
- **Recommendation:** Route simple tasks to cheaper models

**3. Batch Operations**
- **Savings:** Reduce per-operation overhead
- **How:** Group multiple evaluations in one pipeline
- **Implementation:** Batch evaluation API

**4. Set Spending Alerts**
- **Feature:** Email when approaching daily/monthly limit
- **Configuration:** User-defined thresholds
- **Action:** Pause operations at hard limit

---

### For Platform

**1. Volume Discounts**
- **Negotiate:** Bulk pricing with Anthropic/Google
- **Pass savings:** Offer tiered pricing for high-volume users

**2. Smart Routing**
- **Strategy:** Route to cheapest provider that meets requirements
- **Implementation:** Provider selection algorithm
- **Savings:** 30-50% on average

**3. Cache Optimization**
- **Encourage:** Reward users who leverage caching
- **Incentive:** Bonus credits for high cache hit rates

---

## Next Steps

### Immediate Actions (Week 1)

1. **Database Setup**
   - Create migration files
   - Run migrations in development
   - Seed provider pricing data

2. **Core Services**
   - Implement `CreditManager` class
   - Implement `ProviderPricingService`
   - Update `ai-provider-selector.ts`

3. **Testing Setup**
   - Set up test database
   - Write unit tests for credit manager
   - Set up Stripe test account

---

### Short-term Goals (Weeks 2-3)

1. **Payment Integration**
   - Complete Stripe integration
   - Build billing API endpoints
   - Implement webhook handlers

2. **UI Development**
   - Build billing dashboard
   - Create balance indicator
   - Implement purchase modal

3. **Background Jobs**
   - Set up cron jobs
   - Implement billing finalization
   - Configure auto-recharge

---

### Long-term Goals (Month 2+)

1. **Advanced Features**
   - Usage analytics dashboard
   - Predictive cost estimation
   - Budget management tools
   - Team/organization billing

2. **Optimization**
   - Smart provider routing
   - Cache optimization
   - Volume discounts

3. **Expansion**
   - Support more providers (Azure, AWS)
   - International payment methods
   - Multi-currency support

---

## Conclusion

This implementation plan provides a comprehensive roadmap for adding paid usage of platform API keys to your application. The plan builds on your existing infrastructure (quota system, usage tracking, cost calculation) and adds the missing pieces (billing, payments, credit management).

**Key Benefits:**
- ✅ Seamless transition from free tier to paid usage
- ✅ Flexible payment options (one-time purchase, auto-recharge)
- ✅ Transparent cost tracking and billing
- ✅ Secure payment processing via Stripe
- ✅ Comprehensive monitoring and alerting

**Success Criteria:**
- Billing accuracy: 99.9% correct charges
- Payment success rate: >95%
- User satisfaction: Clear, transparent billing
- Revenue growth: Smooth free-to-paid conversion

---

**Questions or Concerns?**

Feel free to adjust priorities, timelines, or features based on your specific needs. This plan is designed to be flexible and can be implemented in phases as needed.
