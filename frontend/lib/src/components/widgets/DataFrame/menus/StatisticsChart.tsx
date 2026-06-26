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
import { getLogger } from "loglevel"
import embed from "vega-embed"
import { expressionInterpreter } from "vega-interpreter"
import { TopLevelSpec } from "vega-lite"

import { applyStreamlitTheme } from "~lib/components/elements/ArrowVegaLiteChart/CustomTheme"
import { StyledVegaLiteChartTooltips } from "~lib/components/elements/ArrowVegaLiteChart/styled-components"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import type { EmotionTheme } from "~lib/theme/types"

import {
  ColumnStatistics,
  createLabeledBarDatum,
  formatTooltipDate,
  formatTooltipNumber,
  HistogramBin,
  LabeledBarDatum,
} from "./statisticsUtils"
import {
  StyledStatisticsBarChart,
  StyledStatisticsBarFill,
  StyledStatisticsBarLabel,
  StyledStatisticsBarRow,
  StyledStatisticsBarTrack,
  StyledStatisticsBarValue,
  StyledStatisticsChart,
} from "./styled-components"

const LOG = getLogger("StatisticsChart")

/**
 * Chart width in pixels. Passed directly to Vega-Lite, which requires absolute
 * pixel dimensions for its SVG viewport. This matches the rem-based width of the
 * surrounding statistics panel container at the default 16px root font-size.
 */
const CHART_WIDTH = 180

/**
 * Chart height in pixels. Passed directly to Vega-Lite (see CHART_WIDTH); kept in
 * sync with the container height defined in styled-components.
 */
const CHART_HEIGHT = 64

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
  // Encode each bar across its full bin width (binStart -> binEnd) so adjacent
  // bars touch and read as a continuous histogram instead of thin ticks. For a
  // single-value column the bin has zero width (binStart === binEnd), so we pad
  // it symmetrically to keep the lone bar visible.
  const isSinglePoint =
    bins.length === 1 && bins[0].binStart === bins[0].binEnd
  const data = bins.map(bin => ({
    binStart: isSinglePoint ? bin.binStart - 0.5 : bin.binStart,
    binEnd: isSinglePoint ? bin.binEnd + 0.5 : bin.binEnd,
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
      // A 1px hairline in the panel background color separates adjacent bars so
      // the histogram reads as distinct columns instead of a solid block. The
      // gap also lets us round the tops without the scalloped seam that appears
      // when rounded bars touch, keeping the columns consistent with the
      // rounded categorical bars.
      stroke: theme.colors.bgColor,
      strokeWidth: 1,
      cornerRadiusTopLeft: 2,
      cornerRadiusTopRight: 2,
    },
    encoding: {
      // Encode each bar as a full rectangle: horizontally across its bin
      // (binStart -> binEnd) and vertically from the count down to a zero
      // baseline (y2). This renders a proper filled histogram with touching
      // bars, instead of the fixed-width "ranged" bands Vega-Lite would draw if
      // only x/x2 were provided.
      x: {
        field: "binStart",
        type: "quantitative",
        axis: null,
        scale: { nice: false, zero: false },
      },
      x2: { field: "binEnd" },
      y: {
        field: "count",
        type: "quantitative",
        axis: null,
        scale: { nice: false },
      },
      y2: { datum: 0 },
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
 * Renders compact labeled bars for categorical statistics. Each bar is filled
 * to the value's percentage of the column total (track = 100%).
 */
function LabeledBarChart({
  ariaLabel,
  data,
}: {
  ariaLabel: string
  data: LabeledBarDatum[]
}): ReactElement {
  // role="img" makes descendants presentational, so the per-bar label/value
  // text isn't announced. Enumerate the bars (label, count, percentage) in the
  // aria-label so screen-reader users get the full breakdown, not just the
  // chart type.
  const descriptiveLabel = `${ariaLabel}: ${data
    .map(item => item.title)
    .join("; ")}`

  return (
    <StyledStatisticsBarChart
      data-testid="stDataFrameStatisticsChart"
      aria-label={descriptiveLabel}
      role="img"
    >
      {data.map(item => {
        const barWidth = Math.min(100, Math.max(0, item.percent))
        return (
          <StyledStatisticsBarRow key={item.label} title={item.title}>
            <StyledStatisticsBarLabel>{item.label}</StyledStatisticsBarLabel>
            <StyledStatisticsBarTrack>
              <StyledStatisticsBarFill style={{ width: `${barWidth}%` }} />
            </StyledStatisticsBarTrack>
            <StyledStatisticsBarValue>
              {item.valueLabel}
            </StyledStatisticsBarValue>
          </StyledStatisticsBarRow>
        )
      })}
    </StyledStatisticsBarChart>
  )
}

/**
 * StatisticsChart renders a Vega-Lite chart for column statistics.
 * Supports Vega-Lite histograms for numeric/datetime columns and labeled bars
 * for text/boolean columns.
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
        break

      case "boolean":
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
        .catch((error: unknown) => {
          // Embed errors are expected when the component unmounts mid-render, so
          // we don't surface them to the user. Log at debug level to keep genuine
          // spec errors discoverable during development without adding noise.
          LOG.debug("Failed to embed statistics chart:", error)
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

  if (statistics.type === "text") {
    const data = statistics.topValues.map(item =>
      createLabeledBarDatum(item.value, item.count, item.percentage)
    )

    return <LabeledBarChart ariaLabel={chartLabel} data={data} />
  }

  if (statistics.type === "boolean") {
    const data = [
      createLabeledBarDatum(
        "True",
        statistics.trueCount,
        statistics.truePercentage
      ),
      createLabeledBarDatum(
        "False",
        statistics.falseCount,
        statistics.falsePercentage
      ),
    ]

    return <LabeledBarChart ariaLabel={chartLabel} data={data} />
  }

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
