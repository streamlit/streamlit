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

import React, { ReactElement } from "react"
import { useTheme } from "emotion-theming"
import { Theme } from "src/theme"
import {
  ProgressBar as UIProgressBar,
  ProgressBarOverrides,
} from "baseui/progress-bar"
import { mergeOverrides } from "baseui"
import { Overrides } from "baseui/overrides"

export enum Size {
  SMALL = "sm",
  MEDIUM = "md",
  LARGE = "lg",
  EXTRALARGE = "xl",
}

export interface ProgressBarProps {
  width?: number
  value: number
  overrides?: Overrides<any>
  size?: Size
}

function ProgressBar({
  value,
  width,
  size = Size.MEDIUM,
  overrides,
}: ProgressBarProps): ReactElement {
  const theme: Theme = useTheme()
  const heightMap = {
    sm: theme.fontSizes.sm,
    md: theme.spacing.lg,
    lg: theme.spacing.xl,
    xl: theme.spacing.twoXL,
  }
  const defaultOverrides: Overrides<ProgressBarOverrides> = {
    BarContainer: {
      style: {
        marginTop: theme.spacing.none,
        marginBottom: theme.spacing.none,
        marginRight: theme.spacing.none,
        marginLeft: theme.spacing.none,
      },
    },
    Bar: {
      style: ({ $theme }: { $theme: any }) => ({
        width,
        marginTop: theme.spacing.none,
        marginBottom: theme.spacing.none,
        marginRight: theme.spacing.none,
        marginLeft: theme.spacing.none,
        height: heightMap[size],
        backgroundColor: $theme.colors.progressbarTrackFill,
      }),
    },
    BarProgress: {
      style: {
        backgroundColor: theme.colors.blue,
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
