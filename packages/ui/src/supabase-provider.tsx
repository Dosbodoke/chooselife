import React, { createContext, useContext } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@chooselife/database';

export type TypedSupabaseClient = SupabaseClient<Database>;

interface SupabaseContextValue {
  supabase: TypedSupabaseClient;
  userId: string | undefined;
}

const SupabaseContext = createContext<SupabaseContextValue | undefined>(undefined);

export interface SupabaseProviderProps {
  children: React.ReactNode;
  supabase: TypedSupabaseClient;
  userId?: string;
}

export function SupabaseProvider({ children, supabase, userId }: SupabaseProviderProps) {
  return (
    <SupabaseContext.Provider value={{ supabase, userId }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
}
