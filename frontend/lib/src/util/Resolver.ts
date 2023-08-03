/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

/**
 * A promise wrapper that makes resolve/reject functions public.
 */
export default class Resolver<T> {
  public readonly resolve: (value: T | PromiseLike<T>) => void

  public readonly reject: (reason?: any) => void | Promise<any>

  public readonly promise: Promise<T>

  constructor() {
    // Initialize to something so that TS is happy, then use @ts-expect-error
    // so that we can assign the actually desired values to resolve and reject.
    //
    // This is necessary because TS isn't able to deduce that resolve and
    // reject will always be set in the callback passed to the Promise
    // constructor below.
    this.resolve = () => {}
    this.reject = () => {}

    this.promise = new Promise<T>((resFn, rejFn) => {
      // @ts-expect-error
      this.resolve = resFn
      // @ts-expect-error
      this.reject = rejFn
    })
  }
}
