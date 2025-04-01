#!/bin/bash

NEXTJS_TYPES_PATH="./next/utils/supabase/database-generated.types.ts"
EXPO_TYPES_PATH="./expo/utils/database-generated.types.ts"

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

# Generate types using npx and redirect output TO the temporary file
echo "Generating database types with npx..."
# Use > "$TEMP_FILE" to write the output to the file path stored in the variable
npx supabase@latest gen types typescript --linked --schema storage,public,functions > "$TEMP_FILE"

# Check if generation succeeded
if [ $? -ne 0 ]; then
    echo "Error: Failed to generate types from Supabase"
    # The trap will handle cleanup, but we still need to exit with an error code
    exit 1
fi

# Optional: Check if the generated file actually has content
if [ ! -s "$TEMP_FILE" ]; then
    echo "Error: Generated types file ($TEMP_FILE) is empty."
    exit 1
fi


# Update Next.js types
echo "Updating Next.js types at $NEXTJS_TYPES_PATH"
# Create directory if it doesn't exist (-p handles existing dirs)
mkdir -p "$(dirname "$NEXTJS_TYPES_PATH")"
if [ $? -ne 0 ]; then
    echo "Error: Failed to create directory for Next.js types."
    exit 1
fi
# Copy FROM the temporary file
cp "$TEMP_FILE" "$NEXTJS_TYPES_PATH"
if [ $? -ne 0 ]; then
    echo "Error: Failed to copy types to Next.js path."
    exit 1
fi

# Update Expo types
echo "Updating Expo types at $EXPO_TYPES_PATH"
# Create directory if it doesn't exist (-p handles existing dirs)
mkdir -p "$(dirname "$EXPO_TYPES_PATH")"
if [ $? -ne 0 ]; then
    echo "Error: Failed to create directory for Expo types."
    exit 1
fi
# Copy FROM the temporary file
cp "$TEMP_FILE" "$EXPO_TYPES_PATH"
if [ $? -ne 0 ]; then
    echo "Error: Failed to copy types to Expo path."
    exit 1
fi

echo "Success! Database types updated in both projects."

exit 0
