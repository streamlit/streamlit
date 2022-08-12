import React, { ReactElement } from "react"
import { useTheme } from "@emotion/react"
import AppContext from "src/components/core/AppContext"
import { Theme, isPresetTheme } from "src/theme"
import {
  ProgressBar as UIProgressBar,
  ProgressBarOverrides,
} from "baseui/progress-bar"
import { mergeOverrides } from "baseui"
import { Overrides } from "baseui/overrides"

export enum Size {
  EXTRASMALL = "xs",
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
  size = Size.SMALL,
  overrides,
}: ProgressBarProps): ReactElement {
  const theme: Theme = useTheme()
  const heightMap = {
    xs: theme.spacing.twoXS,
    sm: theme.spacing.sm,
    md: theme.spacing.lg,
    lg: theme.spacing.xl,
    xl: theme.spacing.twoXL,
  }
  const { activeTheme } = React.useContext(AppContext)
  const usingCustomTheme = !isPresetTheme(activeTheme)
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
        width: width ? width.toString() : undefined,
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
      style: ({ $theme }: { $theme: any }) => ({
        backgroundColor: usingCustomTheme
          ? theme.colors.primary
          : theme.colors.blue70,
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
