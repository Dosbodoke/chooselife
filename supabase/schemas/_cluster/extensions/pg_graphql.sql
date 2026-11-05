-- Historical migrations enable GraphQL explicitly. The live exporter omits
-- this platform-default extension, so declare it for independent reconstruction.
CREATE EXTENSION "pg_graphql" SCHEMA "graphql";
