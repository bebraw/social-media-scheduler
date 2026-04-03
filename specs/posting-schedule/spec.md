# Feature: Channel Posting Schedule

## Blueprint

### Context

The scheduler now has separate queue, compose, and history surfaces, but it still needs a durable way to express when each channel should publish.

Operators need to adjust that cadence per channel before the real publishing adapters exist, and the saved format should stay close to the Cloudflare-native scheduled runtime instead of inventing a custom rule language.

### Architecture

- **Entry points:** authenticated `GET /` renders the schedule editor for configured providers and authenticated `POST /posting-schedule` persists updates.
- **Source layout:** `src/schedule/` owns the per-channel schedule model, D1 `app_state` persistence, and Cloudflare cron mapping. `src/views/posting-schedule.ts` renders the editor used on the Queue page.
- **Data model:** D1 `app_state` stores one `posting_schedules_v1` entry containing per-channel Cloudflare-cron-compatible expressions. The UI derives weekday and UTC time controls from that stored form.
- **Deployment boundary:** saved schedules do not mutate `wrangler.jsonc` or deployed Cron Triggers automatically. Operators must sync the saved cron expressions into deployment config separately.

### Anti-Patterns

- Do not add a dedicated scheduler config table before a concrete workflow requires it.
- Do not store posting schedules in an app-specific DSL when Cloudflare cron already matches the target runtime.
- Do not imply that the authenticated UI can rewrite deployed Wrangler Cron Triggers at runtime.

## Contract

### Definition of Done

- [ ] The Queue page shows one editable schedule card for each currently configured provider.
- [ ] Each schedule card exposes weekday selection, a UTC time input, and the derived Cloudflare cron expression.
- [ ] Saving the form stores the per-channel schedule in D1 `app_state`.
- [ ] Readonly users can view schedules but cannot update them.
- [ ] Invalid schedule submissions return a visible validation error on the Queue page.
- [ ] Automated tests cover cron mapping, persistence, route handling, and the browser-visible editor flow.

### Regression Guardrails

- Saved schedule data must remain Cloudflare-cron-compatible and round-trip back into the Queue editor.
- Missing or invalid stored schedule state must fall back to the checked-in default schedule set.
- Every editable channel must keep at least one selected weekday and a valid `HH:MM` UTC time.
- Queue route auth rules must apply to posting schedule edits too.
- The queue page must not render schedule cards for providers that are not currently configured in Settings.
- Health output must continue to list the posting schedule endpoint for tooling visibility.

### Verification

- **Automated tests:** `src/schedule/index.test.ts`, `src/views/posting-schedule.test.ts`, `src/views/home.test.ts`, `src/worker.test.ts`, and `src/worker.e2e.ts`
- **Quality gate:** `npm run quality:gate`

### Scenarios

**Scenario: Operator reviews the saved posting cadence**

- Given: the operator is already authenticated
- When: they open `/`
- Then: they see each configured provider's selected weekdays, UTC time, and derived Cloudflare cron expression

**Scenario: Operator saves a new channel cadence**

- Given: the operator is already authenticated
- When: they submit the schedule form with valid weekdays and UTC times
- Then: the Worker stores the resulting Cloudflare cron expressions in D1 `app_state` and redirects back to `/`

**Scenario: Readonly user attempts to change the schedule**

- Given: the authenticated user has the `readonly` role
- When: they submit `POST /posting-schedule`
- Then: the Worker rejects the update with HTTP 403

**Scenario: Stored schedule data is invalid**

- Given: D1 `app_state` contains an invalid `posting_schedules_v1` payload
- When: the Queue page loads the saved schedule
- Then: the app falls back to the checked-in default schedule set
