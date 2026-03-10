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

import { memo, ReactElement, useEffect, useRef } from "react"

import { Global } from "@emotion/react"
import embed from "vega-embed"
import { expressionInterpreter } from "vega-interpreter"
import { TopLevelSpec } from "vega-lite"

import {
  applyStreamlitTheme,
  StyledVegaLiteChartTooltips,
} from "~lib/components/elements/ArrowVegaLiteChart"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"

import {
  BooleanStatistics,
  DateTimeStatistics,
  HistogramBin,
  NumericStatistics,
  TextStatistics,
} from "./statisticsUtils"
import { StyledStatisticsChart } from "./styled-components"

/** Chart width in pixels. */
const CHART_WIDTH = 180

/** Chart height in pixels. */
const CHART_HEIGHT = 56

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
 * Formats a timestamp as a short date string.
 */
function formatTooltipDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export interface StatisticsChartProps {
  statistics:
    | NumericStatistics
    | TextStatistics
    | DateTimeStatistics
    | BooleanStatistics
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
 */
function createBarChartSpec(
  data: { label: string; value: number }[],
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
        field: "label",
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

  useEffect(() => {
    if (!chartRef.current) return

    const chartElement = chartRef.current
    let spec: TopLevelSpec | null = null

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
          spec = createHistogramSpec(
            statistics.histogram,
            theme,
            (start, end) =>
              `${formatTooltipDate(start)} – ${formatTooltipDate(end)}`
          )
        }
        break

      case "text":
        if (statistics.topValues.length > 0) {
          const data = statistics.topValues.map(v => ({
            label: v.value.length > 15 ? `${v.value.slice(0, 15)}…` : v.value,
            value: v.count,
          }))
          spec = createBarChartSpec(data, theme)
        }
        break

      case "boolean":
        spec = createBarChartSpec(
          [
            { label: "True", value: statistics.trueCount },
            { label: "False", value: statistics.falseCount },
          ],
          theme
        )
        break
    }

    if (spec) {
      void embed(chartElement, spec, {
        actions: false,
        renderer: "svg",
        ast: true,
        expr: expressionInterpreter,
        tooltip: { theme: "custom" },
      })
    }

    return () => {
      // Cleanup: clear the chart container
      chartElement.innerHTML = ""
    }
  }, [statistics, theme])

  // Don't render if there's no data to show
  if (
    (statistics.type === "numeric" && statistics.histogram.length === 0) ||
    (statistics.type === "datetime" && statistics.histogram.length === 0) ||
    (statistics.type === "text" && statistics.topValues.length === 0) ||
    (statistics.type === "boolean" && statistics.count === 0)
  ) {
    return null
  }

  // Determine accessible label based on chart type
  const chartLabel =
    statistics.type === "numeric" || statistics.type === "datetime"
      ? "Distribution histogram"
      : statistics.type === "text"
        ? "Top values frequency chart"
        : "True/false distribution chart"

  return (
    <>
      <Global styles={StyledVegaLiteChartTooltips(theme)} />
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
