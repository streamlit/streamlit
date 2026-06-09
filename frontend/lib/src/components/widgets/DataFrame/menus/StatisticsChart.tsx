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

import { memo, ReactElement, useEffect, useMemo, useRef } from "react"

import { CSSObject, Global } from "@emotion/react"
import embed from "vega-embed"
import { expressionInterpreter } from "vega-interpreter"
import { TopLevelSpec } from "vega-lite"

import { applyStreamlitTheme } from "~lib/components/elements/ArrowVegaLiteChart/CustomTheme"
import { StyledVegaLiteChartTooltips } from "~lib/components/elements/ArrowVegaLiteChart/styled-components"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import type { EmotionTheme } from "~lib/theme/types"

import { ColumnStatistics, HistogramBin } from "./statisticsUtils"
import { StyledStatisticsChart } from "./styled-components"

/** Chart width in pixels. */
const CHART_WIDTH = 180

/** Chart height in pixels. */
const CHART_HEIGHT = 56

/** Accessible labels for each chart type. */
const CHART_LABELS: Record<string, string> = {
  numeric: "Distribution histogram",
  datetime: "Distribution histogram",
  text: "Top values frequency chart",
  boolean: "True/false distribution chart",
}

/**
 * Creates tooltip styles with higher z-index for use within popovers.
 * This ensures tooltips appear above the column menu portal (#portal uses tablePortal).
 * Both #vg-tooltip-element and #portal are siblings under <body>, so z-index comparison
 * applies directly. Using tablePortalTooltip ensures tooltips render above the menu.
 */
function createPopoverTooltipStyles(theme: EmotionTheme): CSSObject {
  const baseStyles = StyledVegaLiteChartTooltips(theme)
  return {
    ...baseStyles,
    "#vg-tooltip-element": {
      ...(baseStyles["#vg-tooltip-element"] as CSSObject),
      // Use tablePortalTooltip to ensure tooltips appear above the column menu portal
      zIndex: theme.zIndices.tablePortalTooltip,
    },
  }
}

/**
 * Formats a number for display in tooltips.
 */
function formatTooltipNumber(value: number): string {
  if (Number.isInteger(value)) {
    return value.toLocaleString()
  }
  // For decimals, show up to 2 significant decimal places
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

/**
 * Formats a timestamp as a date/datetime string.
 * @param timestamp - Unix timestamp in milliseconds
 * @param includeTime - If true, include time in the formatted string
 * @param timezone - Optional timezone identifier (e.g., "America/New_York", "UTC").
 *                   Defaults to UTC for consistency with StatisticsMenu.
 */
function formatTooltipDate(
  timestamp: number,
  includeTime = false,
  timezone?: string
): string {
  const date = new Date(timestamp)
  const tz = timezone || "UTC"
  if (includeTime) {
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
    })
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: tz,
  })
}

interface StatisticsChartProps {
  statistics: ColumnStatistics
}

/**
 * Creates a Vega-Lite spec for a histogram chart.
 */
function createHistogramSpec(
  bins: HistogramBin[],
  theme: ReturnType<typeof useEmotionTheme>,
  formatRange: (start: number, end: number) => string
): TopLevelSpec {
  const data = bins.map(bin => ({
    x: (bin.binStart + bin.binEnd) / 2,
    count: bin.count,
    range: formatRange(bin.binStart, bin.binEnd),
  }))

  const spec: TopLevelSpec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    data: { values: data },
    mark: {
      type: "bar",
      cornerRadiusTopLeft: 2,
      cornerRadiusTopRight: 2,
    },
    encoding: {
      x: {
        field: "x",
        type: "quantitative",
        axis: null,
        scale: { nice: false },
      },
      y: {
        field: "count",
        type: "quantitative",
        axis: null,
        scale: { nice: false },
      },
      tooltip: [
        { field: "range", type: "nominal", title: "Range" },
        { field: "count", type: "quantitative", title: "Count" },
      ],
    },
    config: {
      view: { stroke: null },
      padding: { left: 0, right: 0, top: 2, bottom: 2 },
    },
  }

  spec.config = applyStreamlitTheme(spec.config, theme)
  return spec
}

/**
 * Creates a Vega-Lite spec for a horizontal bar chart (text/boolean statistics).
 * Uses fullLabel for data binding and tooltip. The y-axis is hidden (axis: null)
 * so no label truncation is needed - full values are preserved for accurate tooltips.
 */
function createBarChartSpec(
  data: { fullLabel: string; value: number }[],
  theme: ReturnType<typeof useEmotionTheme>
): TopLevelSpec {
  const spec: TopLevelSpec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    data: { values: data },
    mark: {
      type: "bar",
      cornerRadiusEnd: 2,
    },
    encoding: {
      y: {
        field: "fullLabel",
        type: "nominal",
        axis: null,
        sort: "-x",
      },
      x: {
        field: "value",
        type: "quantitative",
        axis: null,
        scale: { nice: false },
      },
      tooltip: [
        { field: "fullLabel", type: "nominal", title: "Value" },
        { field: "value", type: "quantitative", title: "Count" },
      ],
    },
    config: {
      view: { stroke: null },
      padding: { left: 0, right: 0, top: 2, bottom: 2 },
    },
  }

  spec.config = applyStreamlitTheme(spec.config, theme)
  return spec
}

/**
 * StatisticsChart renders a Vega-Lite chart for column statistics.
 * Supports histograms for numeric/datetime and bar charts for text/boolean.
 */
function StatisticsChart({
  statistics,
}: Readonly<StatisticsChartProps>): ReactElement | null {
  const theme = useEmotionTheme()
  const chartRef = useRef<HTMLDivElement>(null)
  const tooltipStyles = useMemo(
    () => createPopoverTooltipStyles(theme),
    [theme]
  )

  useEffect(() => {
    if (!chartRef.current) return

    const chartElement = chartRef.current
    let spec: TopLevelSpec | null = null
    let cancelled = false
    let embedResult: Awaited<ReturnType<typeof embed>> | null = null

    switch (statistics.type) {
      case "numeric":
        if (statistics.histogram.length > 0) {
          spec = createHistogramSpec(
            statistics.histogram,
            theme,
            (start, end) =>
              `${formatTooltipNumber(start)} – ${formatTooltipNumber(end)}`
          )
        }
        break

      case "datetime":
        if (statistics.histogram.length > 0) {
          // Include time in tooltip for datetime columns, exclude for date-only
          const includeTime = !statistics.isDateOnly
          // Thread timezone through to tooltip formatter for consistency with metrics display
          const tz = statistics.timezone
          spec = createHistogramSpec(
            statistics.histogram,
            theme,
            (start, end) =>
              `${formatTooltipDate(start, includeTime, tz)} – ${formatTooltipDate(end, includeTime, tz)}`
          )
        }
        break

      case "text":
        if (statistics.topValues.length > 0) {
          const data = statistics.topValues.map(v => ({
            fullLabel: v.value,
            value: v.count,
          }))
          spec = createBarChartSpec(data, theme)
        }
        break

      case "boolean":
        spec = createBarChartSpec(
          [
            {
              fullLabel: "True",
              value: statistics.trueCount,
            },
            {
              fullLabel: "False",
              value: statistics.falseCount,
            },
          ],
          theme
        )
        break
    }

    if (spec) {
      embed(chartElement, spec, {
        actions: false,
        renderer: "svg",
        ast: true,
        expr: expressionInterpreter,
        tooltip: { theme: "custom" },
      })
        .then(result => {
          if (cancelled) {
            result.finalize()
          } else {
            embedResult = result
          }
        })
        .catch(() => {
          // Ignore embed errors (e.g., component unmounted during async operation)
        })
    }

    return () => {
      cancelled = true
      embedResult?.finalize()
      chartElement.innerHTML = ""
    }
  }, [statistics, theme])

  // Don't render if there's no data to show
  if (
    ((statistics.type === "numeric" || statistics.type === "datetime") &&
      statistics.histogram.length === 0) ||
    (statistics.type === "text" && statistics.topValues.length === 0) ||
    (statistics.type === "boolean" && statistics.count === 0)
  ) {
    return null
  }

  const chartLabel = CHART_LABELS[statistics.type]

  return (
    <>
      {/*
       * Global styles raise the z-index of #vg-tooltip-element for all Vega charts
       * while this component is mounted. This is a global side effect, but only one
       * tooltip is visible at a time, and the elevated z-index is required for tooltips
       * to appear above the column menu portal. See createPopoverTooltipStyles() for details.
       */}
      <Global styles={tooltipStyles} />
      <StyledStatisticsChart
        ref={chartRef}
        data-testid="stDataFrameStatisticsChart"
        aria-label={chartLabel}
        role="img"
      />
    </>
  )
}

export default memo(StatisticsChart)
