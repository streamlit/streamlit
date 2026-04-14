/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { memo, ReactElement, useMemo } from "react"

import { PLACEMENT, Popover, TRIGGER_TYPE } from "baseui/popover"

import { getPopoverContainerStyle } from "~lib/components/shared/Base/styled-components"
import { BaseColumn } from "~lib/components/widgets/DataFrame/columns"
import { Quiver } from "~lib/dataframes/Quiver"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"

import StatisticsChart from "./StatisticsChart"
import {
  BooleanStatistics,
  ColumnStatistics,
  computeStatistics,
  DateTimeStatistics,
  NumericStatistics,
  supportsStatistics,
  TextStatistics,
} from "./statisticsUtils"
import {
  StyledChartSkeletonBar,
  StyledSkeletonBar,
  StyledStatisticsContainer,
  StyledStatisticsEmpty,
  StyledStatisticsLabel,
  StyledStatisticsMetrics,
  StyledStatisticsNote,
  StyledStatisticsRow,
  StyledStatisticsSkeleton,
  StyledStatisticsValue,
} from "./styled-components"

export interface StatisticsMenuProps {
  /** The column to show statistics for. */
  column: BaseColumn
  /** The Arrow data containing column values. */
  data: Quiver
  /** Whether the menu is open. */
  isOpen: boolean
  /** Callback when mouse enters the menu. */
  onMouseEnter: () => void
  /** Callback when mouse leaves the menu. */
  onMouseLeave: () => void
  /** The menu item trigger element. */
  children: ReactElement
}

/**
 * Format a number for display in statistics.
 */
function formatNumber(value: number, precision = 2): string {
  if (!Number.isFinite(value)) return "-"

  // Use locale formatting for large numbers
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: precision,
    })
  }

  // For small numbers, use fixed precision
  // Remove trailing zeros only after a decimal point
  const fixed = value.toFixed(precision)
  if (fixed.includes(".")) {
    return fixed.replace(/\.?0+$/, "")
  }
  return fixed
}

/**
 * Format a date for display in statistics.
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/**
 * Format a percentage for display.
 */
function formatPercent(value: number): string {
  return `${formatNumber(value, 1)}%`
}

/**
 * Compute empty percentage from count and empty/null count.
 */
function computeEmptyPercentage(count: number, emptyCount: number): number {
  const total = count + emptyCount
  return total > 0 ? (emptyCount / total) * 100 : 0
}

/**
 * Render numeric statistics metrics.
 */
function NumericMetrics({
  stats,
}: {
  stats: NumericStatistics
}): ReactElement {
  const emptyPercentage = computeEmptyPercentage(stats.count, stats.nullCount)
  const distinctPercentage =
    stats.count > 0 ? (stats.unique / stats.count) * 100 : 0

  return (
    <StyledStatisticsMetrics>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Values</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatNumber(stats.count, 0)}
        </StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Empty</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatNumber(stats.nullCount, 0)} ({formatPercent(emptyPercentage)})
        </StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Distinct</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatNumber(stats.unique, 0)} ({formatPercent(distinctPercentage)})
        </StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Sum</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatNumber(stats.sum)}
        </StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Minimum</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatNumber(stats.min)}
        </StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>25th percentile</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatNumber(stats.q25)}
        </StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Median</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatNumber(stats.median)}
        </StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>75th percentile</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatNumber(stats.q75)}
        </StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Maximum</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatNumber(stats.max)}
        </StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Average</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatNumber(stats.mean)}
        </StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Standard deviation</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatNumber(stats.stdDev)}
        </StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Variance</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatNumber(stats.variance)}
        </StyledStatisticsValue>
      </StyledStatisticsRow>
    </StyledStatisticsMetrics>
  )
}

/**
 * Render text statistics metrics.
 */
function TextMetrics({ stats }: { stats: TextStatistics }): ReactElement {
  const emptyPercentage = computeEmptyPercentage(stats.count, stats.empty)
  const distinctPercentage =
    stats.count > 0 ? (stats.unique / stats.count) * 100 : 0

  return (
    <StyledStatisticsMetrics>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Values</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatNumber(stats.count, 0)}
        </StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Empty</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatNumber(stats.empty, 0)} ({formatPercent(emptyPercentage)})
        </StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Distinct</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatNumber(stats.unique, 0)} ({formatPercent(distinctPercentage)})
        </StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Minimum length</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatNumber(stats.minLength, 0)}
        </StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Maximum length</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatNumber(stats.maxLength, 0)}
        </StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Average length</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatNumber(stats.avgLength, 1)}
        </StyledStatisticsValue>
      </StyledStatisticsRow>
    </StyledStatisticsMetrics>
  )
}

/**
 * Render datetime statistics metrics.
 */
function DateTimeMetrics({
  stats,
}: {
  stats: DateTimeStatistics
}): ReactElement {
  const emptyPercentage = computeEmptyPercentage(stats.count, stats.nullCount)

  return (
    <StyledStatisticsMetrics>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Values</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatNumber(stats.count, 0)}
        </StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Empty</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatNumber(stats.nullCount, 0)} ({formatPercent(emptyPercentage)})
        </StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Minimum</StyledStatisticsLabel>
        <StyledStatisticsValue>{formatDate(stats.min)}</StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>25th percentile</StyledStatisticsLabel>
        <StyledStatisticsValue>{formatDate(stats.q25)}</StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Median</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatDate(stats.median)}
        </StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>75th percentile</StyledStatisticsLabel>
        <StyledStatisticsValue>{formatDate(stats.q75)}</StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Maximum</StyledStatisticsLabel>
        <StyledStatisticsValue>{formatDate(stats.max)}</StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Average</StyledStatisticsLabel>
        <StyledStatisticsValue>{formatDate(stats.mean)}</StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Range</StyledStatisticsLabel>
        <StyledStatisticsValue>{stats.range}</StyledStatisticsValue>
      </StyledStatisticsRow>
    </StyledStatisticsMetrics>
  )
}

/**
 * Render boolean statistics metrics.
 */
function BooleanMetrics({
  stats,
}: {
  stats: BooleanStatistics
}): ReactElement {
  const emptyPercentage = computeEmptyPercentage(stats.count, stats.nullCount)

  return (
    <StyledStatisticsMetrics>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Values</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatNumber(stats.count, 0)}
        </StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>Empty</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatNumber(stats.nullCount, 0)} ({formatPercent(emptyPercentage)})
        </StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>True</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatNumber(stats.trueCount, 0)} (
          {formatPercent(stats.truePercentage)})
        </StyledStatisticsValue>
      </StyledStatisticsRow>
      <StyledStatisticsRow>
        <StyledStatisticsLabel>False</StyledStatisticsLabel>
        <StyledStatisticsValue>
          {formatNumber(stats.falseCount, 0)} (
          {formatPercent(stats.falsePercentage)})
        </StyledStatisticsValue>
      </StyledStatisticsRow>
    </StyledStatisticsMetrics>
  )
}

/**
 * Render statistics metrics based on type.
 */
function StatisticsMetrics({
  statistics,
}: {
  statistics: ColumnStatistics
}): ReactElement {
  switch (statistics.type) {
    case "numeric":
      return <NumericMetrics stats={statistics} />
    case "text":
      return <TextMetrics stats={statistics} />
    case "datetime":
      return <DateTimeMetrics stats={statistics} />
    case "boolean":
      return <BooleanMetrics stats={statistics} />
  }
}

/** Skeleton bar widths for loading placeholder. */
const SKELETON_WIDTHS = ["80%", "60%", "70%", "50%"] as const

/**
 * Render a loading skeleton while statistics are being computed.
 */
function StatisticsSkeleton(): ReactElement {
  return (
    <StyledStatisticsSkeleton
      data-testid="stDataFrameStatisticsSkeleton"
      aria-label="Loading statistics"
      aria-busy="true"
    >
      <StyledChartSkeletonBar />
      {SKELETON_WIDTHS.map(width => (
        <StyledSkeletonBar key={width} width={width} />
      ))}
    </StyledStatisticsSkeleton>
  )
}

/**
 * Statistics content displayed in the submenu.
 */
function StatisticsContent({
  statistics,
}: {
  statistics: ColumnStatistics | null
}): ReactElement {
  if (!statistics) {
    return <StatisticsSkeleton />
  }

  if (statistics.count === 0) {
    return <StyledStatisticsEmpty>No data</StyledStatisticsEmpty>
  }

  return (
    <StyledStatisticsContainer data-testid="stDataFrameStatisticsContent">
      <StatisticsChart statistics={statistics} />
      <StatisticsMetrics statistics={statistics} />
      {statistics.isSampled && (
        <StyledStatisticsNote>Based on sample</StyledStatisticsNote>
      )}
    </StyledStatisticsContainer>
  )
}

/**
 * StatisticsMenu displays column statistics in a submenu.
 * Statistics are computed lazily when the menu is opened.
 */
function StatisticsMenu({
  column,
  data,
  isOpen,
  onMouseEnter,
  onMouseLeave,
  children,
}: StatisticsMenuProps): ReactElement {
  const theme = useEmotionTheme()
  const { colors, fontSizes, fontWeights } = theme

  // Only compute statistics when menu is open
  // Memoize based on data and column to cache results
  const statistics = useMemo((): ColumnStatistics | null => {
    if (!isOpen) return null
    if (!supportsStatistics(column.kind)) return null

    return computeStatistics(column.kind, data, column.indexNumber)
  }, [isOpen, column.kind, column.indexNumber, data])

  // Don't render if column doesn't support statistics
  if (!supportsStatistics(column.kind)) {
    return <>{children}</>
  }

  return (
    <Popover
      triggerType={TRIGGER_TYPE.hover}
      returnFocus
      autoFocus
      focusLock
      isOpen={isOpen}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      ignoreBoundary={true}
      content={<StatisticsContent statistics={statistics} />}
      placement={PLACEMENT.right}
      showArrow={false}
      popoverMargin={2}
      overrides={{
        Body: {
          props: {
            "data-testid": "stDataFrameStatisticsMenu",
          },
          style: () => ({
            ...getPopoverContainerStyle(theme),
            paddingTop: "0 !important",
            paddingBottom: "0 !important",
            paddingLeft: "0 !important",
            paddingRight: "0 !important",
            backgroundColor: "transparent",
          }),
        },
        Inner: {
          style: () => ({
            backgroundColor: colors.bgColor,
            color: colors.bodyText,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.normal,
            paddingTop: "0 !important",
            paddingBottom: "0 !important",
            paddingLeft: "0 !important",
            paddingRight: "0 !important",
          }),
        },
      }}
    >
      {children}
    </Popover>
  )
}

export default memo(StatisticsMenu)
