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

import { renderHook, waitFor } from "@testing-library/react"

import useTimeout from "./useTimeout"

describe("timeout function", () => {
  it("should call the callback function after timeout", async () => {
    const callback = vi.fn()
    const timeoutDelayMs = 50
    renderHook(() => useTimeout(callback, timeoutDelayMs))
    await waitFor(() => expect(callback).toHaveBeenCalledTimes(1), {
      timeout: 2 * timeoutDelayMs,
    })
  })

  it("should not call the callback function when cancel timeout", async () => {
    const callback = vi.fn()
    const timeoutDelayMs = 100
    const { result } = renderHook(() => useTimeout(callback, timeoutDelayMs))
    const clear = result.current
    clear()
    await new Promise(r => setTimeout(r, 2 * timeoutDelayMs))
    expect(callback).toHaveBeenCalledTimes(0)
  })
})
