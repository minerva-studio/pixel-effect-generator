import { describe, expect, it } from 'vitest'
import { createFileOperationLock, runFileTask, type FileOperationController } from './fileOperations'

describe('createFileOperationLock', () => {
  it('lets the first task win and rejects concurrent tasks', () => {
    const lock = createFileOperationLock()
    expect(lock.tryStart('projectSave')).toBe(true)
    expect(lock.current).toBe('projectSave')
    expect(lock.tryStart('gif')).toBe(false)
    expect(lock.current).toBe('projectSave')
  })

  it('only lets the owning task release the lock', () => {
    const lock = createFileOperationLock()
    lock.tryStart('unityPackage')
    lock.finish('gif')
    expect(lock.current).toBe('unityPackage')
    lock.finish('unityPackage')
    expect(lock.current).toBeNull()
  })

  it('accepts the next task after the current one finishes', () => {
    const lock = createFileOperationLock()
    lock.tryStart('frameZip')
    lock.finish('frameZip')
    expect(lock.tryStart('apng')).toBe(true)
    expect(lock.current).toBe('apng')
  })
})

describe('runFileTask', () => {
  function controller(): FileOperationController {
    const lock = createFileOperationLock()
    return {
      get activeTask() {
        return lock.current
      },
      tryStart: (task) => lock.tryStart(task),
      finish: (task) => lock.finish(task),
    }
  }

  it('returns the operation result and releases the lock', () => {
    const operations = controller()
    expect(runFileTask(operations, 'gif', () => 42)).toBe(42)
    expect(operations.activeTask).toBeNull()
  })

  it('returns undefined and keeps the existing task when busy', () => {
    const operations = controller()
    operations.tryStart('projectSave')
    expect(runFileTask(operations, 'gif', () => 1)).toBeUndefined()
    expect(operations.activeTask).toBe('projectSave')
  })

  it('releases the lock even when the operation throws', () => {
    const operations = controller()
    expect(() => runFileTask(operations, 'frameZip', () => { throw new Error('boom') })).toThrow('boom')
    expect(operations.activeTask).toBeNull()
    expect(operations.tryStart('apng')).toBe(true)
  })
})
