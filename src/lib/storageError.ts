/** i18n keys for user-resolvable hints about an IndexedDB failure. */
export type StorageErrorMessageKey =
  | "storageErrorBlocked"
  | "storageErrorQuota"
  | "storageErrorVersion"
  | "storageErrorCorrupted"
  | "storageErrorUnknown";

const MESSAGE_KEY_BY_ERROR_NAME: Record<string, StorageErrorMessageKey> = {
  // プライベートブラウズやサイトデータのブロックでIndexedDBが使えない
  SecurityError: "storageErrorBlocked",
  InvalidAccessError: "storageErrorBlocked",
  InvalidStateError: "storageErrorBlocked",
  QuotaExceededError: "storageErrorQuota",
  // 新しいバージョンのアプリで作られたDBを古いアプリで開いた
  VersionError: "storageErrorVersion",
  // ストア欠落や内部エラー（バックエンドの破損など）
  NotFoundError: "storageErrorCorrupted",
  UnknownError: "storageErrorCorrupted",
};

/** Map an IndexedDB error (DOMException name) to an i18n message key. */
export function getStorageErrorMessageKey(
  error: unknown,
): StorageErrorMessageKey {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? error.name
      : undefined;
  if (
    typeof name === "string" &&
    Object.hasOwn(MESSAGE_KEY_BY_ERROR_NAME, name)
  ) {
    return MESSAGE_KEY_BY_ERROR_NAME[name];
  }
  return "storageErrorUnknown";
}
