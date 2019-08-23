/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
