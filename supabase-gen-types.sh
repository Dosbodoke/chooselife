#!/bin/bash
# Generate TypeScript types from a local Supabase database.
#
# Usage: bash supabase-gen-types.sh [--check] [--workdir <Supabase project root>] [--output <artifact path>]
#
# Defaults to this repository's Supabase project and the shared database package
# artifact. --check compares freshly generated types with the artifact without
# modifying it. Exit codes: 0 success or no drift, 1 drift or missing artifact,
# 2 usage, generation or filesystem error.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPABASE_BIN="$REPO_ROOT/node_modules/.bin/supabase"
SCHEMAS="storage,public,functions"

CHECK=false
WORKDIR="$REPO_ROOT"
OUTPUT="$REPO_ROOT/packages/database/database-generated.types.ts"

usage() {
    echo "Usage: bash supabase-gen-types.sh [--check] [--workdir <Supabase project root>] [--output <artifact path>]" >&2
}

fail() {
    echo "Error: $1" >&2
    exit 2
}

while [ $# -gt 0 ]; do
    case "$1" in
        --check)
            CHECK=true
            shift
            ;;
        --workdir | --output)
            if [ $# -lt 2 ] || [ -z "$2" ] || [[ "$2" == --* ]]; then
                usage
                fail "$1 requires a value."
            fi
            if [ "$1" = "--workdir" ]; then WORKDIR="$2"; else OUTPUT="$2"; fi
            shift 2
            ;;
        --linked)
            fail "--linked is not supported; types are generated from a local database only."
            ;;
        -h | --help)
            usage
            exit 0
            ;;
        *)
            usage
            fail "Unknown option: $1"
            ;;
    esac
done

[ -x "$SUPABASE_BIN" ] || fail "Repository Supabase CLI not found at $SUPABASE_BIN. Run pnpm install."
[ -f "$WORKDIR/supabase/config.toml" ] || fail "No supabase/config.toml under workdir $WORKDIR."
WORKDIR="$(cd "$WORKDIR" && pwd)"

# mv into an existing directory would nest the file inside it instead of replacing it.
if [ -e "$OUTPUT" ] && [ ! -f "$OUTPUT" ]; then
    fail "Output $OUTPUT exists but is not a regular file."
fi
OUTPUT_DIR="$(dirname "$OUTPUT")"
NEAREST_DIR="$OUTPUT_DIR"
while [ ! -e "$NEAREST_DIR" ]; do NEAREST_DIR="$(dirname "$NEAREST_DIR")"; done
[ -d "$NEAREST_DIR" ] || fail "Output path component $NEAREST_DIR is not a directory."

if $CHECK; then
    TEMP_FILE="$(mktemp)" || fail "Could not create a temporary file."
else
    mkdir -p "$OUTPUT_DIR" || fail "Could not create output directory $OUTPUT_DIR."
    # Same directory as the artifact so the final mv is an atomic rename.
    TEMP_FILE="$(mktemp "$OUTPUT_DIR/.$(basename "$OUTPUT").XXXXXX")" ||
        fail "Could not create a temporary file in $OUTPUT_DIR."
fi
trap 'rm -f "$TEMP_FILE"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "Generating database types from the local Supabase project at $WORKDIR..." >&2
if ! "$SUPABASE_BIN" --workdir "$WORKDIR" --agent no gen types typescript --local --schema "$SCHEMAS" > "$TEMP_FILE"; then
    fail "Type generation failed; $OUTPUT was not modified."
fi

if [ ! -s "$TEMP_FILE" ] || ! grep -q '^export type Database = ' "$TEMP_FILE"; then
    fail "Generated output is empty or has no exported Database type; $OUTPUT was not modified."
fi

if $CHECK; then
    if [ -e "$OUTPUT" ]; then
        # cmp exits 1 when the bytes differ and above 1 when it cannot compare.
        CMP_STATUS=0
        cmp -s "$TEMP_FILE" "$OUTPUT" || CMP_STATUS=$?
        [ "$CMP_STATUS" -le 1 ] || fail "Could not compare generated types with $OUTPUT."
    else
        CMP_STATUS=1
    fi
    if [ "$CMP_STATUS" -eq 0 ]; then
        echo "Database types are up to date: $OUTPUT" >&2
        exit 0
    fi
    echo "Database types are out of date: $OUTPUT. Run pnpm db:types to regenerate." >&2
    exit 1
fi

chmod 644 "$TEMP_FILE" || fail "Could not set permissions on the generated types; $OUTPUT was not modified."
mv -f "$TEMP_FILE" "$OUTPUT" || fail "Could not replace $OUTPUT; it was not modified."
echo "Database types updated: $OUTPUT" >&2
