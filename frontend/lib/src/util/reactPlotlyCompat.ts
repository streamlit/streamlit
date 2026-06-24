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

/**
 * Compatibility shim for `react-plotly.js` under Vite 8.
 *
 * Intent:
 * - Normalize the imported module to a React component value that can be
 *   rendered reliably by PlotlyChart.
 *
 * Why this exists:
 * - `react-plotly.js` is CommonJS, and Vite 8 interop can return nested
 *   default wrappers depending on optimizer behavior.
 * - Without this normalization, PlotlyChart can fail with
 *   "Element type is invalid".
 *
 * Removal criteria:
 * - Remove once direct `import Plot from "react-plotly.js"` works reliably in
 *   dev and production builds for this repository.
 * - Validate by running the debug app and confirming no Plotly import/render
 *   errors in `work-tmp/debug/latest/frontend.log`.
 *
 * Vite references:
 * - https://vite.dev/guide/migration.html
 * - https://vite.dev/config/dep-optimization-options
 */
import type {
  CSSProperties,
  ForwardRefExoticComponent,
  RefAttributes,
} from "react"

import type * as Plotly from "plotly.js"
import * as ReactPlotlyModule from "react-plotly.js"

import { resolveDefaultExport } from "./resolveDefaultExport"

export interface Figure {
  data: Plotly.Data[]
  layout: Partial<Plotly.Layout>
  frames: Plotly.Frame[] | null
}

type FigureCallback = (
  figure: Readonly<Figure>,
  graphDiv: Readonly<HTMLElement>
) => void

type EventCallback<TEvent = unknown> = (event: Readonly<TEvent>) => void

type BooleanEventCallback<TEvent = unknown> = (
  event: Readonly<TEvent>
) => boolean

export interface PlotParams {
  data: Plotly.Data[]
  layout: Partial<Plotly.Layout>
  frames?: Plotly.Frame[]
  config?: Partial<Plotly.Config>
  revision?: number
  onInitialized?: FigureCallback
  onUpdate?: FigureCallback
  onPurge?: FigureCallback
  onError?: (err: Readonly<Error>) => void
  divId?: string
  className?: string
  style?: CSSProperties
  debug?: boolean
  useResizeHandler?: boolean

  onAfterExport?: () => void
  onAfterPlot?: () => void
  onAnimated?: () => void
  onAnimatingFrame?: EventCallback<Plotly.FrameAnimationEvent>
  onAnimationInterrupted?: () => void
  onAutoSize?: () => void
  onBeforeExport?: () => void
  onBeforeHover?: BooleanEventCallback<Plotly.PlotMouseEvent>
  onButtonClicked?: EventCallback
  onClick?: EventCallback<Plotly.PlotMouseEvent>
  onClickAnnotation?: EventCallback<Plotly.ClickAnnotationEvent>
  onClickAnywhere?: EventCallback
  onDeselect?: () => void
  onDoubleClick?: () => void
  onFramework?: () => void
  onHover?: EventCallback<Plotly.PlotHoverEvent>
  onHoverAnywhere?: EventCallback
  onLegendClick?: BooleanEventCallback<Plotly.LegendClickEvent>
  onLegendDoubleClick?: BooleanEventCallback<Plotly.LegendClickEvent>
  onRelayout?: EventCallback<Plotly.PlotRelayoutEvent>
  onRelayouting?: EventCallback
  onRestyle?: EventCallback<Plotly.PlotRestyleEvent>
  onRedraw?: () => void
  onSelected?: EventCallback<Plotly.PlotSelectionEvent>
  onSelecting?: EventCallback<Plotly.PlotSelectionEvent>
  onSliderChange?: EventCallback<Plotly.SliderChangeEvent>
  onSliderEnd?: EventCallback<Plotly.SliderEndEvent>
  onSliderStart?: EventCallback<Plotly.SliderStartEvent>
  onSunburstClick?: EventCallback
  onTransitioning?: () => void
  onTransitionInterrupted?: () => void
  onUnhover?: EventCallback<Plotly.PlotMouseEvent>
  onWebGlContextLost?: () => void
}

type ReactPlotlyComponent = ForwardRefExoticComponent<
  PlotParams & RefAttributes<HTMLDivElement>
>

const ReactPlotly = resolveDefaultExport(
  ReactPlotlyModule
) as ReactPlotlyComponent

export default ReactPlotly
