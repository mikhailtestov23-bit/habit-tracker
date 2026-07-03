import { AsyncLocalStorage } from "node:async_hooks";
import { UserProfile } from "@/lib/types";

const userStorage = new AsyncLocalStorage<UserProfile>();

export function runWithRequestUser<T>(user: UserProfile, callback: () => T) {
  return userStorage.run(user, callback);
}

export function getRequestUser() {
  return userStorage.getStore() || null;
}
