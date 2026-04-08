# Feature: Publishing Runtime

## Blueprint

### Context

The app now has real channel connections and saved posting schedules, but production use still requires the queue to survive beyond one browser session and publish from the Worker scheduled runtime.

### Architecture

- **Entry points:** authenticated `GET /`, authenticated `GET /compose`, authenticated `POST /compose/queue`, authenticated `POST /queue/delete`, authenticated `GET /history`, and the Worker scheduled handler in `src/worker.ts`
- **Source layout:** `src/publishing/` owns queued-post persistence plus scheduled publish orchestration, `src/providers/publish.ts` owns provider-specific publish execution behind a shared contract, `src/history/` owns sent-post history persistence, and `src/views/queued-posts.ts` renders persisted queue entries in authenticated pages.
- **Data model:** D1 `app_state` stores `queued_posts_v1` and `sent_post_history_v1`; queued posts reference saved `channel_connections` rows by id.
- **Scheduling model:** Wrangler keeps a fixed 15-minute publish poll. The runtime evaluates saved per-channel posting schedules on each poll and publishes the oldest due queued post per connection.

### Anti-Patterns

- Do not keep queue state only in client-side DOM or page-local script state.
- Do not call provider SDKs directly from the Worker route handlers or HTML views.
- Do not publish more than one queued post per connection in a single due slot until the queue contract says otherwise.

## Contract

### Definition of Done

- [ ] Authenticated `POST /compose/queue` persists a queued post against a saved channel connection.
- [ ] Authenticated Queue and Compose pages render the persisted queued-post list from server state.
- [ ] Authenticated `POST /queue/delete` removes a queued post.
- [ ] The scheduled Worker runtime publishes the oldest due queued post per connection when the saved channel schedule matches the current poll slot.
- [ ] Successful publishes are appended to sent-post history and removed from the queue.
- [ ] Failed publishes stay in the queue with attempt metadata and the most recent error message.
- [ ] Automated tests cover queue persistence, scheduled publishing selection, provider publish adapters, and authenticated queue route handling.

### Regression Guardrails

- Queue submissions must stay authenticated and reject readonly users.
- Queue submissions must respect the existing provider-specific copy limits.
- Scheduled publishing must skip cleanly when no schedule is due, no posts are queued, or no eligible connection exists.
- Publish failures must not silently delete queued posts.
- Sent-post history must stay sorted from newest to oldest.

### Verification

- **Automated tests:** `src/publishing/index.test.ts`, `src/providers/publish.test.ts`, `src/history/index.test.ts`, `src/views/queued-posts.test.ts`, `src/worker.test.ts`, and `src/worker.e2e.ts`
- **Quality gate:** `npm run quality:gate:fast`

### Scenarios

**Scenario: Operator queues a post from the composer**

- Given: the operator is already authenticated and at least one channel connection exists
- When: they submit `POST /compose/queue` with valid copy
- Then: the Worker stores the post in the persisted queue and redirects back to `/compose`

**Scenario: Operator removes a queued post**

- Given: the operator is already authenticated
- When: they submit `POST /queue/delete`
- Then: the Worker removes the queued post and redirects back to the relevant authenticated page

**Scenario: Scheduled runtime publishes a due queued post**

- Given: a queued post exists for a saved channel connection and the current poll slot matches the saved schedule
- When: the Worker scheduled handler runs
- Then: it publishes the oldest due queued post for that connection, removes it from the queue, and appends a sent-post history entry

**Scenario: Scheduled runtime records a publish failure**

- Given: a queued post is due but the provider publish attempt fails
- When: the Worker scheduled handler runs
- Then: the queued post remains stored with incremented attempt metadata and the last error message
