# Comprehensive Refactoring Plan: Code Duplications & KISS/DRY Violations

**Plan ID:** REFACTOR-2025-001
**Created:** 2025-11-21
**Status:** Ready for Implementation
**Estimated Total Time:** 80 hours (2 weeks, 1 developer)
**Expected Impact:** Eliminate 5,000+ lines of duplicated code

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Phase 1: Quick Wins (Week 1)](#phase-1-quick-wins-week-1)
4. [Phase 2: Database Abstraction (Week 2)](#phase-2-database-abstraction-week-2)
5. [Phase 3: Backend Handlers (Week 2-3)](#phase-3-backend-handlers-week-2-3)
6. [Phase 4: Frontend Components (Week 3-4)](#phase-4-frontend-components-week-3-4)
7. [Phase 5: Microservices & Complex Code (Week 5)](#phase-5-microservices--complex-code-week-5)
8. [Testing Strategy](#testing-strategy)
9. [Rollback Plan](#rollback-plan)

---

## Overview

This plan addresses the elimination of 5,000+ lines of duplicated code across 54+ files, organized into 5 phases that can be executed incrementally with minimal risk.

### Success Criteria

- ✅ Reduce code duplication from 14% to <2%
- ✅ All existing tests pass
- ✅ No breaking changes to public APIs
- ✅ Improved maintainability metrics
- ✅ Documentation updated

### Principles

1. **Test first:** Write tests before refactoring
2. **Incremental:** Each task is independently deployable
3. **Backward compatible:** No breaking changes
4. **Verified:** Each step includes verification steps

---

## Prerequisites

### Before Starting Any Phase

1. **Create feature branch:**
   ```
   git checkout -b refactor/eliminate-duplications
   ```

2. **Verify baseline:**
   - Run all tests: `npm test`
   - Build all packages: `npm run build`
   - Run type checking: `npm run typecheck`
   - Ensure all pass

3. **Set up tracking:**
   - Create tracking issue in your issue tracker
   - Link this plan document
   - Set up code review process

---

## Phase 1: Quick Wins (Week 1)

**Goal:** Eliminate 500+ lines with minimal risk
**Time:** 8 hours
**Risk:** LOW

### Task 1.1: Extract Database `get` Helper

**Impact:** 24 lines saved across 8 files
**Time:** 30 minutes
**Risk:** LOW

#### Context Loading Strategy:
1. Read `/packages/db/utils.ts` to understand existing utilities
2. Read one example file: `/packages/db/sessions.ts` (lines 1-20) to see current usage
3. Grep for `function get<T extends readonly MaybeRow[]>` to find all instances

#### Instructions:

1. **Understand current state:**
   - Search for all files containing `function get<T extends readonly MaybeRow[]>`
   - Note that it appears in: sessions.ts, tasks.ts, projects.ts, messages.ts, pipeline-executions.ts, api-keys.ts, secrets.ts, file-spaces.ts

2. **Create shared utility:**
   - Open `/packages/db/utils.ts`
   - Check if `get` function already exists
   - If not, add the function to utils.ts
   - Export it from the file

3. **Update imports in each file:**
   - For each of the 8 files listed above:
     - Remove the local `get` function definition (lines 5-7 or 6-8)
     - Add import: `import { get } from './utils'` at the top
     - Verify no other changes needed

4. **Verification:**
   - Run: `npm run typecheck` in packages/db
   - Run: `npm test` for database tests
   - Search for remaining instances of `function get<T` to ensure none remain

#### Files to Modify:
- `/packages/db/utils.ts` (add function)
- `/packages/db/sessions.ts` (remove function, add import)
- `/packages/db/tasks.ts` (remove function, add import)
- `/packages/db/projects.ts` (remove function, add import)
- `/packages/db/messages.ts` (remove function, add import)
- `/packages/db/pipeline-executions.ts` (remove function, add import)
- `/packages/db/api-keys.ts` (remove function, add import)
- `/packages/db/secrets.ts` (remove function, add import)
- `/packages/db/file-spaces.ts` (remove function, add import)

---

### Task 1.2: Extract Task Query Builders

**Impact:** 179 lines saved
**Time:** 3 hours
**Risk:** MEDIUM (complex logic)

#### Context Loading Strategy:
1. Read `/packages/db/tasks.ts` lines 32-111 (first function)
2. Read `/packages/db/tasks.ts` lines 113-211 (second function)
3. Compare the two to identify exact duplications
4. Read `/packages/db/utils.ts` to see where to place new functions

#### Instructions:

1. **Analyze the duplication:**
   - Identify that `findTasksWithFilters` (lines 32-111) and `findTasksWithFiltersPaginated` (lines 113-211) share identical WHERE and ORDER BY building logic
   - WHERE clause building: lines 36-58 vs 117-139 (identical)
   - ORDER BY building: lines 61-106 vs 147-192 (identical)

2. **Create helper function for WHERE clause:**
   - Add new function `buildTaskWhereClause` in tasks.ts (or utils.ts)
   - Accept parameters: `project_id`, `task_source_id`, `evaluated_only`, `search`
   - Return: `{ whereClause: string, params: any[] }`
   - Extract the logic from lines 36-58

3. **Create helper function for ORDER BY clause:**
   - Add new function `buildTaskOrderByClause` in tasks.ts (or utils.ts)
   - Accept parameter: `sort_by`
   - Return: `string` (the ORDER BY clause)
   - Extract the switch statement from lines 61-106

4. **Refactor findTasksWithFilters:**
   - Replace lines 36-58 with call to `buildTaskWhereClause()`
   - Replace lines 61-106 with call to `buildTaskOrderByClause()`
   - Keep rest of function unchanged

5. **Refactor findTasksWithFiltersPaginated:**
   - Replace lines 117-139 with call to `buildTaskWhereClause()`
   - Replace lines 147-192 with call to `buildTaskOrderByClause()`
   - Keep pagination logic unchanged

6. **Verification:**
   - Write tests for the two new helper functions
   - Run existing tests to ensure behavior unchanged
   - Test with different sort options
   - Test with various filter combinations

#### Files to Modify:
- `/packages/db/tasks.ts` (add 2 helper functions, refactor 2 existing functions)

#### Testing Focus:
- Test all sort_by options: 'created_desc', 'created_asc', 'quick_win_desc', 'quick_win_asc', 'complexity_asc', 'complexity_desc'
- Test all filter combinations
- Test pagination edge cases

---

### Task 1.3: Extract getUserId Function

**Impact:** 26 lines saved across 2 files
**Time:** 1 hour
**Risk:** LOW (but security-critical)

#### Context Loading Strategy:
1. Read `/packages/backend/handlers/projects.ts` lines 37-62
2. Read `/packages/backend/handlers/task-sources.ts` lines 25-50
3. Check if `/packages/backend/utils/` exists, if not check other util locations
4. Read `/packages/backend/config.ts` to understand CLERK_SECRET_KEY usage

#### Instructions:

1. **Verify duplication:**
   - Compare the two getUserId implementations
   - Confirm they are identical (they should be)

2. **Create auth utilities module:**
   - Check if `/packages/backend/utils/auth.ts` exists
   - If not, create it
   - If utils directory doesn't exist, create `/packages/backend/utils/`

3. **Extract the function:**
   - Copy getUserId function from projects.ts
   - Modify signature to accept `authHeader: string | null` directly
   - Add necessary imports (verifyToken from @clerk/backend, logger, CLERK_SECRET_KEY)
   - Export as `getUserIdFromClerkToken`

4. **Update projects.ts:**
   - Import the new function: `import { getUserIdFromClerkToken } from '../utils/auth'`
   - Replace the local getUserId function with wrapper:
     ```
     async function getUserId(ctx: HandlerContext<any, any, any>): Promise<string> {
       return getUserIdFromClerkToken(ctx.headers.get('Authorization'))
     }
     ```
   - Or directly call it in each handler

5. **Update task-sources.ts:**
   - Same process as projects.ts

6. **Verification:**
   - Test authentication with valid token
   - Test with missing Authorization header
   - Test with invalid token
   - Test with malformed token
   - Ensure error messages are clear

#### Files to Modify:
- `/packages/backend/utils/auth.ts` (create or modify)
- `/packages/backend/handlers/projects.ts` (update)
- `/packages/backend/handlers/task-sources.ts` (update)

---

### Task 1.4: Extract requireProjectAccess Helper

**Impact:** 48+ lines saved across 14 call sites
**Time:** 1 hour
**Risk:** LOW (but security-critical)

#### Context Loading Strategy:
1. Read `/packages/backend/utils/auth.ts` (from previous task)
2. Read `/packages/backend/handlers/projects.ts` lines 83-86 (one example)
3. Grep for `hasProjectAccess` to find all usage locations
4. Read `/packages/db/user-access.ts` to understand the access check API

#### Instructions:

1. **Find all occurrences:**
   - Search for pattern: `hasProjectAccess(sql, userId, id)` or similar
   - Note all locations (should be ~14 instances in projects.ts and task-sources.ts)

2. **Add to auth utilities:**
   - Open `/packages/backend/utils/auth.ts` (created in previous task)
   - Add new exported function `requireProjectAccess`
   - Accept parameters: `sql: Sql, userId: string, projectId: string`
   - Call `userAccessQueries.hasProjectAccess`
   - Throw error if access denied
   - Import necessary types and functions

3. **Replace in projects.ts:**
   - Import the new function
   - Find all instances of the pattern (lines 83-86, 100-103, 115-118, etc.)
   - Replace each with single line call to `requireProjectAccess`
   - Maintain same error message for consistency

4. **Replace in task-sources.ts:**
   - Same process as projects.ts
   - Find instances (lines 87-90, 104-107, 119-122, 136-139)

5. **Verification:**
   - Test with user who has access (should work)
   - Test with user who doesn't have access (should get Forbidden error)
   - Test with non-existent project ID
   - Ensure error messages match previous behavior

#### Files to Modify:
- `/packages/backend/utils/auth.ts` (add function)
- `/packages/backend/handlers/projects.ts` (14 replacements)
- `/packages/backend/handlers/task-sources.ts` (4 replacements)

---

### Task 1.5: Use Existing useFetchData Hook

**Impact:** 100+ lines saved across 15 files
**Time:** 2 hours
**Risk:** LOW

#### Context Loading Strategy:
1. Read `/packages/client/src/hooks/useFetchData.ts` to understand the existing hook
2. Read one example page that manually manages loading state
3. Identify pattern to replace across all pages

#### Instructions:

1. **Understand the existing hook:**
   - Read `/packages/client/src/hooks/useFetchData.ts`
   - Note its API: what it accepts, what it returns
   - Check if it needs any modifications for current use cases

2. **Find all manual loading patterns:**
   - Search for `const [loading, setLoading] = useState(true)` in `/packages/client/src/`
   - List all page files that manually manage loading state
   - Should find ~15 files

3. **For each page file:**
   - Read the current loading logic
   - Identify the fetch function
   - Replace manual state management with `useFetchData` hook
   - Update loading/error rendering to use hook's return values

4. **Pattern to replace:**
   - OLD: Manual useState for loading, error, data + useEffect
   - NEW: Single useFetchData call

5. **Verification:**
   - Test each updated page
   - Verify loading state displays correctly
   - Verify error handling works
   - Verify data loads successfully
   - Check for any regressions

#### Files to Modify:
- Approximately 15 page files in `/packages/client/src/pages/`
- May need minor updates to `/packages/client/src/hooks/useFetchData.ts` if API needs adjustment

#### Alternative Approach:
If `useFetchData` doesn't fit all use cases:
- Create a new hook `usePageData` that better matches the pattern
- Then migrate all pages to use it

---

## Phase 2: Database Abstraction (Week 2)

**Goal:** Eliminate 400+ lines of database CRUD duplication
**Time:** 16 hours
**Risk:** MEDIUM (touches core data layer)

### Task 2.1: Create Generic findOneById Utility

**Impact:** 56 lines saved across 8 files
**Time:** 4 hours
**Risk:** MEDIUM

#### Context Loading Strategy:
1. Read `/packages/db/utils.ts` to see current utilities
2. Read `/packages/db/sessions.ts` lines 13-20 (example findById)
3. Read several other findById implementations to confirm pattern
4. Read `/packages/utils/exceptions.ts` to understand NotFoundException

#### Instructions:

1. **Analyze the pattern:**
   - Read findSessionById, findTaskById, findProjectById, etc.
   - Confirm they all follow same structure:
     - Query by ID
     - Get first result
     - Throw NotFoundException if not found
     - Return the result

2. **Design the generic function:**
   - Function name: `findOneById`
   - Type parameter: `<T>` for the return type
   - Parameters: `sql: Sql, table: string, id: string, entityName: string`
   - Return type: `Promise<T>`

3. **Implementation location:**
   - Add to `/packages/db/utils.ts`
   - Import necessary types from postgres and exceptions
   - Use the existing `get` helper (from Task 1.1)

4. **Handle table name safely:**
   - Use `sql(table)` or `sql.unsafe` appropriately to avoid SQL injection
   - Research postgres library's recommended way to parameterize table names

5. **Replace in each file:**
   - sessions.ts: Replace findSessionById implementation
   - tasks.ts: Replace findTaskById implementation
   - projects.ts: Replace findProjectById implementation
   - messages.ts: Replace findMessageById implementation
   - pipeline-executions.ts: Replace similar function
   - api-keys.ts: Replace similar function
   - secrets.ts: Replace similar function
   - file-spaces.ts: Replace similar function

6. **Consider edge cases:**
   - What if table name contains special characters?
   - What if ID is not a string (UUID vs integer)?
   - Should we support composite keys in the future?

7. **Write comprehensive tests:**
   - Test successful retrieval
   - Test not found scenario
   - Test with different entity types
   - Test SQL injection attempts in table name

#### Files to Modify:
- `/packages/db/utils.ts` (add generic function)
- 8 entity files in `/packages/db/` (replace implementations)

#### Testing Requirements:
- Unit tests for the generic function
- Integration tests with real database
- Verify all existing tests still pass

---

### Task 2.2: Create Generic deleteById Utility

**Impact:** 48 lines saved across 8 files
**Time:** 3 hours
**Risk:** MEDIUM (deletion is risky)

#### Context Loading Strategy:
1. Read `/packages/db/utils.ts` (updated from previous task)
2. Read `/packages/db/sessions.ts` lines 38-44 (example delete)
3. Read several other delete implementations
4. Check if any have special logic (cascades, soft deletes, etc.)

#### Instructions:

1. **Analyze the pattern:**
   - All follow: DELETE query, check count > 0, throw if not found
   - Check if any files have additional logic (audit logs, soft delete, etc.)

2. **Design the generic function:**
   - Function name: `deleteById`
   - Parameters: `sql: Sql, table: string, id: string, entityName: string`
   - Return type: `Promise<void>`

3. **Implementation:**
   - Add to `/packages/db/utils.ts`
   - Execute DELETE query
   - Check resultSet.count
   - Throw NotFoundException if count is 0

4. **Safety considerations:**
   - Ensure transactions are supported if needed
   - Consider if we should return the deleted entity
   - Think about cascade deletes

5. **Replace in each file:**
   - Replace all 8 delete functions with calls to generic version

6. **Write tests:**
   - Test successful deletion
   - Test deletion of non-existent entity
   - Test that related data is handled correctly (check foreign keys)

#### Files to Modify:
- `/packages/db/utils.ts` (add function)
- 8 entity files (replace delete functions)

#### Testing Requirements:
- Test deletion works
- Test error on non-existent ID
- Test database constraints are respected

---

### Task 2.3: Create Generic createOne Utility

**Impact:** 49 lines saved across 7 files
**Time:** 5 hours
**Risk:** HIGH (creation logic varies more)

#### Context Loading Strategy:
1. Read multiple create functions from different files
2. Compare them to identify variations
3. Understand the column filtering pattern (filterPresentColumns)
4. Read `/packages/db/utils.ts` to see filterPresentColumns implementation

#### Instructions:

1. **Analyze variations:**
   - Some use specific column arrays (e.g., createSessionCols)
   - Some use filterPresentColumns
   - Some have default values
   - Identify if a truly generic version is possible or if specialization needed

2. **Design approach:**
   - Option A: Fully generic with column array parameter
   - Option B: Keep specific implementations but extract common validation
   - Option C: Generic base + overridable hooks

3. **Recommended: Extract validation only:**
   - Create `validateCreatedEntity<T>` function
   - Accepts the result array from INSERT ... RETURNING
   - Throws error if first element is null/undefined
   - Returns the entity

4. **Update each create function:**
   - Keep the INSERT logic (as it varies)
   - Replace the validation pattern with call to helper

5. **Write tests:**
   - Test successful creation
   - Test validation catches null results
   - Test with different entity types

#### Files to Modify:
- `/packages/db/utils.ts` (add validation helper)
- 7 entity files (use validation helper)

#### Note:
This is less of a full abstraction and more of extracting the common validation pattern. Full abstraction may not be worth it due to variations in creation logic.

---

### Task 2.4: Create Generic updateOne Utility

**Impact:** 42 lines saved across 6 files
**Time:** 4 hours
**Risk:** HIGH (update logic varies significantly)

#### Context Loading Strategy:
1. Read several update functions
2. Note that each has different fields and logic
3. Identify only the common validation pattern
4. Similar to Task 2.3

#### Instructions:

1. **Analyze the pattern:**
   - Update logic varies widely (different fields per entity)
   - Common pattern: return first element, throw if null
   - Same as create validation

2. **Recommended approach:**
   - Same as Task 2.3: Extract only validation
   - Create `validateUpdatedEntity<T>` (or reuse validateCreatedEntity with better name)

3. **Alternative:**
   - Create `validateReturnedEntity<T>` that works for both create and update

4. **Update each function:**
   - Keep UPDATE logic intact
   - Replace validation with helper call

#### Files to Modify:
- `/packages/db/utils.ts` (if creating separate validator)
- 6 entity files (use validation helper)

---

## Phase 3: Backend Handlers (Week 2-3)

**Goal:** Eliminate 250+ lines in backend handlers
**Time:** 20 hours
**Risk:** MEDIUM (security-critical code)

### Task 3.1: Refactor OAuth Handlers with Provider Pattern

**Impact:** 250+ lines saved
**Time:** 12 hours
**Risk:** HIGH (authentication/authorization code)

#### Context Loading Strategy:
1. Read `/packages/backend/handlers/oauth.ts` in full (420 lines)
2. Identify the three OAuth flows: GitLab (lines 33-168), Jira (lines 171-307), GitHub (lines 309-354)
3. Create side-by-side comparison of the three flows
4. Read environment config to understand provider configuration

#### Instructions:

1. **Map out the patterns:**
   - **Authorize endpoint:** Lines 33-41 (GitLab), 171-178 (Jira), 309-313 (GitHub)
   - **Token exchange:** Lines 66-78 (GitLab), 202-214 (Jira), 336-348 (GitHub)
   - **Token refresh:** Lines 134-153 (GitLab), 273-292 (Jira)
   - **Error handling:** Lines 80-84 (GitLab), 216-220 (Jira), 350-354 (GitHub)

2. **Design provider interface:**
   - Create `/packages/backend/services/oauth-provider.ts`
   - Define interface with: name, authorizeUrl, tokenUrl, refreshUrl, scopes, clientId, clientSecret
   - Create factory function to get provider by name

3. **Extract shared logic:**
   - Create `handleAuthorize(provider: OAuthProvider)`
   - Create `handleTokenExchange(provider: OAuthProvider, code: string, state: string)`
   - Create `handleTokenRefresh(provider: OAuthProvider, refreshToken: string)`

4. **Create provider configurations:**
   - Create `/packages/backend/config/oauth-providers.ts`
   - Define GitLab config
   - Define Jira config
   - Define GitHub config
   - Load from environment variables

5. **Refactor the handler:**
   - Replace three separate flows with single generic implementation
   - Use provider configuration to customize behavior
   - Keep any provider-specific logic in separate functions if needed

6. **Handle provider-specific differences:**
   - Jira uses OAuth 1.0a (different from GitLab/GitHub OAuth 2.0)
   - May need separate handler for OAuth 1.0a vs 2.0
   - Or use strategy pattern

7. **Verification:**
   - Test GitLab OAuth flow end-to-end
   - Test Jira OAuth flow end-to-end
   - Test GitHub OAuth flow end-to-end
   - Test error cases
   - Test token refresh

#### Files to Create:
- `/packages/backend/services/oauth-provider.ts`
- `/packages/backend/config/oauth-providers.ts`

#### Files to Modify:
- `/packages/backend/handlers/oauth.ts`

#### Testing Requirements:
- Integration tests with mock OAuth servers
- Test all three providers
- Test error scenarios
- Test token expiration and refresh

---

### Task 3.2: Extract Secret Response Formatting

**Impact:** 30 lines saved
**Time:** 2 hours
**Risk:** LOW

#### Context Loading Strategy:
1. Read `/packages/backend/handlers/secrets.ts`
2. Find the three response formatting blocks (lines 66-77, 85-95, 102-112)
3. Check if there's a types package with Secret type

#### Instructions:

1. **Identify the pattern:**
   - Three identical mappings that project specific fields
   - Purpose: Hide sensitive fields from responses

2. **Create projection function:**
   - Add to secrets handler or create `/packages/backend/utils/projections.ts`
   - Function name: `projectSecretResponse`
   - Accept: `Secret` object
   - Return: object with only safe fields

3. **Replace all three occurrences:**
   - Lines 66-77 → call to projection function
   - Lines 85-95 → call to projection function
   - Lines 102-112 → call to projection function

4. **Consider:**
   - Should this be in the database layer instead?
   - Should we use a library like lodash pick/omit?
   - Is there a pattern to extract for other entities?

#### Files to Modify:
- `/packages/backend/handlers/secrets.ts`

---

### Task 3.3: Consolidate Token Validation Functions

**Impact:** 70 lines saved
**Time:** 6 hours
**Risk:** MEDIUM (security-critical)

#### Context Loading Strategy:
1. Read `/packages/backend/handlers/secrets.ts`
2. Find GitLab token validation: lines 145-178, 180-217
3. Find Jira token validation: lines 260-296, 298-368
4. Compare the two patterns

#### Instructions:

1. **Analyze the validators:**
   - GitLab: Two similar functions (one for each endpoint?)
   - Jira: Two similar functions with OAuth handling
   - Identify common validation steps

2. **Design generic validator:**
   - Create `/packages/backend/services/token-validator.ts`
   - Support different provider types
   - Return validation result + metadata

3. **Extract common logic:**
   - Secret decryption
   - API call to verify token
   - Error handling
   - Result formatting

4. **Handle provider-specific differences:**
   - GitLab: Simple API call
   - Jira: OAuth token check
   - GitHub: (if exists) Similar to GitLab

5. **Replace in secrets handler:**
   - Update all four validator calls
   - Use generic validator with provider parameter

#### Files to Create:
- `/packages/backend/services/token-validator.ts`

#### Files to Modify:
- `/packages/backend/handlers/secrets.ts`

---

## Phase 4: Frontend Components (Week 3-4)

**Goal:** Eliminate 1,800+ lines of frontend duplication
**Time:** 40 hours
**Risk:** MEDIUM

### Task 4.1: Create Generic ResourceSelect Component

**Impact:** 1,100+ lines saved across 11 components
**Time:** 24 hours
**Risk:** MEDIUM (affects many components)

#### Context Loading Strategy:
1. Read `/packages/ui/src/project-select.tsx` in full (147 lines)
2. Read `/packages/ui/src/file-space-select.tsx`
3. Read `/packages/ui/src/task-source-select.tsx`
4. Create comparison matrix of differences
5. Read `/packages/ui/src/combobox.tsx` to understand the underlying component

#### Instructions:

1. **Compare all 11 select components:**
   - Map out what's identical vs what varies
   - Identical: useState pattern, useEffect pattern, loading logic, button grid layout, combobox integration
   - Varies: API endpoint, type, label text, icon

2. **Design the generic component API:**
   ```
   <ResourceSelect<T>
     client={client}
     fetchConfig={listProjectsConfig}  // From api-contracts
     value={selectedId}
     onChange={setSelectedId}
     labelExtractor={(item: T) => item.name}  // How to get display label
     descriptionExtractor={(item: T) => ...}  // Optional description
     icon={FolderIcon}  // Optional custom icon
     label="PROJECT"
     placeholder="Search..."
     buttonLayoutThreshold={10}  // Use button grid if <= this many
   />
   ```

3. **Implementation steps:**
   - Create `/packages/ui/src/resource-select.tsx`
   - Copy structure from project-select.tsx
   - Parameterize the varying parts
   - Make it fully generic with TypeScript generics
   - Support both button grid and combobox layouts

4. **Handle edge cases:**
   - Empty state
   - Loading state
   - Error state
   - Very long lists (performance)
   - Custom sorting

5. **Migrate each select component:**
   - Start with ProjectSelect (keep as wrapper for backward compatibility)
   - Migrate FileSpaceSelect
   - Migrate TaskSourceSelect
   - Continue for all 11 components
   - Consider: Full replacement vs thin wrapper?

6. **Backward compatibility:**
   - Option A: Replace component internals but keep same exports
   - Option B: Create new component, deprecate old ones
   - Recommended: Option A for zero breaking changes

7. **Testing strategy:**
   - Test with different resource types
   - Test button layout with 1, 10, 20, 100 items
   - Test combobox search functionality
   - Test loading and error states
   - Visual regression testing

#### Files to Create:
- `/packages/ui/src/resource-select.tsx`

#### Files to Modify:
- All 11 select component files (make them thin wrappers)

#### Migration Order:
1. Create ResourceSelect
2. Test thoroughly in isolation
3. Migrate ProjectSelect (most used, good test case)
4. If successful, migrate rest in parallel
5. Monitor for issues

---

### Task 4.2: Extract MultiStageForm Base Component

**Impact:** 760 lines saved across 2 components
**Time:** 16 hours
**Risk:** MEDIUM-HIGH (complex components)

#### Context Loading Strategy:
1. Read `/packages/client/src/components/FileSpaceMultistageForm.tsx` in full (623 lines)
2. Read `/packages/client/src/components/TaskSourceMultistageForm.tsx` in full (638 lines)
3. Create detailed comparison highlighting duplications
4. Map out the step flow for each

#### Instructions:

1. **Identify shared patterns:**
   - Step state management (currentStep, setCurrentStep)
   - Form data state
   - Navigation buttons (Next, Previous, Submit)
   - Progress indicator
   - Validation logic
   - Error handling

2. **Identify differences:**
   - Number of steps (varies)
   - Fields in each step (varies)
   - Validation rules (varies)
   - API endpoints (varies)

3. **Design abstraction:**
   - Option A: Render props pattern
   - Option B: Configuration-based
   - Option C: Composition with hooks
   - Recommended: Option C (most flexible)

4. **Create useMultiStageForm hook:**
   - Location: `/packages/client/src/hooks/useMultiStageForm.ts`
   - Manage step state
   - Provide navigation functions
   - Handle validation
   - Return current step, navigation functions, progress data

5. **Create MultiStageFormLayout component:**
   - Location: `/packages/client/src/components/MultiStageFormLayout.tsx`
   - Accept: steps, currentStep, onNext, onPrevious, children
   - Render: progress indicator, navigation buttons, step content
   - Handle responsive layout

6. **Refactor FileSpaceMultistageForm:**
   - Use useMultiStageForm hook
   - Use MultiStageFormLayout component
   - Keep only form-specific logic
   - Should reduce from 623 to ~250 lines

7. **Refactor TaskSourceMultistageForm:**
   - Same process
   - Should reduce from 638 to ~250 lines

8. **Testing:**
   - Test navigation (next, previous)
   - Test validation at each step
   - Test submission
   - Test going back and forward maintains state
   - Test error scenarios

#### Files to Create:
- `/packages/client/src/hooks/useMultiStageForm.ts`
- `/packages/client/src/components/MultiStageFormLayout.tsx`

#### Files to Modify:
- `/packages/client/src/components/FileSpaceMultistageForm.tsx`
- `/packages/client/src/components/TaskSourceMultistageForm.tsx`

#### Risk Mitigation:
- Keep old implementations in git history
- Test thoroughly before removing old code
- Consider feature flag for rollback

---

## Phase 5: Microservices & Complex Code (Week 5)

**Goal:** Reduce complexity and duplication in microservices
**Time:** 16 hours
**Risk:** MEDIUM

### Task 5.1: Create Queue Consumer Factory

**Impact:** 150 lines saved
**Time:** 8 hours
**Risk:** MEDIUM (messaging infrastructure)

#### Context Loading Strategy:
1. Read `/packages/micros-task-ops/consumer.ts` in full
2. Compare the three consumer functions: createTaskSyncConsumer (lines 18-84), createTaskEvalConsumer (lines 103-169), createTaskImplConsumer (lines 187-257)
3. Read RabbitMQ documentation for best practices
4. Check if there's a queue package with utilities

#### Instructions:

1. **Analyze the pattern:**
   - All three follow identical structure
   - Differences: queue name, prefetch count, message handler function
   - Common: connection setup, error handling, acknowledgment logic

2. **Design the factory:**
   - Create `/packages/queue/consumer-factory.ts` or add to existing queue package
   - Accept configuration object: queueName, prefetchCount, handler, logger
   - Return: consumer instance with start/stop methods

3. **Extract common logic:**
   - Channel creation
   - Queue assertion
   - Prefetch setting
   - Message consumption setup
   - Acknowledgment handling
   - Error handling with retry logic
   - Graceful shutdown

4. **Update consumer.ts:**
   - Replace three functions with factory calls
   - Pass different configurations for each
   - Maintain same external API

5. **Consider:**
   - Dead letter queue handling
   - Message retry logic
   - Connection recovery
   - Monitoring hooks

6. **Testing:**
   - Test with mock RabbitMQ
   - Test message processing
   - Test acknowledgment
   - Test error scenarios
   - Test graceful shutdown

#### Files to Create/Modify:
- `/packages/queue/consumer-factory.ts` (create)
- `/packages/micros-task-ops/consumer.ts` (refactor)

---

### Task 5.2: Extract Graceful Shutdown Handler

**Impact:** 30 lines saved
**Time:** 2 hours
**Risk:** LOW

#### Context Loading Strategy:
1. Read `/packages/micros-task-ops/index.ts` lines 93-112
2. Read `/packages/micros-claude-worker/src/index.ts` lines 332-340
3. Compare the two implementations

#### Instructions:

1. **Identify the pattern:**
   - Both handle SIGTERM and SIGINT
   - Both close connections/consumers
   - Both exit process

2. **Create shared utility:**
   - Location: `/packages/utils/graceful-shutdown.ts`
   - Accept: array of cleanup functions
   - Setup signal handlers
   - Execute cleanup in order
   - Exit process

3. **Update microservices:**
   - Import the utility
   - Pass cleanup functions
   - Remove duplicated code

#### Files to Create:
- `/packages/utils/graceful-shutdown.ts`

#### Files to Modify:
- `/packages/micros-task-ops/index.ts`
- `/packages/micros-claude-worker/src/index.ts`

---

### Task 5.3: Refactor Pipeline Executor Complexity

**Impact:** Reduce from 846 lines to <400 lines
**Time:** 6 hours (initial refactoring, more needed for complete fix)
**Risk:** HIGH (complex business logic)

#### Context Loading Strategy:
1. Read `/packages/backend/worker-orchestration/pipeline-executor.ts` in sections:
   - Lines 1-100: Imports and setup
   - Lines 100-300: Main execution logic
   - Lines 300-500: Worker orchestration
   - Lines 500-846: Helper functions and cleanup
2. Create flow diagram of the execution process
3. Identify independent subsystems

#### Instructions:

1. **Analyze the complexity:**
   - Main function is 846 lines
   - Triple-nested try-catch blocks
   - Multiple responsibilities: quota checking, worker selection, execution, cleanup
   - Helper functions embedded in main file

2. **Identify subsystems:**
   - Quota management
   - Worker type resolution
   - Environment variable loading
   - Pipeline execution
   - Artifact handling
   - Cleanup logic

3. **Refactor strategy - Split into services:**
   - Create `/packages/backend/services/quota-service.ts`
   - Create `/packages/backend/services/worker-resolver.ts`
   - Create `/packages/backend/services/env-loader.ts`
   - Keep pipeline-executor.ts as orchestrator

4. **Start with AI provider env loading:**
   - Extract loadAnthropicEnvVars, loadOpenAIEnvVars, loadGoogleEnvVars (lines ~112 duplicate)
   - Create generic loadAIProviderEnvVars(provider, config)
   - Reduces 112 lines to ~40 lines

5. **Flatten nested try-catch:**
   - Use early returns
   - Extract error handling to separate functions
   - Reduce indentation levels

6. **Break into smaller functions:**
   - Each function should have one responsibility
   - Target: no function > 50 lines
   - Use descriptive names

7. **Testing:**
   - Write tests for each extracted service
   - Integration tests for full pipeline
   - Test error scenarios
   - Test quota enforcement

#### Files to Create:
- `/packages/backend/services/quota-service.ts`
- `/packages/backend/services/worker-resolver.ts`
- `/packages/backend/services/env-loader.ts`

#### Files to Modify:
- `/packages/backend/worker-orchestration/pipeline-executor.ts`

#### Note:
This is a large refactoring. Consider breaking it into sub-tasks:
- Task 5.3a: Extract env loader (2 hours)
- Task 5.3b: Extract quota service (2 hours)
- Task 5.3c: Extract worker resolver (2 hours)
- Task 5.3d: Flatten error handling (additional time)

---

## Testing Strategy

### For Each Phase

1. **Before starting:**
   - Ensure all existing tests pass
   - Create a test plan for the changes
   - Set up test data if needed

2. **During development:**
   - Write tests alongside refactoring (TDD)
   - Run tests frequently
   - Use watch mode for rapid feedback

3. **After completing:**
   - Run full test suite
   - Run type checking
   - Run linting
   - Manual testing of affected features

### Test Types

#### Unit Tests
- Test each extracted function in isolation
- Mock dependencies
- Test edge cases and error scenarios
- Target: >90% coverage for new code

#### Integration Tests
- Test components working together
- Use test database for database utilities
- Test actual API calls for handlers
- Verify backwards compatibility

#### End-to-End Tests
- Test critical user flows
- Frontend forms submission
- OAuth flows
- Task execution pipelines

### Test Checklist Per Task

- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Existing tests still pass
- [ ] Type checking passes
- [ ] Linting passes
- [ ] Manual testing completed
- [ ] Edge cases covered
- [ ] Error scenarios tested

---

## Rollback Plan

### For Each Task

1. **Use feature flags where appropriate:**
   - For frontend changes, consider feature toggles
   - For backend changes, deploy behind feature flag
   - Gradual rollout to monitor for issues

2. **Git strategy:**
   - Create task branch from main refactor branch
   - Commit frequently with clear messages
   - Each task should be independently revertable

3. **If issues arise:**
   - Identify the problematic task
   - Revert that specific commit/branch
   - Investigate and fix
   - Re-apply with fixes

4. **Deployment strategy:**
   - Deploy phases incrementally
   - Monitor metrics after each deployment
   - Have rollback script ready
   - Keep old code for one release cycle

### Rollback Checklist

- [ ] Database migrations are reversible
- [ ] API changes are backward compatible
- [ ] Frontend changes don't break old clients
- [ ] Configuration changes documented
- [ ] Rollback tested in staging

---

## Success Metrics

### Code Quality Metrics

**Before Refactoring:**
- Duplicated code: ~5,000 lines (14%)
- Average function length: 45 lines
- Cyclomatic complexity: HIGH
- Files with violations: 54+

**After Refactoring (Target):**
- Duplicated code: <500 lines (<2%)
- Average function length: <30 lines
- Cyclomatic complexity: MEDIUM
- Files with violations: <10

### Performance Metrics

- No performance regression
- Test suite execution time: maintained or improved
- Build time: maintained or improved

### Developer Experience

- Time to implement new select component: reduced by 70%
- Time to add new OAuth provider: reduced by 60%
- Time to add new entity CRUD: reduced by 50%
- Code review time: reduced due to less duplication

---

## Monitoring During Refactoring

### What to Monitor

1. **Test success rate:**
   - Monitor test failures
   - Track test execution time
   - Watch for flaky tests

2. **Build success rate:**
   - Track build failures
   - Monitor build time
   - Watch for type errors

3. **Code metrics:**
   - Track lines of code
   - Track duplication percentage
   - Track complexity metrics

4. **Developer feedback:**
   - Ease of implementation
   - Confusion points
   - Suggested improvements

### Tools to Use

- **jscpd:** Track duplication metrics
- **SonarQube or CodeClimate:** Track maintainability
- **ESLint:** Track complexity violations
- **Jest coverage:** Track test coverage
- **Nx affected:** Test only affected packages

---

## Documentation Updates

### As You Refactor

1. **Update inline documentation:**
   - Add JSDoc comments to new utilities
   - Document function parameters and return types
   - Add usage examples

2. **Update architecture docs:**
   - Document new patterns (e.g., ResourceSelect usage)
   - Update component library docs
   - Document new utilities

3. **Create migration guides:**
   - How to use new utilities
   - How to migrate old patterns
   - Common pitfalls

4. **Update README files:**
   - Package READMEs if utilities added
   - Component library README
   - Developer onboarding docs

---

## Communication Plan

### Before Starting

- [ ] Present plan to team
- [ ] Get buy-in from stakeholders
- [ ] Assign tasks if multiple developers
- [ ] Set up progress tracking (Jira, GitHub Issues, etc.)

### During Refactoring

- [ ] Daily standups: Share progress
- [ ] Weekly updates: Share metrics
- [ ] Blockers: Communicate immediately
- [ ] Wins: Celebrate completed phases

### After Completion

- [ ] Demo the improvements
- [ ] Share metrics (lines saved, time saved)
- [ ] Document lessons learned
- [ ] Plan for ongoing maintenance

---

## Risk Assessment

### High Risk Tasks

1. **Task 2.1-2.4 (Database Abstraction):** Core data layer
   - Mitigation: Comprehensive testing, gradual rollout

2. **Task 3.1 (OAuth Refactor):** Authentication code
   - Mitigation: Integration tests, staging testing, feature flag

3. **Task 5.3 (Pipeline Executor):** Complex business logic
   - Mitigation: Break into smaller tasks, extensive testing

### Medium Risk Tasks

1. **Task 4.1 (ResourceSelect):** Affects many components
   - Mitigation: Backward compatible wrappers, gradual migration

2. **Task 4.2 (MultiStageForm):** Complex components
   - Mitigation: Keep old implementations initially, feature flag

### Low Risk Tasks

1. **Task 1.1 (get helper):** Simple utility extraction
2. **Task 1.3 (getUserId):** Already duplicated, clear pattern
3. **Task 5.2 (Graceful shutdown):** Independent utility

---

## Appendix: Context Loading Patterns

### Pattern 1: Understanding Duplication

```
1. Read first instance of pattern (complete)
2. Read second instance (lines with duplication only)
3. Use grep/search to find all instances
4. Compare 2-3 examples to confirm pattern
5. Read destination file for new utility
```

### Pattern 2: Implementing Generic Utility

```
1. Read all variations to understand differences
2. Design generic interface
3. Read target location for placement
4. Implement and test
5. Update first usage as proof of concept
6. Replicate across remaining usages
```

### Pattern 3: Refactoring Complex Code

```
1. Read entire file to understand scope
2. Create mental model or diagram
3. Identify independent subsystems
4. Read each subsystem in detail
5. Extract one subsystem at a time
6. Test after each extraction
```

### Pattern 4: Frontend Component Refactoring

```
1. Read two complete components
2. Create comparison matrix
3. Design generic component API
4. Implement with one component as test
5. Verify with another component
6. Batch remaining updates
```

---

## Questions & Considerations

### Open Questions

1. **Should we create a shared utilities package?**
   - Current: utils scattered across packages
   - Option: Create @adi/common-utils
   - Decision needed before Task 2.1

2. **Should we use a library for form handling?**
   - Current: Manual form state management
   - Options: React Hook Form, Formik
   - Affects Task 4.2

3. **Should we add automated duplication detection to CI?**
   - Tool: jscpd in CI pipeline
   - Block PRs with >5% duplication
   - Decision needed for long-term

### Assumptions

1. Backward compatibility required
2. No breaking changes to public APIs
3. All tests must pass after each phase
4. Monorepo structure maintained
5. TypeScript strict mode enabled

### Dependencies

- Task 1.2 should be completed before Task 2.x (establishes pattern)
- Task 1.3 should be completed before Task 3.x (auth utils needed)
- Task 4.1 should be completed before migrating all selects
- Tasks within a phase can be parallelized with multiple developers

---

## Conclusion

This plan provides a comprehensive, step-by-step approach to eliminating 5,000+ lines of code duplication while improving maintainability and reducing complexity.

**Key Success Factors:**
1. ✅ Incremental approach (each phase independently valuable)
2. ✅ Clear context loading strategies (work within constraints)
3. ✅ Comprehensive testing (ensure no regressions)
4. ✅ Risk mitigation (rollback plans, gradual rollout)
5. ✅ Documentation (capture knowledge for future)

**Next Steps:**
1. Review this plan with the team
2. Adjust timeline based on team capacity
3. Create tracking issues for each task
4. Begin with Phase 1 Quick Wins
5. Monitor progress and adjust as needed

Good luck with the refactoring! 🚀
