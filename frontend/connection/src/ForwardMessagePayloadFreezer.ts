/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { ForwardMsg } from "@streamlit/protobuf"

export function freezeForwardMsgPayload(payload: ForwardMsg): void {
  const seen = new WeakSet<object>()
  const stack: unknown[] = [payload]

  while (stack.length > 0) {
    const value = stack.pop()
    if (typeof value !== "object" || value === null) {
      continue
    }

    if (seen.has(value)) {
      continue
    }
    seen.add(value)

    Object.freeze(value)
    stack.push(...Object.values(value))
  }
}
