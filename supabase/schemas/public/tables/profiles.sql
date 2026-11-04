CREATE TABLE "public"."profiles" (
  "id"                 uuid                     NOT NULL,
  "name"               character varying,
  "description"        character varying,
  "birthday"           date,
  "username"           character varying,
  "profile_picture"    text,
  "deletion_requested" timestamp with time zone,
  CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id),
  CONSTRAINT "profiles_username_canonical_check"
    CHECK
    (((username IS NULL) OR (((username)::text = public.normalize_profile_username((username)::text)) AND ((username)::text ~ '^@[a-z0-9._]{3,30}$'::text) AND ((username)::text !~
    '^@\.'::text) AND ((username)::text !~ '\.$'::text) AND ((username)::text !~ '\.\.'::text))))
);

ALTER TABLE "public"."profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX profiles_username_unique_idx ON public.profiles USING btree (lower((username)::text))
  WHERE (username IS NOT NULL);

CREATE TRIGGER normalize_profile_username_before_write
  BEFORE INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_normalized_profile_username();

CREATE POLICY "Public profiles are viewable by everyone." ON "public"."profiles"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "Users can insert their own profile." ON "public"."profiles"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = id));

CREATE POLICY "Users can update own profile." ON "public"."profiles"
  FOR UPDATE
  TO "authenticated"
  USING ((auth.uid() = id));

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "anon", "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "service_role";

REVOKE ALL ON TABLE "public"."profiles" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "postgres";
