import { loadSyncedRewardState } from "./rewardExtensionsEngine.js";

export function applySyncedRewardMutation(storage, mutate, persist) {
  const currentState = loadSyncedRewardState(storage);
  const result = mutate(currentState);

  if (result?.success) {
    persist(result.state);
  }

  return result;
}
