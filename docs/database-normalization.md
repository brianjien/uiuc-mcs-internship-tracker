# Database Normalization

The active MySQL schema is version 2 and is designed to Boyce-Codd Normal Form (BCNF), which also satisfies 3NF.

## Relations

| Relation | Candidate key | Purpose |
| --- | --- | --- |
| `users` | `id`, `email` | Authentication identity |
| `candidate_profiles` | `user_id` | One profile per user |
| `sessions` | `token_hash` | Expiring login sessions |
| `workspace_meta` | `user_id` | Workspace lifecycle timestamps |
| `jobs` | `(user_id, id)` | User-owned tracked roles |
| `job_tags` | `(user_id, job_id, tag)` | Multivalued job tags |
| `job_oa_attempts` | `(user_id, job_id, id)` | OA attempts and reflections |
| `job_oa_question_types` | `(user_id, job_id, attempt_id, question_type)` | Multivalued OA question types |
| `job_activities` | `(user_id, job_id, id)` | Saved and applied events used by Sprint history |
| `tasks` | `(user_id, id)` | Action items, optionally linked to a job |
| `contacts` | `(user_id, id)` | Recruiting contacts, optionally linked to a job |
| `documents` | `(user_id, id)` | Application assets and private storage metadata |
| `goals` | `user_id` | One application goal per user |
| `notification_settings` | `user_id` | Browser notification preference |
| `notification_reads` | `(user_id, notification_id)` | Read notification set |
| `notification_dismissals` | `(user_id, notification_id)` | Dismissed notification set |
| `schema_migrations` | `version` | Applied schema versions |

Every non-key attribute is determined by a candidate key for its relation. Repeating collections such as tags, OA question types, activities, and notification IDs live in child relations instead of JSON arrays.

## Legacy Migration

On the first request after deployment:

1. `profile_json` is copied from `users` into `candidate_profiles`.
2. Each legacy `workspace_data` row is sanitized and expanded into the normalized relations.
3. A `workspace_meta` row marks that user's migration as complete.
4. Schema version `2` is recorded in `schema_migrations`.

The legacy `workspace_data` table is left as an inactive migration archive so deployment does not destructively remove the only backup. All application reads and writes use the normalized relations.

## Write Strategy

`PUT /api/workspace` sanitizes the full submitted workspace, opens a transaction, replaces the user's dependent rows, and commits only after every relation is written. A failure rolls back the complete update.

All SQL values use PyMySQL parameters. Dynamic table names are limited to hard-coded server constants.
