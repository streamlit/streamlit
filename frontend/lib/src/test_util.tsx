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

import { PageConfig } from "@streamlit/protobuf"

import {
  FormsContext,
  FormsContextProps,
} from "./components/core/FormsContext"
import { FlexContext } from "./components/core/Layout/FlexContext"
import { Direction } from "./components/core/Layout/utils"
import { LibContext, LibContextProps } from "./components/core/LibContext"
import {
  NavigationContext,
  NavigationContextProps,
} from "./components/core/NavigationContext"
import {
  ScriptRunContext,
  ScriptRunContextProps,
} from "./components/core/ScriptRunContext"
import {
  SidebarConfigContext,
  SidebarConfigContextProps,
} from "./components/core/SidebarConfigContext"
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
  setTheme: () => {},
  availableThemes: [],
}

const defaultNavigationContextValue = {
  pageLinkBaseUrl: "",
  currentPageScriptHash: "",
  onPageChange: () => {},
  navSections: [],
  appPages: [],
}

const defaultSidebarConfigContextValue = {
  initialSidebarState: PageConfig.SidebarState.AUTO,
  appLogo: null,
  sidebarChevronDownshift: 0,
  expandSidebarNav: false,
  hideSidebarNav: false,
}

export const TestAppWrapper: FC<PropsWithChildren> = ({ children }) => {
  return (
    <ThemeProvider theme={mockTheme.emotion}>
      <WindowDimensionsProvider>
        <FlexContext.Provider value={flexContextValue}>
          <SidebarConfigContext.Provider
            value={defaultSidebarConfigContextValue}
          >
            <ThemeContext.Provider value={defaultThemeContextValue}>
              <NavigationContext.Provider
                value={defaultNavigationContextValue}
              >
                <ScriptRunContext.Provider
                  value={defaultScriptRunContextValue}
                >
                  {children}
                </ScriptRunContext.Provider>
              </NavigationContext.Provider>
            </ThemeContext.Provider>
          </SidebarConfigContext.Provider>
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
 * Options for overriding context values in renderWithContexts.
 * All properties are optional - only provide the contexts you need to override.
 */
export interface RenderWithContextsOptions {
  libContext?: Partial<LibContextProps>
  sidebarConfigContext?: Partial<SidebarConfigContextProps>
  themeContext?: Partial<ThemeContextProps>
  navigationContext?: Partial<NavigationContextProps>
  formsContext?: Partial<FormsContextProps>
  scriptRunContext?: Partial<ScriptRunContextProps>
}

/**
 * Extended RenderResult that includes a rerender function supporting context updates
 */
export interface RenderWithContextsResult extends RenderResult {
  /**
   * Re-render the component with updated context values.
   * Merges new context props with existing ones (shallow merge).
   *
   * @param component The component to render (usually the same component with updated props)
   * @param options Context overrides to merge with existing values
   */
  rerenderWithContexts: (
    component: ReactElement,
    options?: RenderWithContextsOptions
  ) => void
}

/**
 * Use react-testing-library to render a ReactElement. The element will be
 * wrapped in Providers for LibContext, SidebarConfigContext, ThemeContext,
 * NavigationContext, FormsContext, and ScriptRunContext.
 *
 * Returns an extended RenderResult with a `rerenderWithContexts` method that
 * allows updating context values during re-renders.
 *
 * @param component The React component to render
 * @param options Context overrides (all optional)
 * @returns Extended render result with rerenderWithContexts method
 *
 * @example
 * renderWithContexts(<MyComponent />, {
 *   navigationContext: { appPages: [...] },
 *   themeContext: { activeTheme: customTheme }
 * })
 */
export const renderWithContexts = (
  component: ReactElement,
  options: RenderWithContextsOptions = {}
): RenderWithContextsResult => {
  // Track current context values across rerenders.
  // The Wrapper component below reads these on each render,
  // so updating them in rerenderWithContexts will affect subsequent renders.
  let currentLibContextProps: LibContextProps = {
    isFullScreen: false,
    setFullScreen: vi.fn(),
    // Flattened libConfig properties:
    mapboxToken: undefined,
    disableFullscreenMode: undefined,
    enforceDownloadInNewTab: undefined,
    resourceCrossOriginMode: undefined,
    locale: "en-US",
    componentRegistry: new ComponentRegistry(mockEndpoints()),
    ...options.libContext,
  }

  let currentSidebarConfigContextProps: SidebarConfigContextProps = {
    initialSidebarState: PageConfig.SidebarState.AUTO,
    appLogo: null,
    sidebarChevronDownshift: 0,
    expandSidebarNav: false,
    hideSidebarNav: false,
    ...options.sidebarConfigContext,
  }

  let currentThemeContextProps: ThemeContextProps = {
    activeTheme: mockTheme,
    setTheme: vi.fn(),
    availableThemes: [],
    ...options.themeContext,
  }

  let currentNavigationContextProps: NavigationContextProps = {
    pageLinkBaseUrl: "",
    currentPageScriptHash: "",
    onPageChange: vi.fn(),
    navSections: [],
    appPages: [],
    ...options.navigationContext,
  }

  let currentFormsContextProps: FormsContextProps = {
    formsData: createFormsData(),
    ...options.formsContext,
  }

  let currentScriptRunContextProps: ScriptRunContextProps = {
    scriptRunState: ScriptRunState.NOT_RUNNING,
    scriptRunId: "script run 123",
    fragmentIdsThisRun: [],
    ...options.scriptRunContext,
  }

  const Wrapper: FC<PropsWithChildren> = ({ children }) => (
    <ThemeProvider theme={mockTheme.emotion}>
      <WindowDimensionsProvider>
        <FlexContext.Provider value={flexContextValue}>
          <LibContext.Provider value={currentLibContextProps}>
            <SidebarConfigContext.Provider
              value={currentSidebarConfigContextProps}
            >
              <ThemeContext.Provider value={currentThemeContextProps}>
                <NavigationContext.Provider
                  value={currentNavigationContextProps}
                >
                  <FormsContext.Provider value={currentFormsContextProps}>
                    <ScriptRunContext.Provider
                      value={currentScriptRunContextProps}
                    >
                      {children}
                    </ScriptRunContext.Provider>
                  </FormsContext.Provider>
                </NavigationContext.Provider>
              </ThemeContext.Provider>
            </SidebarConfigContext.Provider>
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
      newOptions?: RenderWithContextsOptions
    ): void => {
      // Update context values if provided
      if (newOptions?.libContext) {
        currentLibContextProps = {
          ...currentLibContextProps,
          ...newOptions.libContext,
        }
      }
      if (newOptions?.sidebarConfigContext) {
        currentSidebarConfigContextProps = {
          ...currentSidebarConfigContextProps,
          ...newOptions.sidebarConfigContext,
        }
      }
      if (newOptions?.themeContext) {
        currentThemeContextProps = {
          ...currentThemeContextProps,
          ...newOptions.themeContext,
        }
      }
      if (newOptions?.navigationContext) {
        currentNavigationContextProps = {
          ...currentNavigationContextProps,
          ...newOptions.navigationContext,
        }
      }
      if (newOptions?.formsContext) {
        currentFormsContextProps = {
          ...currentFormsContextProps,
          ...newOptions.formsContext,
        }
      }
      if (newOptions?.scriptRunContext) {
        currentScriptRunContextProps = {
          ...currentScriptRunContextProps,
          ...newOptions.scriptRunContext,
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
