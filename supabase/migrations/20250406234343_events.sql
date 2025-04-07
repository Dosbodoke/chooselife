CREATE TABLE events (
    id bigint primary key generated always as identity,
    title text NOT NULL,
    description text,
    city text NOT NULL,
    state text,
    country text NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone,
    type text NOT NULL,
    lines integer,
    registration_url text
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow read access for everyone
CREATE POLICY select_events ON events
FOR SELECT
USING (true);
