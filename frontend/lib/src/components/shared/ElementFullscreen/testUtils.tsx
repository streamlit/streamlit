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
import { RenderOptions, RenderResult } from "@testing-library/react"
import {
  renderHook as reactTestingLibraryRenderHook,
  RenderHookOptions,
} from "@testing-library/react-hooks"

import ElementFullscreenWrapper from "@streamlit/lib/src/components/shared/ElementFullscreen/ElementFullscreenWrapper"
import {
  TestAppWrapper,
  render as testUtilRender,
} from "@streamlit/lib/src/test_util"

/**
 * Reusable test harness for rendering components in a fullscreen context.
 * Prefer to utilize `renderWithContext` and `renderHookWithContext` instead of
 * using this directly.
 */
const FullscreenHarness: FC<PropsWithChildren> = ({ children }) => {
  return (
    <TestAppWrapper>
      {/* 500 is an arbitrary value for the width, as it's not actually used in the tests */}
      <ElementFullscreenWrapper width={500}>
        {children}
      </ElementFullscreenWrapper>
    </TestAppWrapper>
  )
}

export function render(
  ui: ReactElement,
  options?: Omit<RenderOptions, "queries" | "wrapper">
): RenderResult {
  return testUtilRender(ui, { wrapper: FullscreenHarness, ...options })
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function renderHook<Props, Result>(
  hook: (props: Props) => Result,
  options: Omit<RenderHookOptions<Props>, "wrapper"> | undefined
) {
  return reactTestingLibraryRenderHook(hook, {
    // @ts-expect-error This works but TS is being weird about it
    wrapper: FullscreenHarness,
    ...options,
  })
}
