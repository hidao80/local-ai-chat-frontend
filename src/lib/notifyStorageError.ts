import i18n from "i18next";
import { toast } from "sonner";
import { getStorageErrorMessageKey } from "./storageError";

/** i18n keys naming the storage operation that failed (toast title). */
export type StorageActionKey =
  | "configSaveFailed"
  | "configLoadFailed"
  | "chatSaveFailed"
  | "chatLoadFailed"
  | "chatDeleteFailed";

/** Log an IndexedDB failure and show an error toast with a user-resolvable hint. */
export function notifyStorageError(titleKey: StorageActionKey, error: unknown) {
  console.error(error);
  // Collapse failures of the same operation into one toast by id so they don't stack
  toast.error(i18n.t(titleKey), {
    id: titleKey,
    description: i18n.t(getStorageErrorMessageKey(error)),
    duration: 8000,
  });
}
