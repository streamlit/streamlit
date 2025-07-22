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

import React, { memo, ReactElement, useEffect, useRef } from "react"

import { EmotionIcon } from "@emotion-icons/emotion-icon"
import { ArrowDownward, ArrowUpward } from "@emotion-icons/material-outlined"
import { expressionInterpreter } from "vega-interpreter"
import embed from "vega-embed"
import { Global } from "@emotion/react"
import { TopLevelSpec } from "vega-lite"
import type { Encoding } from "vega-lite/build/src/encoding"
import type { Mark, MarkDef } from "vega-lite/build/src/mark"
import { Transform } from "vega-lite/build/src/transform"
import { TopLevelUnitSpec } from "vega-lite/build/src/spec/unit"
import type { Field } from "vega-lite/build/src/channeldef"

import { Metric as MetricProto } from "@streamlit/protobuf"
import { convertRemToPx, useEmotionTheme } from "@streamlit/lib"

import { labelVisibilityProtoValueToEnum } from "~lib/util/utils"
import Icon from "~lib/components/shared/Icon"
import { StyledWidgetLabelHelpInline } from "~lib/components/widgets/BaseWidget"
import TooltipIcon from "~lib/components/shared/TooltipIcon"
import { Placement } from "~lib/components/shared/Tooltip"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown"
import { useCalculatedWidth } from "~lib/hooks/useCalculatedWidth"
import {
  applyStreamlitTheme,
  StyledVegaLiteChartTooltips,
} from "~lib/components/elements/ArrowVegaLiteChart"

import {
  getMetricColor,
  StyledMetricContainer,
  StyledMetricContent,
  StyledMetricDeltaText,
  StyledMetricLabelText,
  StyledMetricSparkline,
  StyledMetricValueText,
  StyledTruncateText,
} from "./styled-components"

export interface MetricProps {
  element: MetricProto
}

/**
 * Only supporting one flavor of Vega Lite VisualizationSpec for now,
 * as modifying the config with UI controls is difficult when supporting all spec types.
 */
export type VegaSpec = TopLevelUnitSpec<Field>

/**
 * Definition for a Vega-Lite parameter.
 * This is a simplified version. For full capabilities, refer to Vega-Lite's own Parameter types.
 */
export type Param = {
  name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bind?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  select?: any
  views?: string[]
}

/**
 * Enhances a Vega-Lite specification for a line chart to provide better hover interactions.
 *
 * This function takes a Vega-Lite spec (expected to be a non-layered line chart) and transforms it
 * into a layered chart. The transformation includes:
 * 1. The original line layer.
 * 2. A points layer: Invisible points are added along the line. These points become visible on hover
 *    and display tooltips.
 * 3. A rule layer: A vertical rule that follows the nearest x-value on hover.
 *
 * A selection parameter (`hoverParamName`) is introduced to manage the hover state,
 * driven by mouse movement over the chart, nearest to the x-field.
 *
 * If the input spec is not a line chart, is already layered, or lacks a suitable x-axis field encoding,
 * the original spec is returned unmodified.
 *
 * @param inputSpec The Vega-Lite specification to enhance.
 * @returns A new, enhanced Vega-Lite specification. Returns the original `inputSpec` if enhancement is not applicable
 * (e.g., not a line chart, already layered, unsuitable x-axis configuration) or if an unexpected error occurs during
 * the transformation process.
 */
export function enhanceSpecForBetterHover(inputSpec: VegaSpec): TopLevelSpec {
  try {
    const spec = structuredClone(inputSpec)

    const isLayered = "layer" in spec && !!spec.layer
    const currentMark = "mark" in spec ? spec.mark : undefined
    const isLineMark =
      currentMark &&
      (typeof currentMark === "string"
        ? currentMark === "line"
        : currentMark.type === "line")

    if (!isLineMark || isLayered) {
      // Return original if not a line chart or already layered:
      return inputSpec
    }

    const specAsUnit = spec as TopLevelSpec

    // Access unit-specific properties with assertions based on prior runtime checks.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unitEncoding = (specAsUnit as { encoding?: Encoding<any> }).encoding
    const unitMark = (specAsUnit as { mark?: Mark | MarkDef }).mark
    const unitTransform = (specAsUnit as { transform?: Transform[] }).transform
    const unitParams = (specAsUnit as { params?: Param[] }).params

    const xEncoding = unitEncoding?.x
    if (
      !xEncoding ||
      typeof xEncoding !== "object" ||
      xEncoding === null ||
      !("field" in xEncoding) ||
      typeof xEncoding.field !== "string"
    ) {
      // Return original if x-encoding is not suitable
      return inputSpec
    }

    const randomId = Math.random().toString(36).slice(2, 10)
    const baseName = `hover_enhanced_${randomId}`
    const lineLayerName = `${baseName}_line`
    const pointsLayerName = `${baseName}_points`
    const highlightedPointsLayerName = `${baseName}_highlighted_points`
    const ruleLayerName = `${baseName}_rule`
    const hoverParamName = `${baseName}_hover_selection`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lineLayer: any = {
      name: lineLayerName,
      mark: unitMark,
      encoding: unitEncoding,
      ...(unitTransform && { transform: unitTransform }),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pointsEncoding: any = unitEncoding
      ? structuredClone(unitEncoding)
      : {}
    // Clear any existing opacity encoding from the original spec for the points layer,
    // as we are fully defining it here based on selection.
    delete pointsEncoding.opacity

    const hoverSelectionParam: Param = {
      name: hoverParamName,
      select: {
        type: "point",
        // If there is only a single line, use the x-axis only nearest behavior.
        // Otherwise, use the default nearest behavior.
        // On single line charts it feels more expected / less laggy to just
        // select the nearest point on the x-axis:
        encodings: !unitEncoding?.color ? ["x"] : undefined,
        nearest: true,
        on: "mousemove",
        clear: "mouseout",
      },
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pointsLayer: any = {
      name: pointsLayerName,
      // Mark is invisible, used only for hover detection.
      mark: { type: "point", opacity: 0 },
      encoding: pointsEncoding,
      params: [hoverSelectionParam],
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const highlightedPointsLayer: any = {
      name: highlightedPointsLayerName,
      transform: [
        {
          filter: { param: hoverParamName, empty: false },
        },
        // Add window transform and filter to ensure only one point is highlighted,
        // even if the selection parameter theoretically selects multiple co-located points
        // which is possible when the encoding is specified on th parameter.
        {
          window: [{ op: "row_number", as: "hover_selection_rank" }],
        },
        {
          filter: "datum.hover_selection_rank === 1",
        },
      ],
      mark: { type: "point", filled: true, size: 65, tooltip: true },
      encoding: pointsEncoding,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ruleLayer: any = {
      name: ruleLayerName,
      transform: [
        {
          filter: { param: hoverParamName, empty: false },
        },
      ],
      mark: { type: "rule", strokeDash: [6, 6] },
      encoding: {
        x: structuredClone(xEncoding),
      },
    }

    const existingParams: Param[] = unitParams
      ? structuredClone(unitParams)
      : []

    const layeredSpec: TopLevelSpec = {
      // Base structure for a layered spec
      $schema:
        specAsUnit.$schema ??
        "https://vega.github.io/schema/vega-lite/v5.json",
      ...(specAsUnit.data !== undefined && { data: specAsUnit.data }),
      layer: [lineLayer, pointsLayer, highlightedPointsLayer, ruleLayer],
      // Use the original cloned params for the top-level spec. hoverSelectionParam is NOT here.
      params: existingParams,

      // Carry over optional top-level properties if they exist and are defined
      ...(specAsUnit.description !== undefined && {
        description: specAsUnit.description,
      }),
      ...(specAsUnit.title !== undefined && { title: specAsUnit.title }),

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...((specAsUnit as any).width !== undefined && {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        width: (specAsUnit as any).width,
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...((specAsUnit as any).height !== undefined && {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        height: (specAsUnit as any).height,
      }),
      ...(specAsUnit.autosize !== undefined && {
        autosize: specAsUnit.autosize,
      }),
      ...(specAsUnit.padding !== undefined && { padding: specAsUnit.padding }),
      ...(specAsUnit.resolve !== undefined && { resolve: specAsUnit.resolve }),
    }

    // Handle config separately to merge legend modification safely
    layeredSpec.config = {
      ...(specAsUnit.config ?? {}),
      legend: {
        ...(specAsUnit.config?.legend ?? {}),
        symbolType: "stroke",
      },
    }

    return layeredSpec
  } catch {
    // If any error occurs during the cloning or transformation,
    // fall back to the original spec.
    return inputSpec
  }
}

function Metric({ element }: Readonly<MetricProps>): ReactElement {
  const theme = useEmotionTheme()
  const [sparklineWidth, sparklineContainerRef] = useCalculatedWidth()

  const { MetricDirection } = MetricProto
  const {
    body,
    label,
    delta,
    direction,
    color,
    labelVisibility,
    help,
    showBorder,
    sparkline,
  } = element

  let metricDirection: EmotionIcon | null = null

  switch (direction) {
    case MetricDirection.DOWN:
      metricDirection = ArrowDownward
      break
    case MetricDirection.UP:
      metricDirection = ArrowUpward
      break
  }

  const arrowMargin = "0 threeXS 0 0"
  const deltaExists = delta !== ""

  const sparklineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (sparkline && sparklineRef.current) {
      const randomId = Math.random().toString(36).slice(2, 10)
      const baseName = `sparkline_${randomId}`

      const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width: sparklineWidth,
        height: Math.round(convertRemToPx("3.25rem")),
        data: {
          values: sparkline.map((value, index) => ({ x: index, y: value })),
        },
        layer: [
          {
            name: `${baseName}_line`,
            mark: "line",
            encoding: {
              x: {
                field: "x",
                type: "quantitative",
                axis: null,
                scale: {
                  zero: false,
                  nice: false,
                },
              },
              y: {
                field: "y",
                type: "quantitative",
                axis: null,
                scale: {
                  zero: false,
                  nice: false,
                },
              },
            },
          },
          {
            name: `${baseName}_points`,
            mark: {
              type: "point",
              opacity: 0,
            },
            encoding: {
              x: {
                field: "x",
                type: "quantitative" as const,
                axis: null,
                scale: {
                  zero: false,
                  nice: false,
                },
              },
              y: {
                field: "y",
                type: "quantitative" as const,
                axis: null,
                scale: {
                  zero: false,
                  nice: false,
                },
              },
            },
            params: [
              {
                name: `${baseName}_hover_selection`,
                select: {
                  type: "point",
                  encodings: ["x"],
                  nearest: true,
                  on: "mousemove",
                  clear: "mouseout",
                },
              },
            ],
          },
          {
            name: `${baseName}_highlighted_points`,
            transform: [
              {
                filter: {
                  param: `${baseName}_hover_selection`,
                  empty: false,
                },
              },
              {
                window: [
                  {
                    op: "row_number",
                    as: "hover_selection_rank",
                  },
                ],
              },
              {
                filter: "datum.hover_selection_rank === 1",
              },
            ],
            mark: {
              type: "point",
              filled: true,
              size: 65,
              tooltip: true,
            },
            encoding: {
              x: {
                field: "x",
                type: "quantitative",
                axis: null,
                scale: {
                  zero: false,
                  nice: false,
                },
              },
              y: {
                field: "y",
                type: "quantitative",
                axis: null,
                scale: {
                  zero: false,
                  nice: false,
                },
              },
            },
          },
          {
            name: `${baseName}_rule`,
            transform: [
              {
                filter: {
                  param: `${baseName}_hover_selection`,
                  empty: false,
                },
              },
            ],
            mark: {
              type: "rule",
              strokeDash: [6, 6],
            },
            encoding: {
              x: {
                field: "x",
                type: "quantitative" as const,
                axis: null,
                scale: {
                  zero: false,
                  nice: false,
                },
              },
            },
          },
        ],
        config: {
          view: { stroke: null },
          padding: { left: 0, right: 0, top: 2, bottom: 2 },
          mark: {
            tooltip: { content: "encoding" },
            color: getMetricColor(theme, color),
          },
          rule: {
            stroke: theme.colors.borderColorLight,
          },
        },
      }

      // const spec = enhanceSpecForBetterHover({
      //   $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      //   width: sparklineWidth,
      //   height: Math.round(convertRemToPx("3.25rem")),
      //   data: {
      //     values: sparkline.map((value, index) => ({ x: index, y: value })),
      //   },
      //   mark: "line" as const,
      //   encoding: {
      //     x: {
      //       field: "x",
      //       type: "quantitative" as const,
      //       axis: null,
      //       scale: { zero: false, nice: false },
      //     },
      //     y: {
      //       field: "y",
      //       type: "quantitative" as const,
      //       axis: null,
      //       scale: { zero: false, nice: false },
      //     },
      //   },
      //   // autosize: {
      //   //   type: "fit",
      //   //   contains: "padding",
      //   // },
      //   config: {
      //     view: { stroke: null },
      //     padding: { left: 0, right: 0, top: 2, bottom: 2 },
      //     mark: {
      //       tooltip: { content: "encoding" },
      //       color: getMetricColor(theme, color),
      //     },
      //     rule: {
      //       stroke: theme.colors.borderColorLight,
      //     },
      //   },
      // })
      // console.log(spec)
      spec.config = applyStreamlitTheme(spec.config, theme)

      void embed(sparklineRef.current, spec, {
        actions: false,
        renderer: "svg",
        ast: true,
        expr: expressionInterpreter,
        tooltip: {
          theme: "custom",
          formatTooltip: (value: { y: number }) => {
            return `${value.y}`
          },
        },
      })
    }
  }, [sparkline, color, theme, sparklineWidth, sparklineRef])

  return (
    <StyledMetricContainer
      className="stMetric"
      data-testid="stMetric"
      showBorder={showBorder}
    >
      <StyledMetricContent showBorder={showBorder}>
        <StyledMetricLabelText
          data-testid="stMetricLabel"
          visibility={labelVisibilityProtoValueToEnum(labelVisibility?.value)}
        >
          <StyledTruncateText>
            <StreamlitMarkdown source={label} allowHTML={false} isLabel />
          </StyledTruncateText>
          {help && (
            <StyledWidgetLabelHelpInline>
              <TooltipIcon content={help} placement={Placement.TOP_RIGHT} />
            </StyledWidgetLabelHelpInline>
          )}
        </StyledMetricLabelText>
        <StyledMetricValueText data-testid="stMetricValue">
          <StyledTruncateText> {body} </StyledTruncateText>
        </StyledMetricValueText>
        {deltaExists && (
          <StyledMetricDeltaText
            data-testid="stMetricDelta"
            metricColor={color}
          >
            {metricDirection && (
              <Icon
                testid={
                  metricDirection === ArrowUpward
                    ? "stMetricDeltaIcon-Up"
                    : "stMetricDeltaIcon-Down"
                }
                content={metricDirection}
                size="md"
                margin={arrowMargin}
              />
            )}
            <StyledTruncateText> {delta} </StyledTruncateText>
          </StyledMetricDeltaText>
        )}
      </StyledMetricContent>
      {sparkline && sparkline.length > 0 && (
        <div ref={sparklineContainerRef}>
          <Global styles={StyledVegaLiteChartTooltips} />
          <StyledMetricSparkline
            ref={sparklineRef}
            data-testid="stMetricSparkline"
            showBorder={showBorder}
          />
        </div>
      )}
    </StyledMetricContainer>
  )
}

export default memo(Metric)
