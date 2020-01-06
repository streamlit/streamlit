/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

/**
 * A promise wrapper that makes resolve/reject functions public.
 */
export default class Resolver<T> {
  public resolve: (arg?: T) => void | Promise<any>
  public reject: (reason?: any) => void | Promise<any>
  public promise: Promise<T>

  constructor() {
    // Initialize to something so TS is happy.
    this.resolve = () => {}
    this.reject = () => {}

    this.promise = new Promise<T>((resFn, rejFn) => {
      this.resolve = resFn
      this.reject = rejFn
    })
  }
}
