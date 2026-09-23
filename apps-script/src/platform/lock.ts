export interface ExclusiveLock {
  runExclusive<T>(operation: () => T): T;
}

export class AppsScriptExclusiveLock implements ExclusiveLock {
  runExclusive<T>(operation: () => T) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10_000)) throw new Error("SUBMISSION_BUSY");
    try {
      return operation();
    } finally {
      lock.releaseLock();
    }
  }
}
