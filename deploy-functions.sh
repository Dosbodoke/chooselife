#!/bin/bash
set -e

# Define color codes
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting deployment of Supabase Edge Functions...${NC}"

# 1. Deploy create-abacate-pay-charge with --no-verify-jwt
# This function requires the JWT verification to be skipped.
echo -e "${GREEN}Deploying create-abacate-pay-charge (with --no-verify-jwt)...${NC}"
npx supabase functions deploy create-abacate-pay-charge --no-verify-jwt

# 2. Deploy abacate-pay-webhook
# This function is configured with verify_jwt = false in config.toml, but explicit deployment is safe.
echo -e "${GREEN}Deploying abacate-pay-webhook...${NC}"
npx supabase functions deploy abacate-pay-webhook --no-verify-jwt

# 3. Deploy other functions (Standard deployment)
echo -e "${GREEN}Deploying generate-renewal-payments...${NC}"
npx supabase functions deploy generate-renewal-payments

echo -e "${GREEN}Deploying push-notification...${NC}"
npx supabase functions deploy push-notification

echo -e "${GREEN}Deploying start-subscription...${NC}"
npx supabase functions deploy start-subscription

echo -e "${GREEN}Deploying user-self-deletion...${NC}"
npx supabase functions deploy user-self-deletion

echo -e "${GREEN}All functions deployed successfully!${NC}"
