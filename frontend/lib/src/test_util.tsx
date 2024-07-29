/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

/* eslint-disable import/no-extraneous-dependencies */
import React, { ReactElement } from "react"

import {
  render as reactTestingLibraryRender,
  RenderOptions,
  RenderResult,
} from "@testing-library/react"

/* eslint-enable */
import ThemeProvider from "./components/core/ThemeProvider"
import { baseTheme } from "./theme"
import { mockTheme } from "./mocks/mockTheme"
import { LibContext, LibContextProps } from "./components/core/LibContext"

/**
 * Use react-testing-library to render a ReactElement. The element will be
 * wrapped in our ThemeProvider.
 */
export function render(
  ui: ReactElement,
  options?: Omit<RenderOptions, "queries">
): RenderResult {
  return reactTestingLibraryRender(ui, {
    wrapper: ({ children }) => (
      <ThemeProvider theme={mockTheme.emotion}>{children}</ThemeProvider>
    ),
    ...options,
    // TODO: Remove this to have RTL run on React 18
    // react-18-upgrade
    legacyRoot: true,
  })
}

export function mockWindowLocation(hostname: string): void {
  // Mock window.location by creating a new object
  // Source: https://www.benmvp.com/blog/mocking-window-location-methods-jest-jsdom/
  // @ts-expect-error
  delete window.location

  // @ts-expect-error
  window.location = {
    assign: jest.fn(),
    hostname: hostname,
  }
}

/**
 * Use react-testing-library to render a ReactElement. The element will be
 * wrapped in our LibContext.Provider.
 */
export const customRenderLibContext = (
  component: ReactElement,
  overrideLibContextProps: Partial<LibContextProps>
): RenderResult => {
  const defaultLibContextProps = {
    isFullScreen: false,
    setFullScreen: jest.fn(),
    addScriptFinishedHandler: jest.fn(),
    removeScriptFinishedHandler: jest.fn(),
    activeTheme: baseTheme,
    setTheme: jest.fn(),
    availableThemes: [],
    addThemes: jest.fn(),
    onPageChange: jest.fn(),
    currentPageScriptHash: "",
    libConfig: {},
    fragmentIdsThisRun: [],
  }

  return reactTestingLibraryRender(component, {
    wrapper: ({ children }) => (
      <ThemeProvider theme={baseTheme.emotion}>
        <LibContext.Provider
          value={{ ...defaultLibContextProps, ...overrideLibContextProps }}
        >
          {children}
        </LibContext.Provider>
      </ThemeProvider>
    ),
  })
}
