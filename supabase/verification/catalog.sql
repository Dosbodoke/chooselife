-- Read-only semantic catalog of the application schema, as one JSON row.
--
-- Compare two captures with `pnpm db:catalog:compare <left.json> <right.json>`.
-- Run it through `supabase db query --file` or the Supabase SQL connector. It is
-- a single SELECT on catalog tables plus cron.job and storage.buckets; it reads
-- no application rows and changes nothing. The only side effect is a
-- transaction-local empty search_path, so every deparsed name is
-- schema-qualified the same way whichever client runs the query.
--
-- Scope, decided from catalog ownership and dependencies rather than names:
-- * Application schemas are public and every non-extension schema owned by
--   the database owner (the role that runs migrations).
-- * Application objects are the non-extension relations, functions and types
--   in application schemas, whatever their owner, plus non-extension objects
--   the database owner owns anywhere else. They are captured in full, with
--   their owner.
-- * Every other relation, function and type is a platform object or an
--   extension member. Only its security state is captured, in
--   managed_security: owner, ACL, effective privileges, RLS flags, definer
--   flag, settings and column ACLs. Extension routines and types that share
--   their extension's most common state are folded into that extension's
--   entry; the rest are listed one by one.
-- * Policies, triggers, rules, event triggers, default ACLs and publications
--   are captured wherever they are, so a custom trigger or policy on a
--   platform table always shows up.
-- * supabase_migrations is the CLI's migration bookkeeping and is skipped.
-- * Every non-system schema is listed, so an unexpected schema shows up.
--
-- Function bodies, view queries, policy and trigger expressions and trigger
-- arguments appear only as SHA-256 digests of the text with CRLF turned into LF.
-- A webhook trigger or function could embed a credential, so raw text never
-- leaves the database. Platform function bodies are not read at all. Sequence
-- values, cron run history and vault secrets are not read.
--
-- Capture this before `db lint` or pgTAP run. Those tools install helpers
-- that are not part of the migrations.
with
  -- Read first: the final SELECT scans this row before evaluating anything
  -- that deparses SQL.
  pinned as materialized (
    select set_config('search_path', '', true) as search_path
  ),
  settings as (
    select
      d.datdba as app_owner,
      r.rolsuper or r.rolbypassrls as complete_visibility
    from pg_catalog.pg_database d
    cross join pg_catalog.pg_roles r
    where d.datname = pg_catalog.current_database()
      and r.rolname = current_user
  ),
  api_roles as (
    select rolname
    from pg_catalog.pg_roles
    where rolname in ('anon', 'authenticated', 'service_role')
  ),
  extension_members as (
    select d.classid, d.objid, x.extname
    from pg_catalog.pg_depend d
    join pg_catalog.pg_extension x on x.oid = d.refobjid
    where d.deptype = 'e'
  ),
  schemas_in_scope as (
    select n.oid, n.nspname, n.nspowner, n.nspacl
    from pg_catalog.pg_namespace n
    where n.nspname not in ('pg_catalog', 'information_schema')
      and n.nspname !~ '^pg_(toast|temp_|toast_temp_)'
  ),
  -- Schemas whose objects belong to the application whatever their owner.
  application_schemas as (
    select n.oid
    from schemas_in_scope n
    cross join settings s
    where n.nspname <> 'supabase_migrations'
      and (n.nspname = 'public' or n.nspowner = s.app_owner)
      and not exists (
        select 1 from extension_members e
        where e.classid = 'pg_catalog.pg_namespace'::regclass
          and e.objid = n.oid
      )
  ),
  -- Every relation, function and type in scope, with its extension if any.
  all_objects as (
    select 'relation' as kind, c.oid, n.oid as nsp, n.nspname,
      c.relowner as owner, c.relkind::text as subkind,
      format('%I.%I', n.nspname, c.relname) as id
    from pg_catalog.pg_class c
    join schemas_in_scope n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
    union all
    select 'function', p.oid, n.oid, n.nspname, p.proowner, p.prokind::text,
      format('%I.%I(%s)', n.nspname, p.proname,
        pg_catalog.pg_get_function_identity_arguments(p.oid))
    from pg_catalog.pg_proc p
    join schemas_in_scope n on n.oid = p.pronamespace
    union all
    select 'type', t.oid, n.oid, n.nspname, t.typowner, t.typtype::text,
      format('%I.%I', n.nspname, t.typname)
    from pg_catalog.pg_type t
    join schemas_in_scope n on n.oid = t.typnamespace
    -- Row types of tables and views, and array types, follow their parent.
    where (t.typrelid = 0 or (
        select relkind from pg_catalog.pg_class where oid = t.typrelid) = 'c')
      and not exists (
        select 1 from pg_catalog.pg_type a where a.typarray = t.oid)
  ),
  objects as (
    select o.*, e.extname,
      e.extname is null and (
        o.nsp in (select oid from application_schemas)
        or o.owner = s.app_owner
      ) as application
    from all_objects o
    cross join settings s
    left join extension_members e
      on e.objid = o.oid
      and e.classid = case o.kind
        when 'relation' then 'pg_catalog.pg_class'::regclass
        when 'function' then 'pg_catalog.pg_proc'::regclass
        else 'pg_catalog.pg_type'::regclass end
    where o.nspname <> 'supabase_migrations'
  ),
  relations as (
    select oid, subkind::"char" as relkind, owner as relowner, id
    from objects where kind = 'relation' and application
  ),
  functions as (
    select oid, id from objects where kind = 'function' and application
  ),
  types as (
    select oid, id from objects where kind = 'type' and application
  ),
  -- One "grantee:PRIVILEGE" entry per grant, "*" when grantable, PUBLIC for
  -- grantee 0. Grantors are left out.
  acl_entries as (
    select x.kind, x.oid, x.subid,
      case when x.grantee = 0 then 'PUBLIC'
        else pg_catalog.pg_get_userbyid(x.grantee) end
      || ':' || x.privilege_type
      || case when x.is_grantable then '*' else '' end as entry
    from (
      select 'schema' as kind, n.oid, 0 as subid, a.*
      from schemas_in_scope n,
        aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a
      union all
      select 'relation', c.oid, 0, a.*
      from pg_catalog.pg_class c
      join schemas_in_scope n on n.oid = c.relnamespace,
        aclexplode(coalesce(c.relacl, acldefault(
          case when c.relkind = 'S' then 's' else 'r' end::"char",
          c.relowner))) a
      where c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
      union all
      select 'column', t.attrelid, t.attnum, a.*
      from pg_catalog.pg_attribute t
      join objects o on o.kind = 'relation' and o.oid = t.attrelid,
        aclexplode(t.attacl) a
      union all
      select 'function', p.oid, 0, a.*
      from pg_catalog.pg_proc p
      join schemas_in_scope n on n.oid = p.pronamespace,
        aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      union all
      select 'type', o.oid, 0, a.*
      from objects o
      join pg_catalog.pg_type y on o.kind = 'type' and y.oid = o.oid,
        aclexplode(coalesce(y.typacl, acldefault('T', y.typowner))) a
      union all
      select 'default', d.oid, 0, a.*
      from pg_catalog.pg_default_acl d,
        aclexplode(d.defaclacl) a
    ) x
  ),
  -- Without grantors, two grantors' identical grants are one entry.
  acls as (
    select kind, oid, subid,
      jsonb_agg(distinct entry order by entry) as acl
    from acl_entries
    group by kind, oid, subid
  ),
  -- Security state of each object outside the application scope. A revoke
  -- shows up even when it removes the last grant, because the whole ACL and
  -- the API roles' effective privileges are recorded.
  managed as (
    select o.kind, o.oid, o.id, o.subkind, o.extname,
      jsonb_build_object(
        'owner', pg_catalog.pg_get_userbyid(o.owner),
        'acl', coalesce((select acl from acls a
          where a.kind = o.kind and a.oid = o.oid and a.subid = 0), '[]'),
        'effective', (
          select coalesce(jsonb_object_agg(r.rolname, (
            select coalesce(jsonb_agg(v order by v), '[]')
            from unnest(case
              when o.kind = 'function' then array['EXECUTE']
              when o.kind = 'type' then array['USAGE']
              when o.subkind = 'S' then array['SELECT', 'UPDATE', 'USAGE']
              else array['DELETE', 'INSERT', 'REFERENCES', 'SELECT',
                'TRIGGER', 'TRUNCATE', 'UPDATE'] end) v
            where case
              when o.kind = 'function'
                then has_function_privilege(r.rolname, o.oid, v)
              when o.kind = 'type'
                then has_type_privilege(r.rolname, o.oid, v)
              when o.subkind = 'S'
                then has_sequence_privilege(r.rolname, o.oid, v)
              else has_table_privilege(r.rolname, o.oid, v) end
          )), '{}')
          from api_roles r
        ),
        'rls_enabled', c.relrowsecurity,
        'rls_forced', c.relforcerowsecurity,
        'security_definer', p.prosecdef,
        'config', case when o.kind = 'function'
          then coalesce(to_jsonb(p.proconfig), '[]') end,
        -- Columns that carry their own grants.
        'columns', case when o.kind = 'relation' then (
          select coalesce(jsonb_agg(jsonb_build_object(
            'name', t.attname,
            'acl', coalesce((select acl from acls a where a.kind = 'column'
              and a.oid = o.oid and a.subid = t.attnum), '[]'),
            'effective', (
              select coalesce(jsonb_object_agg(r.rolname, (
                select coalesce(jsonb_agg(v order by v), '[]')
                from unnest(array['INSERT', 'REFERENCES', 'SELECT', 'UPDATE']) v
                where has_column_privilege(r.rolname, o.oid, t.attnum, v)
              )), '{}')
              from api_roles r
            )
          ) order by t.attnum), '[]')
          from pg_catalog.pg_attribute t
          where t.attrelid = o.oid and t.attnum > 0 and not t.attisdropped
            and t.attacl is not null
        ) end
      ) as state
    from objects o
    left join pg_catalog.pg_class c on o.kind = 'relation' and c.oid = o.oid
    left join pg_catalog.pg_proc p on o.kind = 'function' and p.oid = o.oid
    where not o.application
  ),
  -- Each extension's most common routine state and type state. Members in
  -- that state are folded into the extension's entry, which keeps hundreds of
  -- postgis functions out while any grant or revoke on one of them still
  -- lists it by name.
  extension_common as (
    select distinct on (extname, kind) extname, kind, state
    from managed
    where extname is not null and kind <> 'relation'
    group by extname, kind, state
    order by extname, kind, count(*) desc, state::text
  ),
  body as (
    select jsonb_build_object(
      'format', 'chooselife.catalog.v2',
      'environment', jsonb_build_object(
        'server_version_num', pg_catalog.current_setting('server_version_num'),
        'app_owner', (select pg_catalog.pg_get_userbyid(app_owner) from settings),
        'complete_visibility', (select complete_visibility from settings),
        'extension_versions', (
          select coalesce(jsonb_object_agg(extname, extversion), '{}')
          from pg_catalog.pg_extension
        )
      ),

      'extensions', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', x.extname,
          'schema', x.extnamespace::regnamespace::text,
          'routine_security', (select state from extension_common c
            where c.extname = x.extname and c.kind = 'function'),
          'type_security', (select state from extension_common c
            where c.extname = x.extname and c.kind = 'type')
        ) order by x.extname), '[]')
        from pg_catalog.pg_extension x
      ),

      'schemas', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', n.nspname,
          'owner', pg_catalog.pg_get_userbyid(n.nspowner),
          'extension_member', exists (
            select 1 from extension_members e
            where e.classid = 'pg_catalog.pg_namespace'::regclass
              and e.objid = n.oid
          ),
          'comment', pg_catalog.obj_description(n.oid, 'pg_namespace'),
          'acl', coalesce((select acl from acls
            where kind = 'schema' and oid = n.oid), '[]'),
          'effective', (
            select coalesce(jsonb_object_agg(r.rolname, (
              select coalesce(jsonb_agg(p order by p), '[]')
              from unnest(array['CREATE', 'USAGE']) p
              where has_schema_privilege(r.rolname, n.oid, p)
            )), '{}')
            from api_roles r
          )
        ) order by n.nspname), '[]')
        from schemas_in_scope n
      ),

      'relations', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', c.id,
          'kind', c.relkind,
          'owner', pg_catalog.pg_get_userbyid(c.relowner),
          'persistence', k.relpersistence,
          'options', coalesce(to_jsonb(k.reloptions), '[]'),
          'rls_enabled', k.relrowsecurity,
          'rls_forced', k.relforcerowsecurity,
          'replica_identity', k.relreplident,
          'replica_identity_index', (
            select i.indexrelid::regclass::text from pg_catalog.pg_index i
            where i.indrelid = c.oid and i.indisreplident
          ),
          'partition_of', (
            select h.inhparent::regclass::text from pg_catalog.pg_inherits h
            where h.inhrelid = c.oid and k.relispartition
          ),
          'partition_bound', pg_catalog.pg_get_expr(k.relpartbound, c.oid),
          'partition_key', case when c.relkind = 'p'
            then pg_catalog.pg_get_partkeydef(c.oid) end,
          'inherits', (
            select coalesce(jsonb_agg(h.inhparent::regclass::text
              order by h.inhseqno), '[]')
            from pg_catalog.pg_inherits h
            where h.inhrelid = c.oid and not k.relispartition
          ),
          'view_digest', case when c.relkind in ('v', 'm') then encode(sha256(
            convert_to(replace(pg_catalog.pg_get_viewdef(c.oid),
              E'\r\n', E'\n'), 'UTF8')), 'hex') end,
          'comment', pg_catalog.obj_description(c.oid, 'pg_class'),
          'acl', coalesce((select acl from acls
            where kind = 'relation' and oid = c.oid), '[]'),
          'effective', (
            select coalesce(jsonb_object_agg(r.rolname, (
              select coalesce(jsonb_agg(p order by p), '[]')
              from unnest(case when c.relkind = 'S'
                then array['SELECT', 'UPDATE', 'USAGE']
                else array['DELETE', 'INSERT', 'REFERENCES', 'SELECT',
                  'TRIGGER', 'TRUNCATE', 'UPDATE'] end) p
              where case when c.relkind = 'S'
                then has_sequence_privilege(r.rolname, c.oid, p)
                else has_table_privilege(r.rolname, c.oid, p) end
            )), '{}')
            from api_roles r
          ),
          'sequence', (
            select jsonb_build_object(
              'type', pg_catalog.format_type(q.seqtypid, null),
              'start', q.seqstart::text,
              'increment', q.seqincrement::text,
              'min', q.seqmin::text,
              'max', q.seqmax::text,
              'cache', q.seqcache::text,
              'cycle', q.seqcycle,
              'owned_by', (
                select format('%s.%I', d.refobjid::regclass, a.attname)
                from pg_catalog.pg_depend d
                join pg_catalog.pg_attribute a
                  on a.attrelid = d.refobjid and a.attnum = d.refobjsubid
                where d.classid = 'pg_catalog.pg_class'::regclass
                  and d.objid = c.oid
                  and d.refclassid = 'pg_catalog.pg_class'::regclass
                  and d.deptype in ('a', 'i')
              )
            )
            from pg_catalog.pg_sequence q where q.seqrelid = c.oid
          ),
          'columns', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'name', a.attname,
              'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
              'not_null', a.attnotnull,
              'default', pg_catalog.pg_get_expr(d.adbin, d.adrelid),
              'identity', nullif(a.attidentity, ''),
              'generated', nullif(a.attgenerated, ''),
              'collation', case when a.attcollation <> t.typcollation
                then a.attcollation::regcollation::text end,
              'comment', pg_catalog.col_description(c.oid, a.attnum),
              'acl', coalesce((select acl from acls where kind = 'column'
                and oid = c.oid and subid = a.attnum), '[]'),
              -- Column grants only widen table grants, so this is needed
              -- only where a column ACL exists.
              'effective', case when a.attacl is not null then (
                select coalesce(jsonb_object_agg(r.rolname, (
                  select coalesce(jsonb_agg(p order by p), '[]')
                  from unnest(array['INSERT', 'REFERENCES', 'SELECT', 'UPDATE']) p
                  where has_column_privilege(r.rolname, c.oid, a.attnum, p)
                )), '{}')
                from api_roles r
              ) end
            ) order by a.attnum), '[]')
            from pg_catalog.pg_attribute a
            join pg_catalog.pg_type t on t.oid = a.atttypid
            left join pg_catalog.pg_attrdef d
              on d.adrelid = a.attrelid and d.adnum = a.attnum
            where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
              and c.relkind <> 'S'
          )
        ) order by c.id), '[]')
        from relations c
        join pg_catalog.pg_class k on k.oid = c.oid
      ),

      'constraints', (
        select coalesce(jsonb_agg(x.item order by x.item->>'id'), '[]')
        from (
          select jsonb_build_object(
            'id', case when o.conrelid <> 0
              then format('%s.%I', o.conrelid::regclass, o.conname)
              else format('%s.%I', o.contypid::regtype, o.conname) end,
            'on', case when o.conrelid <> 0 then 'table' else 'domain' end,
            'type', o.contype,
            'definition', pg_catalog.pg_get_constraintdef(o.oid),
            'deferrable', o.condeferrable,
            'deferred', o.condeferred,
            'validated', o.convalidated,
            'comment', pg_catalog.obj_description(o.oid, 'pg_constraint')
          ) as item
          from pg_catalog.pg_constraint o
          where o.conrelid in (select oid from relations)
            or o.contypid in (select oid from types)
        ) x
      ),

      'indexes', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', i.indexrelid::regclass::text,
          'table', i.indrelid::regclass::text,
          'definition', pg_catalog.pg_get_indexdef(i.indexrelid),
          'unique', i.indisunique,
          'primary', i.indisprimary,
          'valid', i.indisvalid,
          'constraint', exists (
            select 1 from pg_catalog.pg_constraint o
            where o.conindid = i.indexrelid and o.conrelid = i.indrelid
              and o.contype in ('p', 'u', 'x')
          ),
          'comment', pg_catalog.obj_description(i.indexrelid, 'pg_class')
        ) order by i.indexrelid::regclass::text), '[]')
        from pg_catalog.pg_index i
        where i.indrelid in (select oid from relations)
      ),

      'types', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', t.id,
          'kind', y.typtype,
          'owner', pg_catalog.pg_get_userbyid(y.typowner),
          'labels', case when y.typtype = 'e' then (
            select jsonb_agg(e.enumlabel order by e.enumsortorder)
            from pg_catalog.pg_enum e where e.enumtypid = t.oid
          ) end,
          'base_type', case when y.typtype = 'd'
            then pg_catalog.format_type(y.typbasetype, y.typtypmod) end,
          'not_null', y.typnotnull,
          'default', y.typdefault,
          'attributes', case when y.typtype = 'c' then (
            select jsonb_agg(jsonb_build_object(
              'name', a.attname,
              'type', pg_catalog.format_type(a.atttypid, a.atttypmod)
            ) order by a.attnum)
            from pg_catalog.pg_attribute a
            where a.attrelid = y.typrelid and a.attnum > 0
              and not a.attisdropped
          ) end,
          'comment', pg_catalog.obj_description(t.oid, 'pg_type'),
          'acl', coalesce((select acl from acls
            where kind = 'type' and oid = t.oid), '[]')
        ) order by t.id), '[]')
        from types t
        join pg_catalog.pg_type y on y.oid = t.oid
      ),

      'functions', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', f.id,
          'kind', p.prokind,
          'owner', pg_catalog.pg_get_userbyid(p.proowner),
          'language', (
            select lanname from pg_catalog.pg_language where oid = p.prolang),
          'returns', pg_catalog.pg_get_function_result(p.oid),
          -- The full signature, including argument defaults.
          'arguments_digest', encode(sha256(convert_to(replace(
            pg_catalog.pg_get_function_arguments(p.oid),
            E'\r\n', E'\n'), 'UTF8')), 'hex'),
          'body_digest', encode(sha256(convert_to(replace(
            coalesce(pg_catalog.pg_get_function_sqlbody(p.oid), p.prosrc),
            E'\r\n', E'\n'), 'UTF8')), 'hex'),
          'security_definer', p.prosecdef,
          'volatility', p.provolatile,
          'strict', p.proisstrict,
          'leakproof', p.proleakproof,
          'parallel', p.proparallel,
          'cost', p.procost::text,
          'rows', p.prorows::text,
          'config', coalesce(to_jsonb(p.proconfig), '[]'),
          'comment', pg_catalog.obj_description(p.oid, 'pg_proc'),
          'acl', coalesce((select acl from acls
            where kind = 'function' and oid = p.oid), '[]'),
          'effective', (
            select coalesce(jsonb_object_agg(r.rolname, (
              select coalesce(jsonb_agg(v order by v), '[]')
              from unnest(array['EXECUTE']) v
              where has_function_privilege(r.rolname, p.oid, v)
            )), '{}')
            from api_roles r
          )
        ) order by f.id), '[]')
        from functions f
        join pg_catalog.pg_proc p on p.oid = f.oid
      ),

      'policies', (
        select coalesce(jsonb_agg(x.item order by x.item->>'id'), '[]')
        from (
          select jsonb_build_object(
            'id', format('%s.%I', p.polrelid::regclass, p.polname),
            'table', p.polrelid::regclass::text,
            'command', p.polcmd,
            'permissive', p.polpermissive,
            'roles', (
              select jsonb_agg(g.name order by g.name)
              from (
                select case when r = 0 then 'PUBLIC'
                  else pg_catalog.pg_get_userbyid(r) end as name
                from unnest(p.polroles) r
              ) g
            ),
            'using_digest', encode(sha256(convert_to(replace(
              pg_catalog.pg_get_expr(p.polqual, p.polrelid),
              E'\r\n', E'\n'), 'UTF8')), 'hex'),
            'check_digest', encode(sha256(convert_to(replace(
              pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid),
              E'\r\n', E'\n'), 'UTF8')), 'hex'),
            'comment', pg_catalog.obj_description(p.oid, 'pg_policy')
          ) as item
          from pg_catalog.pg_policy p
          join objects o on o.kind = 'relation' and o.oid = p.polrelid
        ) x
      ),

      'triggers', (
        select coalesce(jsonb_agg(x.item order by x.item->>'id'), '[]')
        from (
          select jsonb_build_object(
            'id', format('%s.%I', g.tgrelid::regclass, g.tgname),
            'table', g.tgrelid::regclass::text,
            'function', g.tgfoid::regprocedure::text,
            'enabled', g.tgenabled,
            'timing', case
              when g.tgtype & 2 <> 0 then 'BEFORE'
              when g.tgtype & 64 <> 0 then 'INSTEAD OF'
              else 'AFTER' end,
            'level', case when g.tgtype & 1 <> 0 then 'ROW' else 'STATEMENT' end,
            'events', (
              select jsonb_agg(b.event order by b.event)
              from (values (4, 'INSERT'), (8, 'DELETE'), (16, 'UPDATE'),
                (32, 'TRUNCATE')) b(bit, event)
              where g.tgtype & b.bit <> 0
            ),
            'constraint', g.tgconstraint <> 0,
            'deferrable', g.tgdeferrable,
            'deferred', g.tginitdeferred,
            -- The definition includes WHEN, columns and arguments, which may
            -- hold credentials for webhook triggers.
            'definition_digest', encode(sha256(convert_to(replace(
              pg_catalog.pg_get_triggerdef(g.oid), E'\r\n', E'\n'), 'UTF8')),
              'hex'),
            'comment', pg_catalog.obj_description(g.oid, 'pg_trigger')
          ) as item
          from pg_catalog.pg_trigger g
          join objects o on o.kind = 'relation' and o.oid = g.tgrelid
          where not g.tgisinternal
        ) x
      ),

      'rules', (
        select coalesce(jsonb_agg(x.item order by x.item->>'id'), '[]')
        from (
          select jsonb_build_object(
            'id', format('%s.%I', w.ev_class::regclass, w.rulename),
            'enabled', w.ev_enabled,
            'definition_digest', encode(sha256(convert_to(replace(
              pg_catalog.pg_get_ruledef(w.oid), E'\r\n', E'\n'), 'UTF8')),
              'hex')
          ) as item
          from pg_catalog.pg_rewrite w
          where w.rulename <> '_RETURN'
            and w.ev_class in (select oid from objects where kind = 'relation')
        ) x
      ),

      'event_triggers', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', v.evtname,
          'owner', pg_catalog.pg_get_userbyid(v.evtowner),
          'event', v.evtevent,
          'function', v.evtfoid::regprocedure::text,
          'enabled', v.evtenabled,
          'tags', coalesce(to_jsonb(v.evttags), '[]')
        ) order by v.evtname), '[]')
        from pg_catalog.pg_event_trigger v
      ),

      'default_acls', (
        select coalesce(jsonb_agg(x.item order by x.item->>'id'), '[]')
        from (
          select jsonb_build_object(
            'id', format('%s:%s:%s', pg_catalog.pg_get_userbyid(d.defaclrole),
              coalesce(nullif(d.defaclnamespace, 0)::regnamespace::text, '*'),
              d.defaclobjtype),
            'acl', coalesce((select acl from acls
              where kind = 'default' and oid = d.oid), '[]')
          ) as item
          from pg_catalog.pg_default_acl d
        ) x
      ),

      -- Platform objects and extension members not folded into their
      -- extension's entry. Schema ACLs are under schemas.
      'managed_security', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', m.kind || ' ' || m.id,
          'kind', m.subkind,
          'extension', m.extname
        ) || m.state order by m.kind || ' ' || m.id), '[]')
        from managed m
        where not exists (
          select 1 from extension_common x
          where x.extname = m.extname and x.kind = m.kind and x.state = m.state
        )
      ),

      'publications', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', b.pubname,
          'owner', pg_catalog.pg_get_userbyid(b.pubowner),
          'all_tables', b.puballtables,
          'insert', b.pubinsert,
          'update', b.pubupdate,
          'delete', b.pubdelete,
          'truncate', b.pubtruncate,
          'via_root', b.pubviaroot,
          'schemas', (
            select coalesce(jsonb_agg(m.name order by m.name), '[]')
            from (
              select pnnspid::regnamespace::text as name
              from pg_catalog.pg_publication_namespace
              where pnpubid = b.oid
            ) m
          )
        ) order by b.pubname), '[]')
        from pg_catalog.pg_publication b
      ),

      'publication_tables', (
        select coalesce(jsonb_agg(x.item order by x.item->>'id'), '[]')
        from (
          select jsonb_build_object(
            'id', b.pubname || ':' || m.prrelid::regclass::text,
            'columns', (
              select jsonb_agg(a.attname order by k.ord)
              from unnest(m.prattrs::int2[]) with ordinality k(attnum, ord)
              join pg_catalog.pg_attribute a
                on a.attrelid = m.prrelid and a.attnum = k.attnum
            ),
            'row_filter_digest', encode(sha256(convert_to(replace(
              pg_catalog.pg_get_expr(m.prqual, m.prrelid),
              E'\r\n', E'\n'), 'UTF8')), 'hex')
          ) as item
          from pg_catalog.pg_publication_rel m
          join pg_catalog.pg_publication b on b.oid = m.prpubid
        ) x
      ),

      -- A job's identity is its name. Run history, job IDs, node host and
      -- port, and timestamps are runtime state.
      'cron_jobs', (
        select coalesce(jsonb_agg(x.item order by x.item->>'id'), '[]')
        from (
          select jsonb_build_object(
            'id', coalesce(j.jobname, 'unnamed:' || h.digest),
            'schedule', j.schedule,
            'active', j.active,
            'database', j.database,
            'username', j.username,
            'command_digest', h.digest
          ) as item
          from cron.job j,
            lateral (select encode(sha256(convert_to(
              replace(j.command, E'\r\n', E'\n'), 'UTF8')), 'hex') as digest) h
        ) x
      ),

      -- Bucket configuration, not stored objects or ownership. Buckets are
      -- identified by name: a migration that inserts gen_random_uuid() ids
      -- gives every environment a different id, so only whether the id is
      -- the name is compared.
      'storage_buckets', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', b.name,
          'id_is_name', b.id = b.name,
          'public', b.public,
          'file_size_limit', to_jsonb(b) -> 'file_size_limit',
          'allowed_mime_types', to_jsonb(b) -> 'allowed_mime_types'
        ) order by b.name), '[]')
        from storage.buckets b
      )
    ) as document
    from pinned
  )
select document || jsonb_build_object('counts', (
    select jsonb_object_agg(key, jsonb_array_length(value))
    from jsonb_each(document)
    where jsonb_typeof(value) = 'array'
  )) as catalog
from body;
