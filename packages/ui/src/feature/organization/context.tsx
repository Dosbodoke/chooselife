import React, { createContext, useContext } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@chooselife/database';

export type TypedSupabaseClient = SupabaseClient<Database>;

interface OrganizationContextValue {
  supabase: TypedSupabaseClient;
  userId: string | undefined;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

export interface OrganizationProviderProps {
  children: React.ReactNode;
  supabase: TypedSupabaseClient;
  userId?: string;
}

export function OrganizationProvider({ children, supabase, userId }: OrganizationProviderProps) {
  return (
    <OrganizationContext.Provider value={{ supabase, userId }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganizationContext() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganizationContext must be used within an OrganizationProvider');
  }
  return context;
}
