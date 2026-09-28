// Never clear authentication, real match records, or a recording outbox.
export function removePracticeRecords(storage: Pick<Storage, "length" | "key" | "removeItem">) {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key === "fairground:practice-match:v1" || key?.startsWith("fairground:shared-practice:v1:")) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
  return keys.length;
}

export function retirePracticeRecords() {
  // iOS private browsing or storage policy can reject even the getter.
  for (const name of ["sessionStorage", "localStorage"] as const) {
    try { removePracticeRecords(window[name]); } catch { /* No usable saved record. */ }
  }
}
