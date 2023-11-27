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

import { isFunction } from "lodash"

type LogLevel = "debug" | "info" | "warn" | "error"
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- consoling any is okay
type Logger = Record<LogLevel, (...args: any[]) => void>
export const LOG: Logger = {} as Logger
for (const level of ["debug", "info", "warn", "error"] as LogLevel[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- consoling any is okay
  LOG[level] = (...args: any[]) => {
    if (args.length === 1 && isFunction(args[0])) {
      // eslint-disable-next-line no-console -- TODO
      console[level](args[0]())
    } else {
      // eslint-disable-next-line no-console, @typescript-eslint/no-unsafe-argument -- TODO
      console[level](...args)
    }
  }
}
