import { useCallback, useRef, useState } from 'react'

/** Heavy file operations that must never run concurrently. */
export type WorkspaceFileTask =
  | 'projectSave'
  | 'projectLoad'
  | 'spriteSheet'
  | 'unityPackage'
  | 'gif'
  | 'apng'
  | 'frameZip'

/** Reactive controller shared by ProjectMenu and ExportPanel. */
export interface FileOperationController {
  readonly activeTask: WorkspaceFileTask | null
  readonly tryStart: (task: WorkspaceFileTask) => boolean
  readonly finish: (task: WorkspaceFileTask) => void
}

/** Pure immediate lock used by the hook so behavior is testable without React. */
export interface FileOperationLock {
  readonly current: WorkspaceFileTask | null
  readonly tryStart: (task: WorkspaceFileTask) => boolean
  readonly finish: (task: WorkspaceFileTask) => void
}

/** Creates a plain lock; only one task can be held at a time. */
export function createFileOperationLock(): FileOperationLock {
  let current: WorkspaceFileTask | null = null
  return {
    get current() {
      return current
    },
    tryStart: (task) => {
      if (current !== null) {
        return false
      }
      current = task
      return true
    },
    finish: (task) => {
      if (current !== task) {
        return
      }
      current = null
    },
  }
}

/**
 * Workspace-wide file operation hook. `tryStart` claims the ref-backed lock in
 * the same event tick so rapid double clicks cannot bypass the React state
 * update; `finish` only releases the matching task.
 */
export function useFileOperationController(): FileOperationController {
  const lockRef = useRef<FileOperationLock | null>(null)
  if (lockRef.current === null) {
    lockRef.current = createFileOperationLock()
  }
  const [activeTask, setActiveTask] = useState<WorkspaceFileTask | null>(null)

  const tryStart = useCallback((task: WorkspaceFileTask): boolean => {
    const acquired = lockRef.current!.tryStart(task)
    if (acquired) {
      setActiveTask(task)
    }
    return acquired
  }, [])

  const finish = useCallback((task: WorkspaceFileTask): void => {
    lockRef.current!.finish(task)
    setActiveTask(lockRef.current!.current)
  }, [])

  return { activeTask, tryStart, finish }
}

/** Runs one guarded synchronous operation and always releases the lock. */
export function runFileTask<T>(
  controller: FileOperationController,
  task: WorkspaceFileTask,
  operation: () => T,
): T | undefined {
  if (!controller.tryStart(task)) {
    return undefined
  }
  try {
    return operation()
  } finally {
    controller.finish(task)
  }
}
