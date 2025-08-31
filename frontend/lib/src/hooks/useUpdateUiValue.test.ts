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

import useUpdateUiValue from "./useUpdateUiValue"

describe("useUpdateUiValue", () => {
  it("should update ui value if values are different and ui value is not dirty", async () => {
    const callback = vi.fn()
    renderHook(() => useUpdateUiValue(4, 2, callback, false))
    await waitFor(() => expect(callback).toHaveBeenCalledWith(4))
  })

  it("should not update ui value if values are different and ui value is dirty", async () => {
    const callback = vi.fn()
    renderHook(() => useUpdateUiValue(4, 2, callback, true))
    await waitFor(() => expect(callback).not.toHaveBeenCalled())
  })

  it("should not update ui value if values are same", async () => {
    const callback = vi.fn()
    renderHook(() => useUpdateUiValue(4, 4, callback, false))
    await waitFor(() => expect(callback).not.toHaveBeenCalled())
  })
})
