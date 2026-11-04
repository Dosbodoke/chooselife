# Database backup before merge

A verified production backup is required before merging the declarative-schema
adoption PR. No database deployment is part of that PR. Keep archives, role
files, credentials and restore logs outside the repository, in a private
persistent directory with mode `0700` and files with mode `0600`.

Use a trusted Postgres 15 client at least as new as the server. Connect to the
production project explicitly; if the direct endpoint needs unavailable IPv6,
use its **session** pooler on port 5432. Supply the database password through a
secret manager. Do not put it in a committed command, manifest or PR.

With `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` and
`PGSSLMODE=require` supplied privately, create a complete archive and password-free
role definitions:

```bash
PGOPTIONS='-c default_transaction_read_only=on' pg_dump --format=custom --file /private/backup/database.dump
PGOPTIONS='-c default_transaction_read_only=on' pg_dumpall --roles-only --no-role-passwords --file /private/backup/roles.sql
pg_restore --list /private/backup/database.dump > /private/backup/archive.list
shasum -a 256 /private/backup/database.dump /private/backup/roles.sql
```

Record the project reference, start/completion times in UTC, file sizes and
SHA-256 checksums in a private manifest. A successful archive listing is only an
integrity check; it is not proof that a restore works.

Restore in an isolated disposable Postgres/Supabase environment with compatible
extensions, no production connection, no published ports and scheduled jobs
disabled. Use a fresh empty database, pre-create missing role names, and restore
with errors treated as fatal. Verify the restored rows against the original
archive, including Auth, billing, Storage metadata and encrypted Vault rows.
Preserve the unmodified archive even if compatibility adjustments are needed.

The current production database has legacy Vault/pgsodium objects. The local
restore drill needed a separate, recorded SQL copy with these adjustments:

- `CREATE OR REPLACE` for function/trigger definitions and the generated
  `vault.decrypted_secrets` view, because extension initialization already
  creates some objects that also appear in the archive.
- `search_path = public, extensions, pg_catalog` while loading data, because the
  existing `validate_locale_keys` CHECK function references `language` without
  schema qualification.
- `session_replication_role = replica` **only during COPY data loading**, then
  `origin` again for schema statements. This prevents legacy Vault triggers
  from encrypting archived ciphertext a second time, while allowing pgsodium's
  DDL event triggers to construct their dependent views.

The drill uses `--no-owner --no-privileges`; production ownership and ACLs remain
in the original archive and role file. Data comparison requires exact multisets
of the archived COPY columns. For PostGIS `extensions.spatial_ref_sys`, require
all archived custom rows to be present; built-in extension reference rows may
also exist in the target. Record any other mismatch as a failed restore.

Ciphertext preservation does not verify decryption in another project: preserve
Vault/root encryption keys through Supabase's documented recovery process.
Database dumps contain Storage metadata, not stored file binaries or R2 objects.
See [Supabase's backup and restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
for whole-project recovery and encryption-key handling.

Before declaring the PR ready, confirm the fresh backup and successful local
restore are recorded in the private manifest. If deployment is delayed or the
migration set changes, take another fresh backup before applying any SQL.
