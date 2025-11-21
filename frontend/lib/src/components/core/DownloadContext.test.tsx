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
import React, { useContext } from "react"

import { screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { DeferredFileResponse } from "@streamlit/protobuf"

import { render } from "~lib/test_util"

import { DownloadContext } from "./DownloadContext"

function Consumer(): JSX.Element {
  const { requestDeferredFile } = useContext(DownloadContext)
  return (
    <div>
      <div data-testid="hasFn">
        {requestDeferredFile ? "provided" : "missing"}
      </div>
      <button
        onClick={() => {
          if (requestDeferredFile) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises -- fire and forget in test
            requestDeferredFile("file-123")
          }
        }}
      >
        call
      </button>
    </div>
  )
}

describe("DownloadContext", () => {
  it("defaults to undefined requestDeferredFile", () => {
    render(<Consumer />)
    expect(screen.getByTestId("hasFn")).toHaveTextContent("missing")
  })

  it("provides requestDeferredFile via provider", async () => {
    const user = userEvent.setup()
    const mockRequest = vi.fn().mockResolvedValue(
      DeferredFileResponse.create({
        url: "/media/generated",
        errorMsg: "",
      })
    )
    render(
      <DownloadContext.Provider value={{ requestDeferredFile: mockRequest }}>
        <Consumer />
      </DownloadContext.Provider>
    )

    expect(screen.getByTestId("hasFn")).toHaveTextContent("provided")

    await user.click(screen.getByRole("button", { name: "call" }))
    expect(mockRequest).toHaveBeenCalledWith("file-123")
  })
})
