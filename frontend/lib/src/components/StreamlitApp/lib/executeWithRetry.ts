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

// Typescript function that will execute a promise that will resolve if successful
// but it will retry if it fails. Retry will adjust in time
// and will stop after a certain number of retries.
export function executeWithRetry<T>(
  asyncFn: () => Promise<T>,
  minimumTimeoutMs: number,
  maximumTimeoutMs: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Promises always have type any
  onRetry: (error: any) => void
): Promise<T> {
  return new Promise<T>((resolve, _reject) => {
    let totalTries = 0

    const execute = (): void => {
      totalTries += 1
      asyncFn()
        .then(resolve)
        .catch(error => {
          // Adjust retry time by +- 20% to spread out load
          const jitter = Math.random() * 0.4 - 0.2
          // Exponential backoff to reduce load from health pings when experiencing
          // persistent failure. Starts at minimumTimeoutMs.
          const timeoutMs =
            totalTries === 1
              ? minimumTimeoutMs
              : minimumTimeoutMs * 2 ** (totalTries - 1) * (1 + jitter)
          const retryTimeout = Math.min(maximumTimeoutMs, timeoutMs)

          onRetry(error)

          window.setTimeout(execute, retryTimeout)
        })
    }
    execute()
  })
}
