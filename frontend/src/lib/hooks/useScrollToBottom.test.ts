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

import { renderHook } from "@testing-library/react-hooks"
import useScrollToBottom from "./useScrollToBottom"
import useStateRef from "./useStateRef"

jest.mock("./useScrollSpy")
jest.mock("./useScrollAnimation")
jest.mock("./useStateRef")

describe("useScrollToBottom", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should initialize with proper values", () => {
    const mockedUseStateRef = useStateRef as jest.MockedFunction<
      typeof useStateRef
    >
    mockedUseStateRef.mockImplementation(initialValue => [
      initialValue,
      jest.fn(),
      { current: initialValue },
    ])
    const { result } = renderHook(() => useScrollToBottom())

    expect(result.current).not.toBeNull()
    expect(result.current.current).toBeNull()
  })
})
