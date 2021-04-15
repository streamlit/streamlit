/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  render as reactTestingLibraryRender,
  RenderOptions,
  RenderResult,
} from "@testing-library/react" // eslint-disable-line import/no-extraneous-dependencies
import {
  mount as enzymeMount,
  MountRendererProps,
  ReactWrapper,
  shallow as enzymeShallow,
  ShallowRendererProps,
  ShallowWrapper,
} from "enzyme" // eslint-disable-line import/no-extraneous-dependencies
import React, { Component, FC, ReactElement } from "react"
import ThemeProvider from "src/components/core/ThemeProvider"
import { lightTheme, Theme } from "src/theme"

export function mount<C extends Component, P = C["props"], S = C["state"]>(
  node: ReactElement<P>,
  options?: MountRendererProps,
  theme?: Theme
): ReactWrapper<P, S, C> {
  const opts: MountRendererProps = {
    ...(options || {}),
    wrappingComponent: ThemeProvider,
    wrappingComponentProps: {
      theme: theme || lightTheme.emotion,
    },
  }

  return enzymeMount(node, opts)
}

export function shallow<C extends Component, P = C["props"], S = C["state"]>(
  node: ReactElement<P>,
  options?: ShallowRendererProps,
  theme?: Theme
): ShallowWrapper<P, S, C> {
  const opts: ShallowRendererProps = {
    ...(options || {}),
    wrappingComponent: ThemeProvider,
    wrappingComponentProps: {
      theme: theme || lightTheme.emotion,
    },
  }

  return enzymeShallow(node, opts)
}

const RenderWrapper: FC = ({ children }) => {
  return <ThemeProvider theme={lightTheme.emotion}>{children}</ThemeProvider>
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
    wrapper: RenderWrapper,
    ...options,
  })
}
