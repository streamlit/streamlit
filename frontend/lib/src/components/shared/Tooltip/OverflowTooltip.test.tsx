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

import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import ThemeProvider from "~lib/components/core/ThemeProvider"
import { mockTheme } from "~lib/mocks/mockTheme"

import OverflowTooltip from "./OverflowTooltip"
import { Placement } from "./Tooltip"

const { useRefMock, useEffectMock } = vi.hoisted(() => ({
  useRefMock: vi.fn(),
  useEffectMock: vi.fn((f: () => void) => f()),
}))

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react")

  return {
    ...actual,
    useRef: useRefMock,
    useEffect: useEffectMock,
  }
})

// Mock useWindowDimensionsContext to avoid WindowDimensionsProvider,
// which uses hooks that conflict with the global useRef/useEffect mocks.
vi.mock(
  "~lib/components/shared/WindowDimensions/useWindowDimensionsContext",
  () => ({
    useWindowDimensionsContext: () => ({
      fullWidth: 1000,
      fullHeight: 700,
      innerWidth: 1024,
      innerHeight: 768,
    }),
  })
)

const wrapper = ({ children }: { children: React.ReactNode }): JSX.Element => (
  <ThemeProvider theme={mockTheme.emotion}>{children}</ThemeProvider>
)

describe("Tooltip component", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("should render when it fits onscreen", async () => {
    const user = userEvent.setup()
    useRefMock.mockReturnValue({
      current: {
        // Pretend the body is greater than its onscreen area.
        offsetWidth: 200,
        scrollWidth: 100,
      },
    })

    render(
      <OverflowTooltip
        content="the content"
        placement={Placement.AUTO}
        style={{}}
      >
        the child
      </OverflowTooltip>,
      { wrapper }
    )

    const tooltip = screen.getByTestId("stTooltipHoverTarget")
    await user.hover(tooltip)

    expect(screen.queryByText("the content")).not.toBeInTheDocument()

    expect(useRefMock).toHaveBeenCalledWith(null)
  })

  it("should render when ellipsized", async () => {
    const user = userEvent.setup()
    useRefMock.mockReturnValue({
      current: {
        // Pretend the body is smaller than its onscreen area.
        offsetWidth: 100,
        scrollWidth: 200,
      },
    })

    render(
      <OverflowTooltip
        content="the content"
        placement={Placement.AUTO}
        style={{}}
      >
        the child
      </OverflowTooltip>,
      { wrapper }
    )

    const tooltip = screen.getByTestId("stTooltipHoverTarget")
    await user.hover(tooltip)

    const tooltipContent = await screen.findByText("the content")
    expect(tooltipContent).toBeInTheDocument()

    expect(useRefMock).toHaveBeenCalledWith(null)
  })
})
