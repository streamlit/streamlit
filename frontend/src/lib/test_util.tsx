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

import { Component, ReactElement } from "react"
import {
  mount as enzymeMount,
  shallow as enzymeShallow,
  ShallowRendererProps,
  MountRendererProps,
  ShallowWrapper,
  ReactWrapper,
} from "enzyme" // eslint-disable-line import/no-extraneous-dependencies
import { mainTheme, Theme } from "theme"
import ThemeProvider from "components/core/ThemeProvider"

export function mount<C extends Component, P = C["props"], S = C["state"]>(
  node: ReactElement<P>,
  options?: MountRendererProps,
  theme?: Theme
): ReactWrapper<P, S, C> {
  const opts: MountRendererProps = {
    ...(options || {}),
    wrappingComponent: ThemeProvider,
    wrappingComponentProps: {
      theme: theme || mainTheme,
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
      theme: theme || mainTheme,
    },
  }

  return enzymeShallow(node, opts)
}
