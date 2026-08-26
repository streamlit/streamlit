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
import { useContext } from "react"

import { render, screen } from "@testing-library/react"

import { BackendOperationClient } from "~lib/BackendOperationClient"

import { BackendOperationContext } from "./BackendOperationContext"

function Consumer(): JSX.Element {
  const { backendOperationClient } = useContext(BackendOperationContext)
  return (
    <div data-testid="hasClient">
      {backendOperationClient ? "provided" : "missing"}
    </div>
  )
}

describe("BackendOperationContext", () => {
  it("defaults to undefined backendOperationClient", () => {
    render(<Consumer />)
    expect(screen.getByTestId("hasClient")).toHaveTextContent("missing")
  })

  it("provides backendOperationClient via provider", () => {
    const backendOperationClient = new BackendOperationClient({
      sendRequest: vi.fn(),
      getSessionId: () => "session-id",
    })

    render(
      <BackendOperationContext.Provider value={{ backendOperationClient }}>
        <Consumer />
      </BackendOperationContext.Provider>
    )

    expect(screen.getByTestId("hasClient")).toHaveTextContent("provided")
  })
})
