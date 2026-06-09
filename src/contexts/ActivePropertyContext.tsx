import { createContext, useContext, useState, type ReactNode } from 'react';

interface ActivePropertyContextType {
  activePropertyId: number | null;
  setActivePropertyId: (id: number | null) => void;
}

const Ctx = createContext<ActivePropertyContextType>({
  activePropertyId: null,
  setActivePropertyId: () => {},
});

export function ActivePropertyProvider({ children }: { children: ReactNode }) {
  const [activePropertyId, setActivePropertyId] = useState<number | null>(null);
  return (
    <Ctx.Provider value={{ activePropertyId, setActivePropertyId }}>
      {children}
    </Ctx.Provider>
  );
}

export function useActiveProperty() {
  return useContext(Ctx);
}
