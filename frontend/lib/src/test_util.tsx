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

import React, { FC, PropsWithChildren, ReactElement } from "react"

import {
  render as reactTestingLibraryRender,
  RenderOptions,
  RenderResult,
} from "@testing-library/react"
import { Vector } from "apache-arrow"

import {
  FormsContext,
  FormsContextProps,
} from "./components/core/FormsContext"
import { FlexContext } from "./components/core/Layout/FlexContext"
import { Direction } from "./components/core/Layout/utils"
import { LibContext, LibContextProps } from "./components/core/LibContext"
import ThemeProvider from "./components/core/ThemeProvider"
import { WindowDimensionsProvider } from "./components/shared/WindowDimensions/Provider"
import { ComponentRegistry } from "./components/widgets/CustomComponent/ComponentRegistry"
import { mockEndpoints } from "./mocks/mocks"
import { mockTheme } from "./mocks/mockTheme"
import { ScriptRunState } from "./ScriptRunState"
import { baseTheme } from "./theme"
import { createFormsData } from "./WidgetStateManager"

const flexContextValue = {
  direction: Direction.VERTICAL,
  isInHorizontalLayout: false,
}

export const TestAppWrapper: FC<PropsWithChildren> = ({ children }) => {
  return (
    <ThemeProvider theme={mockTheme.emotion}>
      <WindowDimensionsProvider>
        <FlexContext.Provider value={flexContextValue}>
          {children}
        </FlexContext.Provider>
      </WindowDimensionsProvider>
    </ThemeProvider>
  )
}

/**
 * Use react-testing-library to render a ReactElement. The element will be
 * wrapped in our ThemeProvider.
 */
export function render(
  ui: ReactElement,
  options?: Omit<RenderOptions, "queries">
): RenderResult {
  return reactTestingLibraryRender(ui, {
    wrapper: ({ children }) => <TestAppWrapper>{children}</TestAppWrapper>,
    ...options,
  })
}

export function mockWindowLocation(hostname: string): void {
  // Mock window.location by creating a new object
  // Source: https://www.benmvp.com/blog/mocking-window-location-methods-jest-jsdom/
  // @ts-expect-error
  delete window.location

  // @ts-expect-error
  window.location = {
    assign: vi.fn(),
    hostname: hostname,
  }
}

/**
 * Use react-testing-library to render a ReactElement. The element will be
 * wrapped in our LibContext.Provider and FormsContext.Provider.
 */
export const renderWithContexts = (
  component: ReactElement,
  overrideLibContextProps: Partial<LibContextProps>,
  overrideFormsContextProps?: Partial<FormsContextProps>
): RenderResult => {
  const defaultLibContextProps = {
    isFullScreen: false,
    setFullScreen: vi.fn(),
    addScriptFinishedHandler: vi.fn(),
    removeScriptFinishedHandler: vi.fn(),
    activeTheme: baseTheme,
    setTheme: vi.fn(),
    availableThemes: [],
    addThemes: vi.fn(),
    onPageChange: vi.fn(),
    currentPageScriptHash: "",
    libConfig: {},
    fragmentIdsThisRun: [],
    locale: "en-US",
    scriptRunState: ScriptRunState.NOT_RUNNING,
    scriptRunId: "script run 123",
    componentRegistry: new ComponentRegistry(mockEndpoints()),
  }

  const defaultFormsContextProps = {
    formsData: createFormsData(),
  }

  return reactTestingLibraryRender(component, {
    wrapper: ({ children }) => (
      <ThemeProvider theme={baseTheme.emotion}>
        <WindowDimensionsProvider>
          <FlexContext.Provider value={flexContextValue}>
            <LibContext.Provider
              value={{ ...defaultLibContextProps, ...overrideLibContextProps }}
            >
              <FormsContext.Provider
                value={{
                  ...defaultFormsContextProps,
                  ...overrideFormsContextProps,
                }}
              >
                {children}
              </FormsContext.Provider>
            </LibContext.Provider>
          </FlexContext.Provider>
        </WindowDimensionsProvider>
      </ThemeProvider>
    ),
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
export function arrayFromVector(vector: any): any {
  if (Array.isArray(vector)) {
    return vector.map(arrayFromVector)
  }

  if (vector instanceof Vector) {
    return Array.from(vector)
  }

  return vector
}
