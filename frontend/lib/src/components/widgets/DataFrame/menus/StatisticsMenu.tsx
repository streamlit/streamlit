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
import { getTimezone } from "~lib/dataframes/arrowTypeUtils"
import { Quiver } from "~lib/dataframes/Quiver"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"

import StatisticsChart from "./StatisticsChart"
import {
  ColumnStatistics,
  computeEmptyPercentage,
  computeStatistics,
  formatCountWithPercent,
  formatDatetime,
  formatNumber,
  getNullOrEmptyCount,
  supportsStatistics,
} from "./statisticsUtils"
import {
  StyledStatisticsContainer,
  StyledStatisticsDivider,
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
 * Build metrics rows for each statistics type.
 */
function getMetricRows(statistics: ColumnStatistics): MetricRow[] {
  switch (statistics.type) {
    case "numeric": {
      const emptyPct = computeEmptyPercentage(
        statistics.count,
        statistics.nullCount
      )
      // Ordered to mirror the familiar pandas df.describe() layout: counts
      // first, then central tendency/spread (average + std dev), then the
      // five-number summary, with the aggregate sum last. Variance is omitted
      // since it is redundant with the standard deviation in a compact panel.
      return [
        { label: "Values", value: formatNumber(statistics.count, 0) },
        {
          label: "Empty",
          value: formatCountWithPercent(statistics.nullCount, emptyPct),
        },
        {
          label: "Distinct",
          value: formatNumber(statistics.unique, 0),
        },
        { label: "Average", value: formatNumber(statistics.mean) },
        {
          label: "Standard deviation",
          value: formatNumber(statistics.stdDev),
        },
        { label: "Minimum", value: formatNumber(statistics.min) },
        { label: "25th percentile", value: formatNumber(statistics.q25) },
        { label: "Median", value: formatNumber(statistics.median) },
        { label: "75th percentile", value: formatNumber(statistics.q75) },
        { label: "Maximum", value: formatNumber(statistics.max) },
        { label: "Sum", value: formatNumber(statistics.sum) },
      ]
    }
    case "text": {
      const emptyPct = computeEmptyPercentage(
        statistics.count,
        statistics.empty
      )
      return [
        { label: "Values", value: formatNumber(statistics.count, 0) },
        {
          label: "Empty",
          value: formatCountWithPercent(statistics.empty, emptyPct),
        },
        {
          label: "Distinct",
          value: formatNumber(statistics.unique, 0),
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
        formatDatetime(ts, statistics.isDateOnly, statistics.timezone)
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
      // The true/false split (counts + percentages) is already shown by the
      // chart above, so the metrics list only adds the totals to avoid
      // duplicating the same numbers twice.
      return [
        { label: "Values", value: formatNumber(statistics.count, 0) },
        {
          label: "Empty",
          value: formatCountWithPercent(statistics.nullCount, emptyPct),
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
          {statistics.isSampled && (
            <StyledStatisticsNote>Based on sample</StyledStatisticsNote>
          )}
        </StyledStatisticsContainer>
      )
    }
    return <StyledStatisticsEmpty>No data</StyledStatisticsEmpty>
  }

  return (
    <StyledStatisticsContainer data-testid="stDataFrameStatisticsContent">
      <StatisticsChart statistics={statistics} />
      {/* The chart always renders in this branch (count > 0), so the divider
          always separates a visible chart from the metrics below it. */}
      <StyledStatisticsDivider />
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

  // Compute statistics only when menu is open.
  // Note: This useMemo caches within a single open session only, not across
  // open/close cycles (the component unmounts when the parent ColumnMenu closes).
  // For large datasets, computation is bounded by SAMPLE_SIZE (10k values).
  const statistics = useMemo((): ColumnStatistics | null => {
    if (!isOpen) return null
    // Extract timezone from column's Arrow type metadata for datetime columns
    const timezone = getTimezone(column.arrowType)
    return computeStatistics(column.kind, data, column.indexNumber, timezone)
  }, [isOpen, column.kind, column.indexNumber, column.arrowType, data])

  // Defensive fallback: parent ColumnMenu already guards this, but keep for safety.
  // This ensures the component renders nothing if called directly without the guard.
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
