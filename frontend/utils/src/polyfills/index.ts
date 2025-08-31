/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

if (typeof Promise.withResolvers === "undefined") {
  Promise.withResolvers = <T>() => {
    let promiseResolve: PromiseWithResolvers<T>["resolve"]
    let promiseReject: PromiseWithResolvers<T>["reject"]
    const promise = new Promise<T>((resolve, reject) => {
      promiseResolve = resolve
      promiseReject = reject
    })
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return { resolve: promiseResolve!, reject: promiseReject!, promise }
  }
}

declare global {
  interface PromiseWithResolvers<T> {
    promise: Promise<T>
    resolve: (value: T | PromiseLike<T>) => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    reject: (reason?: any) => void
  }

  interface PromiseConstructor {
    withResolvers<T>(): PromiseWithResolvers<T>
  }
}

export {}
