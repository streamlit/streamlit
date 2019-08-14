/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 *
 * @fileoverview Utility functions
 */


import xxhash from 'xxhashjs'

/**
 * Wraps a function to allow it to be called, at most, once per interval
 * (specified in milliseconds). If the wrapper function is called N times
 * within that interval, only the Nth call will go through.  The function
 * will only be called after the full interval has elapsed since the last
 * call.
 */
export function debounce(delay: number, fn: any): any {
  let timerId: any

  return function(...args: any[]) {
    if (timerId) {
      clearTimeout(timerId)
    }

    timerId = setTimeout(() => {
      fn(...args)
      timerId = null
    }, delay)
  }
}



export function hashString(str: string): string {
  return xxhash.h32(str, 0xDEADBEEF).toString(16)
}
