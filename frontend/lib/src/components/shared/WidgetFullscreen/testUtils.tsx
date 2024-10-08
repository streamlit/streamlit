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

import React, { FC, PropsWithChildren, ReactElement } from "react"

/* eslint-disable import/no-extraneous-dependencies */
import {
  render as reactTestingLibraryRender,
  RenderOptions,
  RenderResult,
} from "@testing-library/react"
import { renderHook, RenderHookOptions } from "@testing-library/react-hooks"

import WidgetFullscreenWrapper from "@streamlit/lib/src/components/shared/WidgetFullscreen/WidgetFullscreenWrapper"
import { TestAppWrapper } from "@streamlit/lib/src/test_util"

/**
 * Reusable test harness for rendering components in a fullscreen context.
 * Prefer to utilize `renderWithContext` and `renderHookWithContext` instead of
 * using this directly.
 */
const FullscreenHarness: FC<PropsWithChildren> = ({ children }) => {
  return (
    <TestAppWrapper>
      <WidgetFullscreenWrapper
        // 500 is an arbitrary value for the width, as it's not used in the tests
        width={500}
      >
        {children}
      </WidgetFullscreenWrapper>
    </TestAppWrapper>
  )
}

export function renderWithContext(
  ui: ReactElement,
  options?: Omit<RenderOptions, "queries" | "wrapper">
): RenderResult {
  return reactTestingLibraryRender(ui, {
    wrapper: FullscreenHarness,
    ...options,
    // TODO: Remove this to have RTL run on React 18
    // react-18-upgrade
    legacyRoot: true,
  })
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function renderHookWithContext<Props, Result>(
  hook: (props: Props) => Result,
  options: Omit<RenderHookOptions<Props>, "wrapper"> | undefined
) {
  return renderHook(hook, {
    // @ts-expect-error This works, TS is being weird about it
    wrapper: FullscreenHarness,
    ...options,
  })
}
