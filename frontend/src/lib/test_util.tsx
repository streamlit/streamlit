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

import { ReactElement } from "react"
import {
  mount as enzymeMount,
  shallow as enzymeShallow,
  ShallowRendererProps,
  MountRendererProps,
  ShallowWrapper,
  ReactWrapper,
} from "enzyme" // eslint-disable-line import/no-extraneous-dependencies
import { lightTheme, Theme } from "theme"
import ThemeProvider from "components/core/ThemeProvider"

export function mount(
  arg: ReactElement,
  options?: MountRendererProps,
  theme?: Theme
): ReactWrapper {
  const opts: MountRendererProps = {
    ...(options || {}),
    wrappingComponent: ThemeProvider,
    wrappingComponentProps: {
      theme: theme || lightTheme.emotion,
    },
  }

  return enzymeMount(arg, opts)
}

export function shallow(
  arg: ReactElement,
  options?: ShallowRendererProps,
  theme?: Theme
): ShallowWrapper {
  const opts: ShallowRendererProps = {
    ...(options || {}),
    wrappingComponent: ThemeProvider,
    wrappingComponentProps: {
      theme: theme || lightTheme.emotion,
    },
  }

  return enzymeShallow(arg, opts)
}
