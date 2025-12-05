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

import { screen } from "@testing-library/react"
import { vi } from "vitest"

import { render } from "@streamlit/lib/testing"

import EventContainer from "./EventContainer"

vi.mock("baseui/toast", () => ({
  PLACEMENT: {
    topRight: "topRight",
  },
  ToasterContainer: ({
    overrides,
  }: {
    overrides: {
      Root: {
        style: Record<string, number | string>
        props: Record<string, string>
      }
    }
  }) => <div {...overrides.Root.props} style={overrides.Root.style} />,
}))

describe("EventContainer Component", () => {
  it("renders Toast Container", () => {
    render(<EventContainer />)

    const toastContainer = screen.getByTestId("stToastContainer")
    expect(toastContainer).toBeInTheDocument()
    expect(toastContainer).toHaveClass("stToastContainer")
  })

  it("offsets toasts below a visible header", () => {
    render(<EventContainer hasHeader={true} />)

    expect(screen.getByTestId("stToastContainer")).toHaveStyle({
      top: "3.75rem",
    })
  })

  it("pins toasts to the top when the header is collapsed", () => {
    render(<EventContainer hasHeader={false} />)

    expect(screen.getByTestId("stToastContainer")).toHaveStyle({
      top: "0px",
    })
  })
})
