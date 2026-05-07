#!/bin/bash
set -euo pipefail

PACKAGE_TYPES_PATH="./packages/database/database-generated.types.ts"

# Create a secure temporary file path
TEMP_FILE=$(mktemp)
# Check if mktemp failed (e.g., permissions)
if [ $? -ne 0 ]; then
    echo "Error: Failed to create temporary file."
    exit 1
fi

# Ensure cleanup happens even if the script exits unexpectedly (e.g., Ctrl+C)
# This trap will execute the command when the script exits for any reason (EXIT)
# or encounters an error (ERR), is terminated (TERM), or interrupted (INT).
# -f ensures rm doesn't complain if the file is already gone.
trap 'echo "Cleaning up..."; rm -f "$TEMP_FILE"' EXIT ERR TERM INT

echo "Generating database types from the local Supabase instance..."
supabase gen types typescript --local --schema storage,public,functions > "$TEMP_FILE"

# Optional: Check if the generated file actually has content
if [ ! -s "$TEMP_FILE" ]; then
    echo "Error: Generated types file ($TEMP_FILE) is empty."
    exit 1
fi

echo "Updating shared database types at $PACKAGE_TYPES_PATH"
mkdir -p "$(dirname "$PACKAGE_TYPES_PATH")"
cp "$TEMP_FILE" "$PACKAGE_TYPES_PATH"

echo "Success! Database types updated."

exit 0
