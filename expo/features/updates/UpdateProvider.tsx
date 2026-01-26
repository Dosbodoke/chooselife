import React, { createContext, useContext } from 'react';

import { useOtaUpdate, OtaUpdateState, OtaUpdateActions } from './hooks/useOtaUpdate';
import { useStoreUpdate, StoreUpdateState, StoreUpdateActions } from './hooks/useStoreUpdate';

interface UpdateContextType {
  ota: OtaUpdateState & OtaUpdateActions;
  store: StoreUpdateState & StoreUpdateActions;
}

const UpdateContext = createContext<UpdateContextType | undefined>(undefined);

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const ota = useOtaUpdate();
  const store = useStoreUpdate();

  const contextValue: UpdateContextType = {
    ota,
    store,
  };

  return <UpdateContext.Provider value={contextValue}>{children}</UpdateContext.Provider>;
}

export function useUpdate(): UpdateContextType {
  const context = useContext(UpdateContext);
  if (context === undefined) {
    throw new Error('useUpdate must be used within an UpdateProvider');
  }
  return context;
}
