import { createContext, useContext } from "react";
import { useActiveGroupScopeLoader } from "./useActiveGroupScopeLoader.js";

const ActiveGroupScopeContext = createContext(null);

export function ActiveGroupScopeProvider({ children, user }) {
  const scopeState = useActiveGroupScopeLoader(user);

  return (
    <ActiveGroupScopeContext.Provider value={scopeState}>{children}</ActiveGroupScopeContext.Provider>
  );
}

export function useActiveGroupScopeContext() {
  const context = useContext(ActiveGroupScopeContext);

  if (!context) {
    throw new Error("useActiveGroupScopeContext must be used inside ActiveGroupScopeProvider.");
  }

  return context;
}
