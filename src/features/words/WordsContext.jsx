import { createContext, useContext } from "react";
import { ActiveGroupScopeProvider } from "../wordGroups/ActiveGroupScopeContext.jsx";
import { useSupabaseAuth } from "../auth/useSupabaseAuth.js";
import { useWords } from "./useWords.js";

const WordsContext = createContext(null);

export function WordsProvider({ children }) {
  const authState = useSupabaseAuth();
  const wordsState = useWords({
    isAuthLoading: authState.isAuthLoading,
    user: authState.user,
  });

  return (
    <WordsContext.Provider value={{ ...authState, ...wordsState }}>
      <ActiveGroupScopeProvider user={authState.user}>{children}</ActiveGroupScopeProvider>
    </WordsContext.Provider>
  );
}

export function useWordsContext() {
  const context = useContext(WordsContext);

  if (!context) {
    throw new Error("useWordsContext must be used inside WordsProvider.");
  }

  return context;
}
