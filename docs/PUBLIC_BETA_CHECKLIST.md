# Public Beta Launch Checklist

**Target**: ADI Task Orchestration Platform
**Version**: 1.0.0-beta
**Last Updated**: 2025-10-19

---

## Beta Readiness Criteria

**Current Status**: 🔴 **NOT READY** (4/10 score)

**Blockers**: 6 critical issues, 30% UI completion

---

## Critical Blockers (Must Fix Before Beta)

### 🔴 **1. Task Source Creation Flow**
**Status**: ❌ NOT DONE
**Priority**: CRITICAL
**Estimate**: 8 hours

**Tasks**:
- [ ] Add "Add Task Source" button on ProjectPage (`/projects/:id`)
- [ ] Create TaskSourceCreatePage with type selector
- [ ] Implement dynamic form based on type:
  - [ ] GitLab Issues form (host, repo, accessToken)
  - [ ] Jira form (host, project_key, accessToken)
  - [ ] GitHub Issues form (repo, accessToken)
- [ ] Add form validation
- [ ] Add "Test Connection" functionality
- [ ] Show example configs in help text
- [ ] Link from Projects list to add Task Source

**Acceptance Criteria**:
- User can create Task Source from ProjectPage without leaving the page
- Form validates config before saving
- Test connection verifies credentials
- Error messages are actionable

---

### 🔴 **2. Worker Repository Setup UI**
**Status**: ❌ NOT DONE
**Priority**: CRITICAL
**Estimate**: 12 hours

**Tasks**:
- [ ] Add "Setup Worker Repository" section on ProjectPage
- [ ] Show Worker Repository status:
  - [ ] ✅ Ready (show GitLab link)
  - [ ] ❌ Not Setup (show setup button)
- [ ] Create WorkerRepositorySetupPage with form:
  - [ ] Version selector (dropdown or input)
  - [ ] Custom path input (with smart default)
- [ ] Add environment variable check before setup:
  - [ ] `GITLAB_HOST`
  - [ ] `GITLAB_TOKEN`
  - [ ] `GITLAB_USER`
  - [ ] `ENCRYPTION_KEY`
- [ ] Show setup progress indicator
- [ ] Display GitLab project URL after setup
- [ ] Show required CI variables with copy buttons:
  - [ ] `API_BASE_URL`
  - [ ] `API_TOKEN`
  - [ ] `ANTHROPIC_API_KEY`
- [ ] Link to GitLab CI/CD settings page

**Acceptance Criteria**:
- User can setup Worker Repository from ProjectPage
- Environment variables are validated before starting
- Setup progress is visible
- GitLab project link is clickable
- CI variables are clearly documented

---

### 🔴 **3. Fix Task Sync Functionality**
**Status**: ❌ NOT DONE
**Priority**: CRITICAL
**Estimate**: 4 hours

**Tasks**:
- [ ] Rename current "Sync" button to "Refresh"
- [ ] Add new "Sync Task Sources" section on TasksPage
- [ ] Show list of Task Sources with:
  - [ ] "Sync Now" button for each
  - [ ] Last sync timestamp
  - [ ] Sync status indicator
- [ ] Implement sync functionality:
  - [ ] Call `POST /task-sources/:id/sync`
  - [ ] Show loading state: "Syncing... (fetched X new issues)"
  - [ ] Update task list after sync completes
- [ ] Add bulk "Sync All Task Sources" button
- [ ] Show toast notification on sync completion

**Acceptance Criteria**:
- User understands difference between "Refresh" and "Sync"
- Manual sync triggers actual issue fetching from external sources
- Sync progress is visible
- Task list updates after sync completes
- Errors are shown with actionable messages

---

### 🔴 **4. Implement Proper Error Handling**
**Status**: ❌ NOT DONE
**Priority**: CRITICAL
**Estimate**: 6 hours

**Tasks**:
- [ ] Replace all `console.error()` with toast notifications
- [ ] Replace all `alert()` with themed modals or toasts
- [ ] Add error messages with actionable guidance:
  - [ ] Network errors: "Check backend connection"
  - [ ] Auth errors: "Invalid API token"
  - [ ] Validation errors: Show which fields are invalid
- [ ] Add retry buttons on all error states
- [ ] Implement ErrorBoundary for React crashes
- [ ] Add network status indicator (online/offline)
- [ ] Create error logging system:
  - [ ] `/errors` page showing recent errors
  - [ ] Export functionality for debugging

**Acceptance Criteria**:
- All errors are visible to users (no silent failures)
- Error messages are actionable ("do this to fix")
- Users can retry failed operations
- Application doesn't crash on unexpected errors
- Developers can debug errors via error log

---

### 🔴 **5. Project Health Dashboard**
**Status**: ❌ NOT DONE
**Priority**: HIGH
**Estimate**: 8 hours

**Tasks**:
- [ ] Add setup checklist on ProjectPage:
  - [ ] ✅ Project created
  - [ ] ⚠️ Add Task Source (with action button)
  - [ ] ❌ Setup Worker Repository (with action button)
  - [ ] ⏳ Configure GitLab CI variables (with link)
  - [ ] ⏳ Setup webhooks (optional, with link)
- [ ] Show health status badge:
  - [ ] 🟢 "Ready" - All configured
  - [ ] 🟡 "Partial" - Missing components
  - [ ] 🔴 "Not Ready" - Cannot process issues
- [ ] Add project statistics:
  - [ ] Task Source count
  - [ ] Task count
  - [ ] Active session count
  - [ ] Pipeline execution count
  - [ ] Last sync timestamp
- [ ] Add troubleshooting section:
  - [ ] "Why aren't my issues processing?"
  - [ ] Link to TROUBLESHOOTING.md
- [ ] Add activity feed (last 10 events):
  - [ ] "Task Source synced: 3 new tasks"
  - [ ] "Pipeline execution completed"
  - [ ] "Worker Repository setup completed"

**Acceptance Criteria**:
- User can see project setup status at a glance
- Missing configuration is clearly indicated with action buttons
- Health status accurately reflects system state
- Activity feed shows recent events

---

### 🔴 **6. Task → Sessions → Messages Navigation**
**Status**: ❌ NOT DONE
**Priority**: HIGH
**Estimate**: 4 hours

**Tasks**:
- [ ] Add "View Sessions" button on each task row in TasksPage
- [ ] Create filtered sessions view: `/tasks/:taskId/sessions`
- [ ] Add "View Messages" button on each session row
- [ ] Create filtered messages view: `/sessions/:sessionId/messages`
- [ ] Implement breadcrumb navigation:
  - [ ] Tasks > Task #123 > Sessions
  - [ ] Sessions > Session #abc > Messages
- [ ] Add context headers:
  - [ ] "Sessions for Task: Fix login bug"
  - [ ] "Messages for Session #abc"
- [ ] Add back navigation buttons

**Acceptance Criteria**:
- User can navigate from Task to Sessions to Messages
- Breadcrumbs show current location
- Back buttons work correctly
- Context is always visible (which task/session)

---

## High Priority (Should Fix Before Beta)

### 🟡 **7. Webhook Configuration UI**
**Status**: ❌ NOT DONE
**Priority**: HIGH
**Estimate**: 6 hours

**Tasks**:
- [ ] Add "Webhooks" tab on ProjectPage
- [ ] Show webhook URLs with copy buttons:
  - [ ] GitLab: `{BACKEND_URL}/webhooks/gitlab`
  - [ ] Jira: `{BACKEND_URL}/webhooks/jira`
  - [ ] GitHub: `{BACKEND_URL}/webhooks/github`
- [ ] Display webhook secret (masked with reveal button)
- [ ] Add configuration instructions for each platform
- [ ] Add webhook test endpoint:
  - [ ] Button: "Test Webhook"
  - [ ] Send test payload
  - [ ] Show test result
- [ ] Add webhook activity log:
  - [ ] Last 50 webhook events
  - [ ] Timestamp, source, status

**Acceptance Criteria**:
- User can copy webhook URLs easily
- Configuration instructions are clear
- Test webhook functionality works
- Activity log shows webhook events

---

### 🟡 **8. Pipeline Execution Monitoring**
**Status**: ❌ NOT DONE
**Priority**: MEDIUM
**Estimate**: 8 hours

**Tasks**:
- [ ] Add real-time status polling (5-second interval)
- [ ] Add link to GitLab pipeline URL:
  - [ ] Parse from `worker_repository.source_gitlab`
  - [ ] Button: "View in GitLab →"
- [ ] Show pipeline artifacts inline:
  - [ ] List artifacts with links
  - [ ] Preview artifact content
- [ ] Add execution timeline:
  - [ ] Created → Started → Completed
  - [ ] Duration calculation
- [ ] Add action buttons (if pipeline failed):
  - [ ] "View Error Details"
  - [ ] "Retry Pipeline" (future)
- [ ] Show pipeline status with icons:
  - [ ] ⏳ Pending
  - [ ] ▶️ Running
  - [ ] ✅ Success
  - [ ] ❌ Failed
  - [ ] ⏸️ Canceled

**Acceptance Criteria**:
- Pipeline status updates automatically (no refresh needed)
- Users can view pipeline in GitLab
- Artifacts are visible and accessible
- Execution timeline is clear

---

### 🟡 **9. Enhanced ProjectPage with Tabs**
**Status**: ❌ NOT DONE
**Priority**: MEDIUM
**Estimate**: 10 hours

**Tasks**:
- [ ] Add tabbed interface on ProjectPage:
  - [ ] **Overview** tab (health, stats, quick actions)
  - [ ] **Task Sources** tab (list, add, edit)
  - [ ] **Tasks** tab (filtered by project)
  - [ ] **Worker Repository** tab (setup, status, GitLab link)
  - [ ] **Pipelines** tab (recent executions)
  - [ ] **Settings** tab (enable/disable, delete)
- [ ] Implement Overview tab:
  - [ ] Health dashboard (from #5)
  - [ ] Quick stats
  - [ ] Action buttons
- [ ] Implement Task Sources tab:
  - [ ] List task sources for project
  - [ ] Add/edit/delete task source
  - [ ] Sync button per task source
- [ ] Implement Tasks tab:
  - [ ] Filtered task list (only this project)
  - [ ] Task statistics
- [ ] Implement Worker Repository tab:
  - [ ] Setup wizard (if not setup)
  - [ ] GitLab project link
  - [ ] CI variables documentation
  - [ ] Current version
- [ ] Implement Pipelines tab:
  - [ ] Recent pipeline executions
  - [ ] Pipeline statistics

**Acceptance Criteria**:
- All project-related resources accessible from single page
- Tabs remember last active tab
- Navigation is intuitive
- Each tab has relevant actions

---

## Medium Priority (Nice to Have for Beta)

### 🟢 **10. Setup Wizard for New Projects**
**Status**: ❌ NOT DONE
**Priority**: LOW
**Estimate**: 12 hours

**Tasks**:
- [ ] Create multi-step setup wizard:
  - [ ] Step 1: Create Project (name, enabled)
  - [ ] Step 2: Add Task Source (type, config)
  - [ ] Step 3: Setup Worker Repository (version, path)
  - [ ] Step 4: Configure Webhooks (optional)
  - [ ] Step 5: Summary & Next Steps
- [ ] Add progress indicator (1/5, 2/5, etc.)
- [ ] Add validation per step
- [ ] Allow skip for optional steps
- [ ] Save progress (allow resume later)
- [ ] Show summary at end with links

**Acceptance Criteria**:
- New users can complete full setup in wizard
- Progress is clear
- Each step is validated before proceeding
- User can skip optional steps

---

### 🟢 **11. System-Wide Error Log Page**
**Status**: ❌ NOT DONE
**Priority**: LOW
**Estimate**: 6 hours

**Tasks**:
- [ ] Create `/errors` page
- [ ] Show recent errors (last 100)
- [ ] Display error details:
  - [ ] Timestamp
  - [ ] Component/page
  - [ ] Error message
  - [ ] Stack trace (expandable)
- [ ] Add filtering:
  - [ ] By component
  - [ ] By date range
  - [ ] By error type
- [ ] Add export functionality (JSON/CSV)
- [ ] Add clear button (clear all errors)

**Acceptance Criteria**:
- Developers can view all application errors
- Errors are sortable and filterable
- Export works for debugging

---

### 🟢 **12. Activity Feed / Audit Log**
**Status**: ❌ NOT DONE
**Priority**: LOW
**Estimate**: 8 hours

**Tasks**:
- [ ] Create activity logging system
- [ ] Track events:
  - [ ] Project created/updated/deleted
  - [ ] Task Source created/synced
  - [ ] Worker Repository setup
  - [ ] Pipeline execution started/completed
  - [ ] Webhook received
- [ ] Create `/activity` page
- [ ] Show activity feed per project
- [ ] Add filtering by event type
- [ ] Add date range filter
- [ ] Show user who triggered event (future)

**Acceptance Criteria**:
- All major events are logged
- Activity is visible per project
- Feed is sortable and filterable

---

## Testing & QA

### 🟢 **13. Manual Testing Checklist**
**Status**: ❌ NOT DONE
**Priority**: HIGH

**Test Scenarios**:
- [ ] Happy path: Create project → Add task source → Setup worker repo → Sync tasks → Verify pipeline
- [ ] Error handling: Invalid credentials, network errors, missing config
- [ ] Navigation: All links work, breadcrumbs correct, back buttons work
- [ ] Responsive design: Works on mobile/tablet/desktop
- [ ] Cross-browser: Chrome, Firefox, Safari, Edge
- [ ] Performance: Pages load in <2 seconds
- [ ] Error recovery: Retry buttons work, toast notifications clear

**Device Testing**:
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

**Browser Testing**:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

---

### 🟢 **14. Load Testing**
**Status**: ❌ NOT DONE
**Priority**: MEDIUM

**Tests**:
- [ ] 100 concurrent users
- [ ] 1000 tasks in database
- [ ] 100 pipeline executions
- [ ] Real-time updates with 50 active users
- [ ] Webhook handling (100 webhooks/min)

**Acceptance Criteria**:
- API responds in <500ms for 95th percentile
- UI remains responsive under load
- No memory leaks
- Database queries are optimized

---

## Documentation

### 🟢 **15. User Documentation**
**Status**: ❌ NOT DONE
**Priority**: HIGH

**Documents Needed**:
- [ ] **Getting Started Guide**:
  - [ ] Installation
  - [ ] First project setup
  - [ ] Adding task sources
  - [ ] Configuring webhooks
- [ ] **Task Source Configuration**:
  - [ ] GitLab setup guide
  - [ ] Jira setup guide
  - [ ] GitHub setup guide
- [ ] **Worker Repository Guide**:
  - [ ] What is a Worker Repository
  - [ ] Setup instructions
  - [ ] CI variable configuration
- [ ] **Troubleshooting Guide** (enhance existing):
  - [ ] Common errors and solutions
  - [ ] Debugging failed pipelines
  - [ ] Webhook troubleshooting
- [ ] **API Documentation** (enhance existing):
  - [ ] Authentication
  - [ ] All endpoints
  - [ ] Example requests/responses

**Acceptance Criteria**:
- Non-technical users can set up first project
- All configuration options are documented
- Troubleshooting covers common issues

---

### 🟢 **16. Video Tutorials**
**Status**: ❌ NOT DONE
**Priority**: LOW

**Videos Needed**:
- [ ] 5-minute quick start
- [ ] Setting up GitLab task source
- [ ] Setting up Worker Repository
- [ ] Configuring webhooks
- [ ] Debugging failed pipelines

---

## Security & Compliance

### 🟢 **17. Security Audit**
**Status**: ❌ NOT DONE
**Priority**: HIGH

**Checks**:
- [ ] Authentication is required for sensitive endpoints
- [ ] API tokens are stored securely (encrypted)
- [ ] Webhook secrets are validated
- [ ] SQL injection protection (parameterized queries)
- [ ] XSS protection (React escaping)
- [ ] CSRF protection (if using cookies)
- [ ] Rate limiting on API endpoints
- [ ] Input validation on all forms
- [ ] Error messages don't leak sensitive info

**Acceptance Criteria**:
- No critical security vulnerabilities
- Sensitive data is encrypted
- API is protected against common attacks

---

### 🟢 **18. Data Privacy**
**Status**: ❌ NOT DONE
**Priority**: MEDIUM

**Requirements**:
- [ ] Privacy policy document
- [ ] Data retention policy
- [ ] User data export functionality
- [ ] User data deletion functionality
- [ ] GDPR compliance (if EU users)

---

## Deployment

### 🟢 **19. Production Environment Setup**
**Status**: ❌ NOT DONE
**Priority**: HIGH

**Tasks**:
- [ ] Setup production database (PostgreSQL)
- [ ] Configure environment variables
- [ ] Setup SSL certificates
- [ ] Configure domain DNS
- [ ] Setup monitoring (error tracking, uptime)
- [ ] Setup logging (centralized logs)
- [ ] Setup backups (database, daily)
- [ ] Setup CI/CD pipeline (auto-deploy)

**Acceptance Criteria**:
- Production environment is secure
- Database backups are automated
- Monitoring is active
- Deployments are automated

---

### 🟢 **20. Rollback Plan**
**Status**: ❌ NOT DONE
**Priority**: HIGH

**Plan**:
- [ ] Database migration rollback procedure
- [ ] Code rollback procedure (git revert)
- [ ] Data backup before migration
- [ ] Smoke tests after deployment
- [ ] Rollback triggers (error rate, downtime)

---

## Beta Launch

### 🟢 **21. Beta User Onboarding**
**Status**: ❌ NOT DONE
**Priority**: HIGH

**Materials**:
- [ ] Welcome email template
- [ ] Onboarding checklist for users
- [ ] Feedback form link
- [ ] Support channel (Discord, Slack, email)
- [ ] Known issues document

---

### 🟢 **22. Beta Feedback Collection**
**Status**: ❌ NOT DONE
**Priority**: HIGH

**Mechanisms**:
- [ ] In-app feedback button
- [ ] Bug report template
- [ ] Feature request form
- [ ] User survey (after 1 week)
- [ ] Analytics tracking:
  - [ ] Page views
  - [ ] Feature usage
  - [ ] Error rates
  - [ ] User flows

---

## Success Metrics

### KPIs for Beta:
- [ ] **User Activation**: 80% complete first project setup
- [ ] **Feature Adoption**: 60% setup Worker Repository
- [ ] **Task Processing**: 90% success rate for pipeline executions
- [ ] **User Retention**: 50% return after 1 week
- [ ] **Error Rate**: <5% of API requests fail
- [ ] **Page Load Time**: <2 seconds for 95th percentile
- [ ] **User Satisfaction**: >70% positive feedback

---

## Launch Decision

### Go/No-Go Criteria:

**MUST HAVE (Blockers)**:
- [x] All 6 critical blockers fixed (#1-6)
- [ ] Manual testing complete
- [ ] Security audit passed
- [ ] Production environment ready
- [ ] Documentation complete (Getting Started + Troubleshooting)
- [ ] Rollback plan in place

**SHOULD HAVE (Not Blockers)**:
- [ ] High priority items (#7-9)
- [ ] Load testing complete
- [ ] Video tutorials created

**Current Status**: 🔴 **NO-GO**

**Estimated Time to Beta-Ready**: 60-80 hours of development

---

## Timeline

### Week 1 (Critical Blockers):
- Day 1-2: Task Source Creation Flow (#1)
- Day 3-4: Worker Repository Setup UI (#2)
- Day 5: Task Sync Functionality (#3)

### Week 2 (Critical + High Priority):
- Day 1-2: Error Handling (#4)
- Day 3: Navigation Links (#6)
- Day 4-5: Project Health Dashboard (#5)

### Week 3 (Remaining High Priority + Testing):
- Day 1-2: Webhook Configuration UI (#7)
- Day 3-4: Pipeline Monitoring (#8)
- Day 5: Manual Testing (#13)

### Week 4 (Documentation + Launch Prep):
- Day 1-3: User Documentation (#15)
- Day 4: Security Audit (#17)
- Day 5: Production Deployment (#19)

**Estimated Beta Launch**: 4 weeks from now

---

## Post-Beta Roadmap

### Version 1.1:
- Enhanced ProjectPage with tabs (#9)
- Setup wizard (#10)
- Activity feed (#12)
- Load testing (#14)

### Version 1.2:
- Real-time WebSocket updates
- Advanced pipeline features (retry, cancel)
- Analytics dashboard
- User management & permissions

### Version 2.0:
- Multi-tenant support
- Advanced AI runner options
- Custom workflow templates
- API rate limiting & quotas

---

**Checklist Maintained By**: Development Team
**Last Review**: 2025-10-19
**Next Review**: Weekly during beta prep
