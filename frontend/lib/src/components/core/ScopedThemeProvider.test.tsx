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

import { screen } from "@testing-library/react"
import { createPortal } from "react-dom"

import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { mockTheme } from "~lib/mocks/mockTheme"
import { renderWithContexts } from "~lib/test_util"

import ScopedThemeProvider from "./ScopedThemeProvider"

const OVERRIDE_PRIMARY = "#7c3aed"

function ThemeProbe({ testId }: { testId: string }): ReactElement {
  const theme = useEmotionTheme()
  return <div data-testid={testId}>{theme.colors.primary}</div>
}

function PortaledThemeProbe(): ReactElement {
  const theme = useEmotionTheme()
  return createPortal(
    <div data-testid="portaled-child">{theme.colors.primary}</div>,
    document.body
  )
}

describe("ScopedThemeProvider", () => {
  it("applies the override to children but not siblings", () => {
    renderWithContexts(
      <div>
        <ScopedThemeProvider
          override={{ values: { primaryColor: OVERRIDE_PRIMARY } }}
        >
          <ThemeProbe testId="inside-scope" />
        </ScopedThemeProvider>
        <ThemeProbe testId="outside-scope" />
      </div>
    )

    expect(screen.getByTestId("inside-scope")).toHaveTextContent(
      OVERRIDE_PRIMARY
    )
    expect(screen.getByTestId("outside-scope")).toHaveTextContent(
      mockTheme.emotion.colors.primary
    )
    expect(screen.getByTestId("outside-scope")).not.toHaveTextContent(
      OVERRIDE_PRIMARY
    )
  })

  it("keeps the override on a portaled child", () => {
    renderWithContexts(
      <ScopedThemeProvider
        override={{ values: { primaryColor: OVERRIDE_PRIMARY } }}
      >
        <PortaledThemeProbe />
      </ScopedThemeProvider>
    )

    expect(screen.getByTestId("portaled-child")).toHaveTextContent(
      OVERRIDE_PRIMARY
    )
  })
})
