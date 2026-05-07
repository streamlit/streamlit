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
  ColumnStatistics,
  computeStatistics,
  supportsStatistics,
} from "./statisticsUtils"
import {
  StyledStatisticsContainer,
  StyledStatisticsEmpty,
  StyledStatisticsLabel,
  StyledStatisticsMetrics,
  StyledStatisticsNote,
  StyledStatisticsRow,
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
 * Uses toLocaleString consistently for all numbers to respect locale decimal separators.
 */
function formatNumber(value: number, precision = 2): string {
  if (!Number.isFinite(value)) return "-"

  return value.toLocaleString(undefined, {
    maximumFractionDigits: precision,
    minimumFractionDigits: 0,
  })
}

/**
 * Format a datetime timestamp for display in statistics.
 * Uses UTC to avoid timezone shifts that can change dates.
 * @param timestamp - Unix timestamp in milliseconds
 * @param isDateOnly - If true, format as date only without time
 */
function formatDatetime(timestamp: number, isDateOnly = false): string {
  const date = new Date(timestamp)
  if (isDateOnly) {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
  }
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
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

/** A single row in the statistics metrics display. */
interface MetricRow {
  label: string
  value: string
}

/**
 * Render a statistics row.
 */
function StatisticsRow({ label, value }: MetricRow): ReactElement {
  return (
    <StyledStatisticsRow>
      <StyledStatisticsLabel>{label}</StyledStatisticsLabel>
      <StyledStatisticsValue>{value}</StyledStatisticsValue>
    </StyledStatisticsRow>
  )
}

/**
 * Format a count with optional percentage.
 */
function formatCountWithPercent(count: number, percentage: number): string {
  return `${formatNumber(count, 0)} (${formatPercent(percentage)})`
}

/**
 * Build metrics rows for each statistics type.
 */
function getMetricRows(statistics: ColumnStatistics): MetricRow[] {
  switch (statistics.type) {
    case "numeric": {
      const emptyPct = computeEmptyPercentage(
        statistics.count,
        statistics.nullCount
      )
      const distinctPct =
        statistics.count > 0 ? (statistics.unique / statistics.count) * 100 : 0
      return [
        { label: "Values", value: formatNumber(statistics.count, 0) },
        {
          label: "Empty",
          value: formatCountWithPercent(statistics.nullCount, emptyPct),
        },
        {
          label: "Distinct",
          value: formatCountWithPercent(statistics.unique, distinctPct),
        },
        { label: "Sum", value: formatNumber(statistics.sum) },
        { label: "Minimum", value: formatNumber(statistics.min) },
        { label: "25th percentile", value: formatNumber(statistics.q25) },
        { label: "Median", value: formatNumber(statistics.median) },
        { label: "75th percentile", value: formatNumber(statistics.q75) },
        { label: "Maximum", value: formatNumber(statistics.max) },
        { label: "Average", value: formatNumber(statistics.mean) },
        {
          label: "Standard deviation",
          value: formatNumber(statistics.stdDev),
        },
        { label: "Variance", value: formatNumber(statistics.variance) },
      ]
    }
    case "text": {
      const emptyPct = computeEmptyPercentage(
        statistics.count,
        statistics.empty
      )
      const distinctPct =
        statistics.count > 0 ? (statistics.unique / statistics.count) * 100 : 0
      return [
        { label: "Values", value: formatNumber(statistics.count, 0) },
        {
          label: "Empty",
          value: formatCountWithPercent(statistics.empty, emptyPct),
        },
        {
          label: "Distinct",
          value: formatCountWithPercent(statistics.unique, distinctPct),
        },
        {
          label: "Minimum length",
          value: formatNumber(statistics.minLength, 0),
        },
        {
          label: "Maximum length",
          value: formatNumber(statistics.maxLength, 0),
        },
        {
          label: "Average length",
          value: formatNumber(statistics.avgLength, 1),
        },
      ]
    }
    case "datetime": {
      const emptyPct = computeEmptyPercentage(
        statistics.count,
        statistics.nullCount
      )
      const fmt = (ts: number): string =>
        formatDatetime(ts, statistics.isDateOnly)
      return [
        { label: "Values", value: formatNumber(statistics.count, 0) },
        {
          label: "Empty",
          value: formatCountWithPercent(statistics.nullCount, emptyPct),
        },
        { label: "Minimum", value: fmt(statistics.min) },
        { label: "25th percentile", value: fmt(statistics.q25) },
        { label: "Median", value: fmt(statistics.median) },
        { label: "75th percentile", value: fmt(statistics.q75) },
        { label: "Maximum", value: fmt(statistics.max) },
        { label: "Average", value: fmt(statistics.mean) },
        { label: "Range", value: statistics.range },
      ]
    }
    case "boolean": {
      const emptyPct = computeEmptyPercentage(
        statistics.count,
        statistics.nullCount
      )
      return [
        { label: "Values", value: formatNumber(statistics.count, 0) },
        {
          label: "Empty",
          value: formatCountWithPercent(statistics.nullCount, emptyPct),
        },
        {
          label: "True",
          value: formatCountWithPercent(
            statistics.trueCount,
            statistics.truePercentage
          ),
        },
        {
          label: "False",
          value: formatCountWithPercent(
            statistics.falseCount,
            statistics.falsePercentage
          ),
        },
      ]
    }
  }
}

/**
 * Render statistics metrics from a list of rows.
 */
function MetricsDisplay({ rows }: { rows: MetricRow[] }): ReactElement {
  return (
    <StyledStatisticsMetrics data-testid="stDataFrameStatisticsMetrics">
      {rows.map(row => (
        <StatisticsRow key={row.label} label={row.label} value={row.value} />
      ))}
    </StyledStatisticsMetrics>
  )
}

/**
 * Get the null/empty count from statistics.
 */
function getNullOrEmptyCount(statistics: ColumnStatistics): number {
  switch (statistics.type) {
    case "numeric":
    case "datetime":
    case "boolean":
      return statistics.nullCount
    case "text":
      return statistics.empty
  }
}

/**
 * Build reduced metrics for all-null/empty columns.
 * Shows only Values and Empty counts.
 */
function getReducedMetricRows(statistics: ColumnStatistics): MetricRow[] {
  const emptyCount = getNullOrEmptyCount(statistics)
  const emptyPct = computeEmptyPercentage(statistics.count, emptyCount)
  return [
    { label: "Values", value: formatNumber(statistics.count, 0) },
    { label: "Empty", value: formatCountWithPercent(emptyCount, emptyPct) },
  ]
}

/**
 * Statistics content displayed in the submenu.
 */
function StatisticsContent({
  statistics,
}: {
  statistics: ColumnStatistics | null
}): ReactElement | null {
  if (!statistics) {
    return <StyledStatisticsEmpty>No data</StyledStatisticsEmpty>
  }

  // If count is 0 but we have null/empty values, show reduced metrics
  const emptyCount = getNullOrEmptyCount(statistics)
  if (statistics.count === 0) {
    if (emptyCount > 0) {
      return (
        <StyledStatisticsContainer data-testid="stDataFrameStatisticsContent">
          <MetricsDisplay rows={getReducedMetricRows(statistics)} />
        </StyledStatisticsContainer>
      )
    }
    return <StyledStatisticsEmpty>No data</StyledStatisticsEmpty>
  }

  return (
    <StyledStatisticsContainer data-testid="stDataFrameStatisticsContent">
      <StatisticsChart statistics={statistics} />
      <MetricsDisplay rows={getMetricRows(statistics)} />
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
      // Note: autoFocus and focusLock are intentionally omitted for this read-only
      // submenu, allowing keyboard users to navigate the parent column menu while
      // the statistics panel is open.
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
