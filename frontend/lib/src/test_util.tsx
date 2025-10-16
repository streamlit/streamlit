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
import {
  ScriptRunContext,
  ScriptRunContextProps,
} from "./components/core/ScriptRunContext"
import {
  ThemeContext,
  ThemeContextProps,
} from "./components/core/ThemeContext"
import ThemeProvider from "./components/core/ThemeProvider"
import { WindowDimensionsProvider } from "./components/shared/WindowDimensions/Provider"
import { ComponentRegistry } from "./components/widgets/CustomComponent/ComponentRegistry"
import { mockEndpoints } from "./mocks/mocks"
import { mockTheme } from "./mocks/mockTheme"
import { ScriptRunState } from "./ScriptRunState"
import { createFormsData } from "./WidgetStateManager"

const flexContextValue = {
  direction: Direction.VERTICAL,
  isInHorizontalLayout: false,
  isInRoot: false,
  isInContentWidthContainer: false,
}

const defaultScriptRunContextValue = {
  scriptRunState: ScriptRunState.NOT_RUNNING,
  scriptRunId: "script run 123",
  fragmentIdsThisRun: [],
}

const defaultThemeContextValue = {
  activeTheme: mockTheme,
  setTheme: vi.fn(),
  availableThemes: [],
}

export const TestAppWrapper: FC<PropsWithChildren> = ({ children }) => {
  return (
    <ThemeProvider theme={mockTheme.emotion}>
      <WindowDimensionsProvider>
        <FlexContext.Provider value={flexContextValue}>
          <ThemeContext.Provider value={defaultThemeContextValue}>
            <ScriptRunContext.Provider value={defaultScriptRunContextValue}>
              {children}
            </ScriptRunContext.Provider>
          </ThemeContext.Provider>
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
 * Extended RenderResult that includes a rerender function supporting context updates
 */
export interface RenderWithContextsResult extends RenderResult {
  /**
   * Re-render the component with updated context values.
   *
   * Parameter order matches the provider nesting order (outer → inner):
   * LibContext → ThemeContext → FormsContext → ScriptRunContext
   *
   * @param component The component to render (usually the same component with updated props)
   * @param newLibContextProps New LibContext overrides to merge with existing values
   * @param newThemeContextProps New ThemeContext overrides to merge with existing values
   * @param newFormsContextProps New FormsContext overrides to merge with existing values
   * @param newScriptRunContextProps New ScriptRunContext overrides to merge with existing values
   */
  rerenderWithContexts: (
    component: ReactElement,
    newLibContextProps?: Partial<LibContextProps>,
    newThemeContextProps?: Partial<ThemeContextProps>,
    newFormsContextProps?: Partial<FormsContextProps>,
    newScriptRunContextProps?: Partial<ScriptRunContextProps>
  ) => void
}

/**
 * Use react-testing-library to render a ReactElement. The element will be
 * wrapped in our LibContext.Provider, ThemeContext.Provider, FormsContext.Provider, and ScriptRunContext.Provider.
 *
 * Parameter order matches the provider nesting order (outer → inner):
 * LibContext → ThemeContext → FormsContext → ScriptRunContext
 *
 * Returns an extended RenderResult with a `rerenderWithContexts` method that
 * allows updating context values during re-renders.
 */
export const renderWithContexts = (
  component: ReactElement,
  overrideLibContextProps: Partial<LibContextProps> = {},
  overrideThemeContextProps: Partial<ThemeContextProps> = {},
  overrideFormsContextProps: Partial<FormsContextProps> = {},
  overrideScriptRunContextProps: Partial<ScriptRunContextProps> = {}
): RenderWithContextsResult => {
  const defaultLibContextProps = {
    isFullScreen: false,
    setFullScreen: vi.fn(),
    onPageChange: vi.fn(),
    currentPageScriptHash: "",
    libConfig: {},
    locale: "en-US",
    componentRegistry: new ComponentRegistry(mockEndpoints()),
  }

  const defaultThemeContextProps = {
    activeTheme: mockTheme,
    setTheme: vi.fn(),
    availableThemes: [],
  }

  const defaultFormsContextProps = {
    formsData: createFormsData(),
  }

  const defaultScriptRunContextProps = {
    scriptRunState: ScriptRunState.NOT_RUNNING,
    scriptRunId: "script run 123",
    fragmentIdsThisRun: [],
  }

  // Track current context values across rerenders
  // Order matches provider nesting: LibContext → ThemeContext → FormsContext → ScriptRunContext
  let currentLibContextProps = {
    ...defaultLibContextProps,
    ...overrideLibContextProps,
  }
  let currentThemeContextProps = {
    ...defaultThemeContextProps,
    ...overrideThemeContextProps,
  }
  let currentFormsContextProps = {
    ...defaultFormsContextProps,
    ...overrideFormsContextProps,
  }
  let currentScriptRunContextProps = {
    ...defaultScriptRunContextProps,
    ...overrideScriptRunContextProps,
  }

  const Wrapper: FC<PropsWithChildren> = ({ children }) => (
    <ThemeProvider theme={mockTheme.emotion}>
      <WindowDimensionsProvider>
        <FlexContext.Provider value={flexContextValue}>
          <LibContext.Provider value={currentLibContextProps}>
            <ThemeContext.Provider value={currentThemeContextProps}>
              <FormsContext.Provider value={currentFormsContextProps}>
                <ScriptRunContext.Provider
                  value={currentScriptRunContextProps}
                >
                  {children}
                </ScriptRunContext.Provider>
              </FormsContext.Provider>
            </ThemeContext.Provider>
          </LibContext.Provider>
        </FlexContext.Provider>
      </WindowDimensionsProvider>
    </ThemeProvider>
  )

  const result = reactTestingLibraryRender(component, {
    wrapper: Wrapper,
  })

  return {
    ...result,
    rerenderWithContexts: (
      newComponent: ReactElement,
      newLibContextProps?: Partial<LibContextProps>,
      newThemeContextProps?: Partial<ThemeContextProps>,
      newFormsContextProps?: Partial<FormsContextProps>,
      newScriptRunContextProps?: Partial<ScriptRunContextProps>
    ): void => {
      // Update context values if provided
      // Order matches provider nesting: LibContext → ThemeContext → FormsContext → ScriptRunContext
      if (newLibContextProps) {
        currentLibContextProps = {
          ...currentLibContextProps,
          ...newLibContextProps,
        }
      }
      if (newThemeContextProps) {
        currentThemeContextProps = {
          ...currentThemeContextProps,
          ...newThemeContextProps,
        }
      }
      if (newFormsContextProps) {
        currentFormsContextProps = {
          ...currentFormsContextProps,
          ...newFormsContextProps,
        }
      }
      if (newScriptRunContextProps) {
        currentScriptRunContextProps = {
          ...currentScriptRunContextProps,
          ...newScriptRunContextProps,
        }
      }
      // Use the original rerender with the wrapper
      result.rerender(newComponent)
    },
  }
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

/**
 * Helper function to create a simple test File object.
 */
export function createTestFile(
  fileName: string,
  content: string | ArrayBuffer = "content",
  mimeType?: string
): File {
  // Auto-detect mime type from extension if not provided
  if (!mimeType) {
    const ext = fileName.split(".").pop()?.toLowerCase()
    const mimeTypes: Record<string, string> = {
      txt: "text/plain",
      pdf: "application/pdf",
      exe: "application/exe",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      html: "text/html",
      js: "application/javascript",
      json: "application/json",
    }
    mimeType = mimeTypes[ext || ""] || "application/octet-stream"
  }

  return new File([content], fileName, { type: mimeType })
}

/**
 * Helper function to create a File object with webkitRelativePath for testing directory uploads.
 * This simulates how browsers provide files when a directory is selected.
 */
export function createFileWithPath(
  content: string | ArrayBuffer,
  fileName: string,
  relativePath: string,
  mimeType: string = "text/plain"
): File {
  const file = new File([content], fileName, { type: mimeType })
  Object.assign(file, { webkitRelativePath: relativePath })
  return file
}

/**
 * Helper function to create multiple files representing a directory structure.
 * Each file will have the appropriate webkitRelativePath set.
 */
export function createDirectoryFiles(
  files: Array<{
    content: string | ArrayBuffer
    path: string
    mimeType?: string
  }>
): File[] {
  return files.map(({ content, path, mimeType = "text/plain" }) => {
    const fileName = path.split("/").pop() || "file"
    return createFileWithPath(content, fileName, path, mimeType)
  })
}
