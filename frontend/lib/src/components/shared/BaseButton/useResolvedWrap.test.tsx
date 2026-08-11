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

import { ReactElement } from "react"

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  FlexContext,
  IFlexContext,
} from "~lib/components/core/Layout/FlexContext"
import { Direction } from "~lib/components/core/Layout/utils"

import { useResolvedWrap } from "./useResolvedWrap"

function Probe({ wrap }: { wrap: boolean | null | undefined }): ReactElement {
  const resolved = useResolvedWrap(wrap)
  return <span data-testid="out">{String(resolved)}</span>
}

const horizontalContext: IFlexContext = {
  direction: Direction.HORIZONTAL,
  isInHorizontalLayout: true,
  isInRoot: false,
  isInContentWidthContainer: false,
}

const verticalContext: IFlexContext = {
  ...horizontalContext,
  direction: Direction.VERTICAL,
  isInHorizontalLayout: false,
}

describe("useResolvedWrap", () => {
  it("auto (null) wraps outside a horizontal layout", () => {
    render(<Probe wrap={null} />)
    expect(screen.getByTestId("out")).toHaveTextContent("true")
  })

  it("auto (undefined) does not wrap inside a horizontal layout", () => {
    render(
      <FlexContext.Provider value={horizontalContext}>
        <Probe wrap={undefined} />
      </FlexContext.Provider>
    )
    expect(screen.getByTestId("out")).toHaveTextContent("false")
  })

  it("auto wraps inside a vertical layout", () => {
    render(
      <FlexContext.Provider value={verticalContext}>
        <Probe wrap={null} />
      </FlexContext.Provider>
    )
    expect(screen.getByTestId("out")).toHaveTextContent("true")
  })

  it("explicit true overrides a horizontal layout", () => {
    render(
      <FlexContext.Provider value={horizontalContext}>
        <Probe wrap={true} />
      </FlexContext.Provider>
    )
    expect(screen.getByTestId("out")).toHaveTextContent("true")
  })

  it("explicit false overrides a vertical layout", () => {
    render(
      <FlexContext.Provider value={verticalContext}>
        <Probe wrap={false} />
      </FlexContext.Provider>
    )
    expect(screen.getByTestId("out")).toHaveTextContent("false")
  })
})
