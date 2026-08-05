import { describe, expect, it } from 'vitest'
import { toastReducer, type ToastMessage } from '../ToastProvider'

function toast(id: number, kind: ToastMessage['kind'], message = 'msg'): ToastMessage {
  return { id, kind, message }
}

describe('toastReducer', () => {
  it('adds pending, success, and error toasts in order', () => {
    let state = toastReducer([], { type: 'add', toast: toast(1, 'pending') })
    state = toastReducer(state, { type: 'add', toast: toast(2, 'success') })
    state = toastReducer(state, { type: 'add', toast: toast(3, 'error') })
    expect(state.map((item) => item.kind)).toEqual(['pending', 'success', 'error'])
  })

  it('dismisses a toast by id and keeps the rest', () => {
    const state = [
      toast(1, 'pending'),
      toast(2, 'error'),
    ]
    expect(toastReducer(state, { type: 'dismiss', id: 1 }).map((item) => item.id)).toEqual([2])
  })

  it('keeps a failure toast until explicitly dismissed', () => {
    let state = toastReducer([], { type: 'add', toast: toast(1, 'error') })
    state = toastReducer(state, { type: 'dismiss', id: 1 })
    expect(state).toEqual([])
  })
})
