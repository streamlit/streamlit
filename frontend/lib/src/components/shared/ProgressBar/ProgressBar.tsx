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

import React, { ReactElement } from "react"

import { mergeOverrides } from "baseui"
import { Overrides } from "baseui/overrides"
import {
  type ProgressBarOverrides,
  ProgressBar as UIProgressBar,
} from "baseui/progress-bar"

import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"

export enum Size {
  EXTRASMALL = "xs",
  SMALL = "sm",
  MEDIUM = "md",
  LARGE = "lg",
  EXTRALARGE = "xl",
}

export interface ProgressBarProps {
  value: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  overrides?: Overrides<any>
  size?: Size
}

function ProgressBar({
  value,
  size = Size.SMALL,
  overrides,
}: ProgressBarProps): ReactElement {
  const theme = useEmotionTheme()
  const heightMap = {
    xs: theme.spacing.twoXS,
    sm: theme.spacing.sm,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
      style: ({ $theme }: { $theme: any }) => ({
        marginTop: theme.spacing.none,
        marginBottom: theme.spacing.none,
        marginRight: theme.spacing.none,
        marginLeft: theme.spacing.none,
        height: heightMap[size],
        backgroundColor: $theme.colors.progressbarTrackFill,
        borderTopLeftRadius: theme.spacing.twoXS,
        borderTopRightRadius: theme.spacing.twoXS,
        borderBottomLeftRadius: theme.spacing.twoXS,
        borderBottomRightRadius: theme.spacing.twoXS,
      }),
    },
    BarProgress: {
      style: () => ({
        backgroundColor: theme.colors.secondary,
        borderTopLeftRadius: theme.spacing.twoXS,
        borderTopRightRadius: theme.spacing.twoXS,
        borderBottomLeftRadius: theme.spacing.twoXS,
        borderBottomRightRadius: theme.spacing.twoXS,
      }),
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
