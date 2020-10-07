/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

import React, { ReactElement } from "react"
import { SCSS_VARS } from "autogen/scssVariables"
import {
  ProgressBar as UIProgressBar,
  ProgressBarOverrides,
} from "baseui/progress-bar"
import { mergeOverrides } from "baseui"
import { Overrides } from "baseui/overrides"
import { Sizes } from "lib/widgetTheme"

export interface ProgressBarProps {
  width?: number
  value: number
  overrides?: Overrides<any>
  size?: Sizes
}

function ProgressBar({
  value,
  width,
  size = Sizes.MEDIUM,
  overrides,
}: ProgressBarProps): ReactElement {
  const defaultOverrides: Overrides<ProgressBarOverrides> = {
    Bar: {
      style: ({ $theme }: { $theme: any }) => ({
        width,
        margin: SCSS_VARS["$progress-bar-margin"],
        height: SCSS_VARS[`$progress-bar-height-${size}`],
        backgroundColor: $theme.colors.progressbarTrackFill,
      }),
    },
    BarProgress: {
      style: {
        backgroundColor: SCSS_VARS.$blue,
      },
    },
  }

  return (
    <UIProgressBar
      value={value}
      overrides={mergeOverrides(defaultOverrides, overrides)}
    />
  )
}

export default ProgressBar
