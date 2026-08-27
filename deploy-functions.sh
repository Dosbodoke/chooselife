#!/bin/bash
set -e

# Define color codes
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting deployment of Supabase Edge Functions...${NC}"

echo -e "${GREEN}Deploying push-notification...${NC}"
npx supabase functions deploy push-notification

echo -e "${GREEN}Deploying user-self-deletion...${NC}"
npx supabase functions deploy user-self-deletion

echo -e "${GREEN}All functions deployed successfully!${NC}"
