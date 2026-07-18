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
 * Canvas/WebGL engine for the scatterplot matrix navigation chart.
 *
 * This is a generic port of the "Scatterplot Matrix Navigation"
 * visualization: a scatterplot matrix (SPLOM) with an attached large detail
 * plot that can be navigated by jumping (left-click) or by "rolling" through
 * neighboring plots with an animated transition (right-click / arrow keys),
 * plus persistent lasso query layers and an excentric label lens.
 */

/* eslint-disable streamlit-custom/no-hardcoded-theme-values --
 * All chrome is painted onto a WebGL canvas with a fixed light "paper"
 * palette (matching the original visualization design); Emotion theme
 * tokens are not applicable to canvas drawing. */

/* eslint-disable streamlit-custom/no-force-reflow-access --
 * The engine must measure the canvas inside pointer/touch/resize handlers
 * to map event coordinates into canvas space; the reads are event-driven
 * and not part of a render loop. */

export interface ScatterplotMatrixPoint {
  /** Positional row index in the user-provided data. */
  id: number
  /** Label shown in the excentric label lens. */
  label: string
  /** One numeric value per matrix attribute. */
  atts: number[]
}

interface ScatterplotMatrixQueryLayerSelection {
  label: string
  indices: number[]
}

export interface ScatterplotMatrixSelection {
  indices: number[]
  query_layers: ScatterplotMatrixQueryLayerSelection[]
}

/**
 * Navigation and viewport state that survives engine rebuilds (e.g. app
 * reruns): the selected plot, the active query layer, and the zoom/pan view.
 */
export interface ScatterplotMatrixViewState {
  selectedPlot: { col: number; row: number }
  selectedQueryIndex: number
  view: { zoom: number; panX: number; panY: number; autoFit: boolean }
}

export interface ScatterplotMatrixEngineOptions {
  canvas: HTMLCanvasElement
  /** Names of the matrix dimensions (N x N cells). */
  attributes: string[]
  points: ScatterplotMatrixPoint[]
  title?: string
  /** One CSS color per query layer. */
  queryColors?: string[]
  /** Speed multiplier for the rolling animation. */
  rollSpeed?: number
  /** Per-layer point ids used to restore a previous selection. */
  initialSelection?: number[][]
  onSelectionChange?: (selection: ScatterplotMatrixSelection) => void
  /** Navigation/viewport state used to restore a previous engine instance. */
  initialViewState?: ScatterplotMatrixViewState
  onViewStateChange?: (viewState: ScatterplotMatrixViewState) => void
  /** When true, keyboard shortcuts are ignored. See {@link ScatterplotMatrixEngine.setDisabled}. */
  disabled?: boolean
}

interface Point {
  x: number
  y: number
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

interface PlotCoords {
  col: number
  row: number
}

interface QueryLayer {
  index: number
  color: string
  label: string
  members: Set<number>
}

interface DetailView {
  zoom: number
  panX: number
  panY: number
  autoFit: boolean
}

interface DetailLayout {
  matrixX: number
  matrixY: number
  cellSize: number
  gap: number
  matrixWidth: number
  largePlot: Rect
  queryPanel: Rect
}

interface RollAnimation {
  fromPlot: PlotCoords
  toPlot: PlotCoords
  axis: "x" | "y"
  frame: number
  frames: number
}

interface RollStep extends PlotCoords {
  axis: "x" | "y"
}

interface LensCandidate {
  point: ScatterplotMatrixPoint
  x: number
  y: number
  distance: number
}

interface ProjectedPoint {
  point: ScatterplotMatrixPoint
  coords: Point
}

interface LayerCoordinate extends Point {
  id: number
}

type RGBA = [number, number, number, number]

export const DEFAULT_QUERY_COLORS = [
  "#e74c3c",
  "#f39c12",
  "#2d7ff9",
  "#2bb673",
]

const LENS_SIZE = 56
const MAX_LENS_LABELS = 14
const ROLL_FRAMES_DEFAULT = 10
const CLICK_DRAG_TOLERANCE = 4
const QUERY_PANEL_ROW_HEIGHT = 26

// The chart keeps its light "paper" styling in both Streamlit themes; its
// ~35 plot/label colors are tuned for a light artboard.
const FRAME_COLOR = "#f7f3ec"
const TITLE_FONT = "600 22px Georgia"
const BODY_FONT_FAMILY = "'Avenir Next', 'Trebuchet MS', sans-serif"

export class ScatterplotMatrixEngine {
  private readonly canvas: HTMLCanvasElement

  private readonly renderer: WebGLRenderer

  private readonly attributes: string[]

  private readonly points: ScatterplotMatrixPoint[]

  private readonly title: string

  private readonly subtitle: string

  private readonly minAtt: number[]

  private readonly maxAtt: number[]

  private readonly queries: QueryLayer[]

  private readonly onSelectionChange:
    | ((selection: ScatterplotMatrixSelection) => void)
    | null

  private readonly onViewStateChange:
    | ((viewState: ScatterplotMatrixViewState) => void)
    | null

  private selectedPlot: PlotCoords

  private selectedQueryIndex: number

  private hoverPlot: PlotCoords | null = null

  private pathPreview: { from: PlotCoords; to: PlotCoords } | null = null

  private pendingSteps: RollStep[] = []

  private animation: RollAnimation | null = null

  private readonly lens = { active: false, x: 0, y: 0 }

  private lasso: Point[] | null = null

  private view: DetailView = { zoom: 1, panX: 0, panY: 0, autoFit: true }

  private layout: DetailLayout

  private dragState:
    | {
        type: "pointer"
        button: number
        startX: number
        startY: number
        moved: boolean
      }
    | { type: "lasso"; points: Point[]; queryIndex: number }
    | null = null

  private touchState:
    | {
        type: "pinch"
        startDist: number
        startZoom: number
        centerX: number
        centerY: number
        startPan: Point
      }
    | {
        type: "single"
        startX: number
        startY: number
        moved: boolean
        startPan: Point
      }
    | { type: "lasso"; points: Point[]; queryIndex: number }
    | { type: "consumed" }
    | null = null

  private rollFrames = ROLL_FRAMES_DEFAULT

  private renderQueued = false

  private disposers: Array<() => void> = []

  private disposed = false

  private disabled = false

  // Pre-baked static labels atlas. The title/axis labels never change
  // frame-to-frame within a given layout, so we rasterize them once into
  // this canvas and blit the result as a single textured quad until the
  // layout signature changes.
  private readonly labelAtlasCanvas: HTMLCanvasElement

  private readonly labelAtlasCtx: CanvasRenderingContext2D

  private labelAtlasSig: string | null = null

  constructor(options: ScatterplotMatrixEngineOptions) {
    this.canvas = options.canvas
    // eslint-disable-next-line @typescript-eslint/no-use-before-define -- the renderer class is co-located below the engine
    this.renderer = new WebGLRenderer(options.canvas)
    this.attributes = options.attributes
    this.points = options.points
    this.title = options.title ?? ""
    this.subtitle =
      `${options.points.length} points • left-click a small plot to jump` +
      ` • right-click to roll • lasso the large plot to select`
    this.onSelectionChange = options.onSelectionChange ?? null
    this.disabled = options.disabled ?? false
    this.labelAtlasCanvas = document.createElement("canvas")
    const atlasCtx = this.labelAtlasCanvas.getContext("2d")
    if (atlasCtx === null) {
      throw new Error("Could not create a 2D canvas context.")
    }
    this.labelAtlasCtx = atlasCtx

    const numAtts = this.attributes.length
    this.minAtt = Array.from(
      { length: numAtts },
      () => Number.POSITIVE_INFINITY
    )
    this.maxAtt = Array.from(
      { length: numAtts },
      () => Number.NEGATIVE_INFINITY
    )
    for (const point of this.points) {
      for (let i = 0; i < numAtts; i += 1) {
        this.minAtt[i] = Math.min(this.minAtt[i], point.atts[i])
        this.maxAtt[i] = Math.max(this.maxAtt[i], point.atts[i])
      }
    }

    const colors = options.queryColors?.length
      ? options.queryColors
      : DEFAULT_QUERY_COLORS
    const pointIds = new Set(this.points.map(point => point.id))
    // Ids from a restored selection can be missing from `this.points` when a
    // row that used to be selected no longer has finite values in every
    // matrix dimension (see extractChartData). Track whether that happened
    // so the reconciled (shrunk) selection is reported back to Python below,
    // instead of leaving stale ids in the widget state indefinitely.
    //
    // A restored selection can also have *more layers* than `colors` (e.g.
    // `query_colors` shrank between reruns); those extra layers are never
    // read below (colors.map only visits index < colors.length), so they
    // must count as reconciliation too, or their members would silently
    // linger in the widget state despite no longer having a UI layer.
    let selectionWasReconciled =
      (options.initialSelection?.length ?? 0) > colors.length
    this.queries = colors.map((color, index) => {
      const { keptIds, wasReconciled } = reconcileSelectionIds(
        options.initialSelection?.[index] ?? [],
        pointIds
      )
      if (wasReconciled) {
        selectionWasReconciled = true
      }
      return {
        index,
        color,
        label: `Query ${index + 1}`,
        members: new Set(keptIds),
      }
    })
    this.selectedQueryIndex = 0

    this.selectedPlot = { col: 0, row: Math.max(0, numAtts - 1) }
    this.setRollSpeed(options.rollSpeed ?? 1)
    this.onViewStateChange = options.onViewStateChange ?? null

    this.layout = this.getDetailLayout()
    this.bindEvents()
    this.resizeCanvas()
    this.view = this.computeDetailFit()
    this.restoreViewState(options.initialViewState)
    this.render()

    if (selectionWasReconciled) {
      this.emitSelection()
    }
  }

  /** Restores navigation/viewport state from a previous engine instance. */
  private restoreViewState(
    viewState: ScatterplotMatrixViewState | undefined
  ): void {
    if (viewState === undefined) {
      return
    }
    const maxIndex = this.attributes.length - 1
    this.selectedPlot = {
      col: clamp(Math.round(viewState.selectedPlot.col), 0, maxIndex),
      row: clamp(Math.round(viewState.selectedPlot.row), 0, maxIndex),
    }
    this.selectedQueryIndex = clamp(
      Math.round(viewState.selectedQueryIndex),
      0,
      this.queries.length - 1
    )
    // Auto-fitted views are recomputed for the current canvas size; only a
    // manually zoomed/panned view is restored verbatim.
    if (
      !viewState.view.autoFit &&
      Number.isFinite(viewState.view.zoom) &&
      viewState.view.zoom > 0
    ) {
      this.view = { ...viewState.view }
    }
  }

  private persistViewState(): void {
    this.onViewStateChange?.({
      selectedPlot: { ...this.selectedPlot },
      selectedQueryIndex: this.selectedQueryIndex,
      view: { ...this.view },
    })
  }

  setRollSpeed(speed: number): void {
    const safe = Number.isFinite(speed) && speed > 0 ? speed : 1
    this.rollFrames = Math.max(1, Math.round(ROLL_FRAMES_DEFAULT / safe))
  }

  /**
   * Toggles whether keyboard shortcuts are handled. Pointer interactions are
   * already blocked via `pointer-events: none` on the disabled canvas, but
   * that alone doesn't affect an element that was focused *before* becoming
   * disabled — the browser keeps delivering keydown events to it since
   * `tabIndex={-1}` doesn't blur an already-focused element. The caller is
   * expected to also blur the canvas on this transition (belt and suspenders
   * against any focus that persists or gets restored).
   */
  setDisabled(disabled: boolean): void {
    this.disabled = disabled
  }

  getSelection(): ScatterplotMatrixSelection {
    const union = new Set<number>()
    const queryLayers = this.queries.map(layer => {
      const indices = Array.from(layer.members).sort((a, b) => a - b)
      indices.forEach(id => union.add(id))
      return { label: layer.label, indices }
    })
    return {
      indices: Array.from(union).sort((a, b) => a - b),
      query_layers: queryLayers,
    }
  }

  clearAllQueries(): void {
    let hadMembers = false
    for (const layer of this.queries) {
      if (layer.members.size > 0) {
        hadMembers = true
      }
      layer.members.clear()
    }
    this.scheduleRender()
    if (hadMembers) {
      this.emitSelection()
    }
  }

  dispose(): void {
    this.disposed = true
    for (const disposer of this.disposers) {
      try {
        disposer()
      } catch {
        // Ignore disposal errors.
      }
    }
    this.disposers = []
    // Free GPU resources — the canvas (and its WebGL context) outlives the
    // engine across app reruns, so leaked programs/textures would accumulate.
    this.renderer.dispose()
  }

  private emitSelection(): void {
    this.onSelectionChange?.(this.getSelection())
  }

  // --- Event binding -------------------------------------------------------

  private bindEvents(): void {
    const resizeObserver = new ResizeObserver(() => {
      this.resizeCanvas()
      this.scheduleRender()
    })
    resizeObserver.observe(this.canvas)
    this.disposers.push(() => resizeObserver.disconnect())

    const onMouseMove = (event: MouseEvent): void => {
      const point = this.getCanvasPoint(event)
      if (
        this.dragState?.type === "pointer" &&
        !this.dragState.moved &&
        distanceBetween(
          point.x,
          point.y,
          this.dragState.startX,
          this.dragState.startY
        ) > CLICK_DRAG_TOLERANCE
      ) {
        this.dragState.moved = true
      }
      this.handleDetailMove(point)
    }
    this.canvas.addEventListener("mousemove", onMouseMove)
    this.disposers.push(() =>
      this.canvas.removeEventListener("mousemove", onMouseMove)
    )

    const onMouseLeave = (): void => {
      // Cancel an in-progress lasso so it doesn't keep growing when the
      // button is released outside the canvas.
      if (this.dragState?.type === "lasso") {
        this.dragState = null
        this.lasso = null
      }
      this.lens.active = false
      this.hoverPlot = null
      this.pathPreview = null
      this.scheduleRender()
    }
    this.canvas.addEventListener("mouseleave", onMouseLeave)
    this.disposers.push(() =>
      this.canvas.removeEventListener("mouseleave", onMouseLeave)
    )

    const onMouseDown = (event: MouseEvent): void => {
      this.canvas.focus()
      const point = this.getCanvasPoint(event)
      if (event.button === 0) {
        const layoutPoint = this.screenToLayout(point)
        const hit = this.getQueryPanelHit(layoutPoint)
        if (hit !== null) {
          this.dragState = null
          this.handleQueryPanelHit(hit)
          return
        }
        const largeRect = this.layout.largePlot
        if (
          pointInRect(layoutPoint, largeRect) &&
          !this.hasActiveAnimation()
        ) {
          this.dragState = {
            type: "lasso",
            points: [layoutPoint],
            queryIndex: this.selectedQueryIndex,
          }
          this.lasso = [layoutPoint]
          this.lens.active = false
          this.scheduleRender()
          return
        }
      }
      this.dragState = {
        type: "pointer",
        button: event.button,
        startX: point.x,
        startY: point.y,
        moved: false,
      }
    }
    this.canvas.addEventListener("mousedown", onMouseDown)
    this.disposers.push(() =>
      this.canvas.removeEventListener("mousedown", onMouseDown)
    )

    const onMouseUp = (event: MouseEvent): void => {
      const point = this.getCanvasPoint(event)
      if (this.dragState?.type === "lasso") {
        if (this.dragState.points.length > 2) {
          this.applyLassoSelection(
            this.dragState.queryIndex,
            this.dragState.points
          )
        }
        this.dragState = null
        this.lasso = null
        this.scheduleRender()
        return
      }
      const dragState = this.dragState
      this.dragState = null
      if (
        dragState?.type === "pointer" &&
        dragState.button === event.button &&
        !dragState.moved
      ) {
        this.handlePointerUp(point, event.button)
      }
    }
    this.canvas.addEventListener("mouseup", onMouseUp)
    this.disposers.push(() =>
      this.canvas.removeEventListener("mouseup", onMouseUp)
    )

    const onContextMenu = (event: Event): void => {
      event.preventDefault()
    }
    this.canvas.addEventListener("contextmenu", onContextMenu)
    this.disposers.push(() =>
      this.canvas.removeEventListener("contextmenu", onContextMenu)
    )

    const onKeyDown = (event: KeyboardEvent): void => {
      if (this.disabled) {
        return
      }
      let handled = true
      if (event.key === "ArrowUp") {
        this.moveSelectedPlot(0, -1)
      } else if (event.key === "ArrowDown") {
        this.moveSelectedPlot(0, 1)
      } else if (event.key === "ArrowLeft") {
        this.moveSelectedPlot(-1, 0)
      } else if (event.key === "ArrowRight") {
        this.moveSelectedPlot(1, 0)
      } else if (event.key.toLowerCase() === "r") {
        this.clearAllQueries()
      } else {
        handled = false
      }
      if (handled) {
        event.preventDefault()
        this.scheduleRender()
      }
    }
    this.canvas.addEventListener("keydown", onKeyDown)
    this.disposers.push(() =>
      this.canvas.removeEventListener("keydown", onKeyDown)
    )

    this.bindTouchEvents()
  }

  private bindTouchEvents(): void {
    const getTouchPoint = (touch: Touch): Point => {
      const rect = this.canvas.getBoundingClientRect()
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
    }

    const onTouchStart = (event: TouchEvent): void => {
      // We fully own touch gestures over the canvas; prevent the browser
      // from scrolling/zooming the page and from synthesizing duplicate
      // mouse events.
      event.preventDefault()
      this.canvas.focus()
      const touches = event.touches

      if (touches.length === 2) {
        const a = getTouchPoint(touches[0])
        const b = getTouchPoint(touches[1])
        this.touchState = {
          type: "pinch",
          startDist: Math.max(1, distanceBetween(a.x, a.y, b.x, b.y)),
          startZoom: this.view.zoom,
          centerX: (a.x + b.x) / 2,
          centerY: (a.y + b.y) / 2,
          startPan: { x: this.view.panX, y: this.view.panY },
        }
        return
      }

      if (touches.length !== 1) {
        return
      }

      const point = getTouchPoint(touches[0])
      const layoutPoint = this.screenToLayout(point)
      const hit = this.getQueryPanelHit(layoutPoint)
      if (hit !== null) {
        this.handleQueryPanelHit(hit)
        this.touchState = { type: "consumed" }
        return
      }
      if (
        pointInRect(layoutPoint, this.layout.largePlot) &&
        !this.hasActiveAnimation()
      ) {
        this.touchState = {
          type: "lasso",
          points: [layoutPoint],
          queryIndex: this.selectedQueryIndex,
        }
        this.lasso = [layoutPoint]
        this.lens.active = false
        this.scheduleRender()
        return
      }

      this.touchState = {
        type: "single",
        startX: point.x,
        startY: point.y,
        moved: false,
        startPan: { x: this.view.panX, y: this.view.panY },
      }
    }

    const onTouchMove = (event: TouchEvent): void => {
      if (this.touchState === null) {
        return
      }
      event.preventDefault()
      const touches = event.touches

      if (this.touchState.type === "pinch" && touches.length >= 2) {
        const a = getTouchPoint(touches[0])
        const b = getTouchPoint(touches[1])
        const dist = Math.max(1, distanceBetween(a.x, a.y, b.x, b.y))
        const nextZoom = clamp(
          this.touchState.startZoom * (dist / this.touchState.startDist),
          0.3,
          6
        )
        this.zoomAround(
          nextZoom,
          this.touchState.centerX,
          this.touchState.centerY,
          this.touchState.startPan,
          this.touchState.startZoom
        )
        return
      }

      if (touches.length !== 1) {
        return
      }
      const point = getTouchPoint(touches[0])

      if (this.touchState.type === "single") {
        const dx = point.x - this.touchState.startX
        const dy = point.y - this.touchState.startY
        if (
          !this.touchState.moved &&
          Math.hypot(dx, dy) > CLICK_DRAG_TOLERANCE
        ) {
          this.touchState.moved = true
        }
        // One-finger drag pans the scene (more useful on touch than the
        // desktop hover lens).
        this.view = {
          ...this.view,
          panX: this.touchState.startPan.x + dx,
          panY: this.touchState.startPan.y + dy,
          autoFit: false,
        }
        this.persistViewState()
        this.scheduleRender()
        return
      }

      if (this.touchState.type === "lasso") {
        this.touchState.points.push(this.screenToLayout(point))
        this.lasso = this.touchState.points
        this.scheduleRender()
      }
    }

    const onTouchEnd = (event: TouchEvent): void => {
      const state = this.touchState
      if (state === null) {
        return
      }

      if (state.type === "lasso") {
        if (state.points.length > 2) {
          this.applyLassoSelection(state.queryIndex, state.points)
        }
        this.lasso = null
        this.scheduleRender()
      } else if (state.type === "single" && !state.moved) {
        const layoutPoint = this.screenToLayout({
          x: state.startX,
          y: state.startY,
        })
        const plot = this.getMatrixPlotAt(layoutPoint)
        if (plot !== null) {
          this.jumpToPlot(plot)
        }
      }

      // Keep panning fluid when one finger lifts after a two-finger gesture.
      if (event.touches.length === 1) {
        const point = getTouchPoint(event.touches[0])
        this.touchState = {
          type: "single",
          startX: point.x,
          startY: point.y,
          moved: true,
          startPan: { x: this.view.panX, y: this.view.panY },
        }
      } else if (event.touches.length === 0) {
        this.touchState = null
      }
    }

    this.canvas.addEventListener("touchstart", onTouchStart, {
      passive: false,
    })
    this.canvas.addEventListener("touchmove", onTouchMove, { passive: false })
    this.canvas.addEventListener("touchend", onTouchEnd, { passive: false })
    this.canvas.addEventListener("touchcancel", onTouchEnd, { passive: false })
    this.disposers.push(() => {
      this.canvas.removeEventListener("touchstart", onTouchStart)
      this.canvas.removeEventListener("touchmove", onTouchMove)
      this.canvas.removeEventListener("touchend", onTouchEnd)
      this.canvas.removeEventListener("touchcancel", onTouchEnd)
    })
  }

  // --- View handling -------------------------------------------------------

  private resizeCanvas(): void {
    const width = Math.max(280, Math.floor(this.canvas.clientWidth))
    const height = Math.max(280, Math.floor(this.canvas.clientHeight))
    if (this.canvas.width !== width) {
      this.canvas.width = width
    }
    if (this.canvas.height !== height) {
      this.canvas.height = height
    }
    this.renderer.resize(width, height)
    // Keep the scene fitted to the new size unless the user has taken
    // manual control of the zoom.
    if (this.view.autoFit) {
      this.view = this.computeDetailFit()
    }
  }

  /** Re-zoom the scene around a focal screen point, keeping it put. */
  private zoomAround(
    nextZoom: number,
    screenX: number,
    screenY: number,
    startPan: Point,
    startZoom: number
  ): void {
    const layoutX = (screenX - startPan.x) / startZoom
    const layoutY = (screenY - startPan.y) / startZoom
    this.view = {
      zoom: nextZoom,
      panX: screenX - layoutX * nextZoom,
      panY: screenY - layoutY * nextZoom,
      autoFit: false,
    }
    this.persistViewState()
    this.scheduleRender()
  }

  /**
   * Bounds of everything drawn in the scene, in layout (pre-view)
   * coordinates, so the view can be fit to the canvas.
   */
  private contentBounds(): {
    left: number
    top: number
    width: number
    height: number
  } {
    const layout = this.getDetailLayout()
    const right = Math.max(
      layout.largePlot.x + layout.largePlot.width,
      layout.matrixX + layout.matrixWidth
    )
    const bottom = Math.max(
      layout.matrixY + layout.matrixWidth,
      layout.largePlot.y + layout.largePlot.height,
      layout.queryPanel.y + layout.queryPanel.height
    )
    const margin = 20
    return {
      left: 20,
      top: 20,
      width: right + margin - 20,
      height: bottom + margin - 20,
    }
  }

  /**
   * Fit the scene to the canvas. When it already fits at 1:1, keep the
   * identity transform so the layout is pixel-identical.
   */
  private computeDetailFit(): DetailView {
    const bounds = this.contentBounds()
    const fitZoom = Math.min(
      1,
      this.canvas.width / bounds.width,
      this.canvas.height / bounds.height
    )
    if (fitZoom >= 1) {
      return { zoom: 1, panX: 0, panY: 0, autoFit: true }
    }
    return {
      zoom: fitZoom,
      panX:
        (this.canvas.width - bounds.width * fitZoom) / 2 -
        bounds.left * fitZoom,
      panY:
        (this.canvas.height - bounds.height * fitZoom) / 2 -
        bounds.top * fitZoom,
      autoFit: true,
    }
  }

  /**
   * Map a screen-space pointer position into layout space, undoing the
   * current zoom/pan so all hit-testing stays in untransformed coordinates.
   */
  private screenToLayout(point: Point): Point {
    return {
      x: (point.x - this.view.panX) / this.view.zoom,
      y: (point.y - this.view.panY) / this.view.zoom,
    }
  }

  private getCanvasPoint(event: MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  private getDetailLayout(): DetailLayout {
    const width = this.canvas.width || 1
    const height = this.canvas.height || 1
    const numAtts = this.attributes.length
    const matrixX = 64
    const matrixY = 74
    const gap = 8
    const availableMatrixWidth = Math.max(300, Math.min(430, width * 0.42))
    const cellSize = clamp(
      Math.floor((availableMatrixWidth - gap * (numAtts - 1)) / numAtts),
      24,
      56
    )
    const matrixWidth = cellSize * numAtts + gap * (numAtts - 1)
    const largeX = matrixX + matrixWidth + 54
    const largeSize = clamp(
      Math.min(width - largeX - 36, height - 150),
      260,
      430
    )
    return {
      matrixX,
      matrixY,
      cellSize,
      gap,
      matrixWidth,
      largePlot: {
        x: largeX,
        y: matrixY,
        width: largeSize,
        height: largeSize,
      },
      queryPanel: {
        x: matrixX,
        y: matrixY + matrixWidth + 24,
        width: matrixWidth,
        height: 32 + this.queries.length * QUERY_PANEL_ROW_HEIGHT + 30,
      },
    }
  }

  // --- Navigation ----------------------------------------------------------

  private hasActiveAnimation(): boolean {
    return this.animation !== null || this.pendingSteps.length > 0
  }

  private jumpToPlot(targetPlot: PlotCoords): void {
    if (samePlot(targetPlot, this.selectedPlot)) {
      return
    }
    this.selectedPlot = { ...targetPlot }
    this.pendingSteps = []
    this.animation = null
    this.pathPreview = null
    this.lens.active = false
    this.persistViewState()
    this.scheduleRender()
  }

  private startNavigationToPlot(targetPlot: PlotCoords): void {
    if (samePlot(targetPlot, this.selectedPlot)) {
      return
    }
    this.pendingSteps = buildNavigationSteps(this.selectedPlot, targetPlot)
    this.pathPreview = null
    this.lens.active = false
    if (this.pendingSteps.length === 0) {
      return
    }
    if (this.animation === null) {
      this.beginNextAnimation()
    }
    this.scheduleRender()
  }

  private beginNextAnimation(): boolean {
    const nextStep = this.pendingSteps.shift()
    if (nextStep === undefined) {
      return false
    }
    const fromPlot = { ...this.selectedPlot }
    this.selectedPlot = { col: nextStep.col, row: nextStep.row }
    this.animation = {
      fromPlot,
      toPlot: { ...this.selectedPlot },
      axis: nextStep.axis,
      frame: 0,
      frames: this.rollFrames,
    }
    this.persistViewState()
    return true
  }

  private advanceAnimation(): boolean {
    if (this.animation === null) {
      return false
    }
    this.animation.frame += 1
    if (this.animation.frame < this.animation.frames) {
      return true
    }
    this.animation = null
    if (this.pendingSteps.length > 0) {
      this.beginNextAnimation()
      return true
    }
    return false
  }

  private moveSelectedPlot(deltaX: number, deltaY: number): void {
    // Mirror the right-click "roll to" rule (see handlePointerUp): don't
    // start a new route while one is still animating. Without this, a key
    // repeat mid-roll would replace pendingSteps relative to the *pending*
    // destination while the in-flight step keeps animating toward its own
    // target, producing a visibly discontinuous path.
    if (this.hasActiveAnimation()) {
      return
    }
    const maxIndex = this.attributes.length - 1
    this.startNavigationToPlot({
      col: clamp(this.selectedPlot.col + deltaX, 0, maxIndex),
      row: clamp(this.selectedPlot.row + deltaY, 0, maxIndex),
    })
  }

  // --- Pointer handling ----------------------------------------------------

  private handleDetailMove(point: Point): void {
    const layoutPoint = this.screenToLayout(point)
    if (this.dragState?.type === "lasso") {
      this.dragState.points.push(layoutPoint)
      this.lasso = this.dragState.points.slice()
      this.scheduleRender()
      return
    }

    const hoverPlot = this.getMatrixPlotAt(layoutPoint)
    this.hoverPlot = hoverPlot
    if (
      !this.hasActiveAnimation() &&
      hoverPlot !== null &&
      !samePlot(hoverPlot, this.selectedPlot)
    ) {
      this.pathPreview = { from: this.selectedPlot, to: hoverPlot }
    } else {
      this.pathPreview = null
    }

    if (
      !this.hasActiveAnimation() &&
      pointInRect(layoutPoint, this.layout.largePlot)
    ) {
      this.lens.active = true
      this.lens.x = layoutPoint.x
      this.lens.y = layoutPoint.y
    } else {
      this.lens.active = false
    }
    this.scheduleRender()
  }

  private handlePointerUp(point: Point, button: number): void {
    const layoutPoint = this.screenToLayout(point)
    const plot = this.getMatrixPlotAt(layoutPoint)
    if (plot === null) {
      return
    }
    if (button === 0) {
      this.jumpToPlot(plot)
    } else if (button === 2 && !this.hasActiveAnimation()) {
      this.startNavigationToPlot(plot)
    }
  }

  private getMatrixPlotAt(point: Point): PlotCoords | null {
    const { matrixX, matrixY, cellSize, gap } = this.layout
    const numAtts = this.attributes.length
    const pitch = cellSize + gap
    const x = point.x - matrixX
    const y = point.y - matrixY
    if (x < 0 || y < 0) {
      return null
    }
    const col = Math.floor(x / pitch)
    const row = Math.floor(y / pitch)
    if (col < 0 || row < 0 || col >= numAtts || row >= numAtts) {
      return null
    }
    if (x - col * pitch > cellSize || y - row * pitch > cellSize) {
      return null
    }
    return { col, row }
  }

  private getQueryPanelHit(
    point: Point
  ): { type: "layer"; index: number } | { type: "clear" } | null {
    const panel = this.layout.queryPanel
    if (!pointInRect(point, panel)) {
      return null
    }
    for (let index = 0; index < this.queries.length; index += 1) {
      const top = panel.y + 32 + index * QUERY_PANEL_ROW_HEIGHT
      if (
        point.x >= panel.x + 10 &&
        point.x <= panel.x + panel.width - 10 &&
        point.y >= top - 14 &&
        point.y <= top + 8
      ) {
        return { type: "layer", index }
      }
    }
    const clearTop = panel.y + panel.height - 24
    if (
      point.x >= panel.x + 10 &&
      point.x <= panel.x + panel.width - 10 &&
      point.y >= clearTop - 14 &&
      point.y <= clearTop + 6
    ) {
      return { type: "clear" }
    }
    return null
  }

  private handleQueryPanelHit(
    hit: { type: "layer"; index: number } | { type: "clear" }
  ): void {
    if (hit.type === "clear") {
      this.clearAllQueries()
      return
    }
    this.selectedQueryIndex = hit.index
    this.persistViewState()
    this.scheduleRender()
  }

  private applyLassoSelection(queryIndex: number, points: Point[]): void {
    const layer = this.queries[queryIndex]
    layer.members.clear()
    const rect = this.layout.largePlot
    for (const point of this.points) {
      const coords = this.projectToRect(
        this.selectedPlot.col,
        this.selectedPlot.row,
        rect,
        point
      )
      if (pointInPolygon(coords.x, coords.y, points)) {
        layer.members.add(point.id)
      }
    }
    this.emitSelection()
  }

  // --- Projection ----------------------------------------------------------

  private projectToRect(
    col: number,
    row: number,
    rect: Rect,
    point: ScatterplotMatrixPoint
  ): Point {
    return projectPointToRect(
      point.atts[col],
      this.minAtt[col],
      this.maxAtt[col],
      point.atts[row],
      this.minAtt[row],
      this.maxAtt[row],
      rect
    )
  }

  private projectAxisDistance(
    value: number,
    min: number,
    max: number,
    edge: number
  ): number {
    const range = max - min
    if (range === 0) {
      return edge / 2
    }
    return ((value - min) / range) * edge
  }

  // --- Rendering -----------------------------------------------------------

  private scheduleRender(): void {
    if (this.renderQueued) {
      return
    }
    this.renderQueued = true
    window.requestAnimationFrame(() => {
      this.renderQueued = false
      if (!this.disposed) {
        this.render()
      }
    })
  }

  private render(): void {
    this.renderer.beginFrame(parseColor(FRAME_COLOR))
    // Scale/translate the whole scene (matrix, large plot, labels, query
    // panel) uniformly so it can be zoomed and panned on small screens.
    this.renderer.setViewTransform(
      this.view.zoom,
      this.view.panX,
      this.view.panY
    )
    this.layout = this.getDetailLayout()
    // Keep the pre-baked label atlas in sync before drawing so the in-canvas
    // label positions match the current layout on the very first frame.
    this.ensureLabelAtlas(this.layout)
    this.drawMatrix(this.layout)
    this.drawQueryPanel(this.layout)
    if (!this.hasActiveAnimation() && this.pathPreview !== null) {
      this.drawPathPreview(this.layout, this.pathPreview)
    }
    // Blit the static labels (header + matrix axes + large-plot axes) as one
    // textured quad. Must happen before drawLargePlot so the dynamic lens
    // overlay (drawn inside drawLargePlot) stays on top.
    this.renderer.blitCanvasAtlas(
      "detail-labels",
      this.labelAtlasSig ?? "",
      this.labelAtlasCanvas,
      0,
      0
    )
    this.drawLargePlot(this.layout)
    if (this.advanceAnimation()) {
      this.scheduleRender()
    }
  }

  private ensureLabelAtlas(layout: DetailLayout): void {
    const width = this.canvas.width
    const height = this.canvas.height
    const selected = this.selectedPlot
    const animating = this.hasActiveAnimation()
    // Signature captures every input that affects a static label's pixels or
    // position. If any of these change we repaint the atlas canvas.
    const sig = [
      width,
      height,
      this.title,
      this.points.length,
      layout.matrixX,
      layout.matrixY,
      layout.cellSize,
      layout.gap,
      layout.largePlot.x,
      layout.largePlot.y,
      layout.largePlot.width,
      layout.largePlot.height,
      selected.col,
      selected.row,
      animating ? 1 : 0,
    ].join("|")
    if (this.labelAtlasSig === sig) {
      return
    }
    const canvas = this.labelAtlasCanvas
    if (canvas.width !== width) {
      canvas.width = width
    }
    if (canvas.height !== height) {
      canvas.height = height
    }
    const ctx = this.labelAtlasCtx
    ctx.clearRect(0, 0, width, height)
    ctx.textBaseline = "alphabetic"
    ctx.textAlign = "left"

    // Header title + subtitle.
    let subtitleY = 34
    if (this.title !== "") {
      ctx.font = TITLE_FONT
      ctx.fillStyle = "#1f2b28"
      ctx.fillText(this.title, layout.matrixX, 34)
      subtitleY = 54
    }
    ctx.font = `13px ${BODY_FONT_FAMILY}`
    ctx.fillStyle = "rgba(86, 104, 102, 0.95)"
    ctx.fillText(this.subtitle, layout.matrixX, subtitleY)

    // Matrix column labels (top row) and row labels (left column).
    ctx.font = `8px ${BODY_FONT_FAMILY}`
    ctx.fillStyle = "rgba(27, 39, 36, 0.84)"
    for (let i = 0; i < this.attributes.length; i += 1) {
      const colRect = getMatrixCellRect(layout, i, 0)
      ctx.fillText(this.attributes[i], colRect.x, colRect.y - 4)
    }
    for (let i = 0; i < this.attributes.length; i += 1) {
      const rowRect = getMatrixCellRect(layout, 0, i)
      const label = this.attributes[i]
      const textWidth = ctx.measureText(label).width
      ctx.fillText(
        label,
        rowRect.x - textWidth - 4,
        rowRect.y + rowRect.height / 2 + 3
      )
    }

    // Large-plot axis labels — only static when not mid-animation (the
    // rolling animation doesn't render axis labels at all).
    if (!animating) {
      const rect = layout.largePlot
      ctx.font = `600 12px ${BODY_FONT_FAMILY}`
      ctx.fillStyle = "#23302e"
      ctx.textAlign = "center"
      ctx.fillText(
        this.attributes[selected.col],
        rect.x + rect.width / 2,
        rect.y + rect.height + 24
      )
      ctx.save()
      ctx.translate(rect.x - 30, rect.y + rect.height / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText(this.attributes[selected.row], 0, 0)
      ctx.restore()
      ctx.textAlign = "left"
    }
    this.labelAtlasSig = sig
  }

  private drawMatrix(layout: DetailLayout): void {
    const numAtts = this.attributes.length
    // Pass 1: cell chrome (background, border) per cell.
    for (let row = 0; row < numAtts; row += 1) {
      for (let col = 0; col < numAtts; col += 1) {
        this.drawSmallPlotChrome(col, row, getMatrixCellRect(layout, col, row))
      }
    }
    // Pass 2: scatter dots across ALL cells in a single batched draw call.
    const dotPoints: Point[] = []
    for (let row = 0; row < numAtts; row += 1) {
      for (let col = 0; col < numAtts; col += 1) {
        const rect = getMatrixCellRect(layout, col, row)
        for (const point of this.points) {
          dotPoints.push(this.projectToRect(col, row, rect, point))
        }
      }
    }
    this.renderer.batchFillRects(dotPoints, 1.4, parseColor("#182321"))
  }

  private drawSmallPlotChrome(col: number, row: number, rect: Rect): void {
    const isSelected =
      this.selectedPlot.col === col && this.selectedPlot.row === row
    const isAttainable =
      (this.selectedPlot.col === col || this.selectedPlot.row === row) &&
      !isSelected
    const isHovered =
      this.hoverPlot?.col === col && this.hoverPlot?.row === row
    let fill = "rgba(32, 43, 41, 0.08)"
    if (isSelected) {
      fill = "rgba(228, 87, 72, 0.24)"
    } else if (isAttainable) {
      fill = "rgba(31, 146, 115, 0.18)"
    }
    if (isHovered) {
      fill = "rgba(52, 97, 190, 0.18)"
    }
    this.renderer.fillRect(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      parseColor(fill)
    )
    this.renderer.strokeRect(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      parseColor("rgba(42, 53, 52, 0.25)")
    )
  }

  private drawPathPreview(
    layout: DetailLayout,
    preview: { from: PlotCoords; to: PlotCoords }
  ): void {
    const start = getMatrixCellCenter(
      layout,
      preview.from.col,
      preview.from.row
    )
    const end = getMatrixCellCenter(layout, preview.to.col, preview.to.row)
    const color = parseColor("rgba(60, 80, 78, 0.7)")
    if (Math.abs(start.x - end.x) > Math.abs(start.y - end.y)) {
      this.renderer.dashedLine(start.x, start.y, start.x, end.y, color)
      this.renderer.dashedLine(start.x, end.y, end.x, end.y, color)
    } else {
      this.renderer.dashedLine(start.x, start.y, end.x, start.y, color)
      this.renderer.dashedLine(end.x, start.y, end.x, end.y, color)
    }
  }

  private drawLargePlot(layout: DetailLayout): void {
    const rect = layout.largePlot
    if (this.animation !== null) {
      this.drawRollingLargePlot(rect, this.animation)
      return
    }
    this.renderer.fillRect(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      parseColor("rgba(40, 54, 54, 0.08)")
    )
    this.renderer.strokeRect(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      parseColor("rgba(30, 39, 39, 0.24)")
    )
    // Axis lines only — the x/y text labels are baked into the label atlas.
    const axisColor = parseColor("rgba(35, 45, 43, 0.28)")
    this.renderer.line(
      rect.x,
      rect.y + rect.height,
      rect.x + rect.width,
      rect.y + rect.height,
      axisColor
    )
    this.renderer.line(rect.x, rect.y, rect.x, rect.y + rect.height, axisColor)

    const projectedPoints = this.collectProjectedPoints(point =>
      this.projectToRect(
        this.selectedPlot.col,
        this.selectedPlot.row,
        rect,
        point
      )
    )
    const layerCoordinates = this.buildLayerCoordinates(projectedPoints)
    this.drawLayerPointHighlights(layerCoordinates)
    const lensCandidates: LensCandidate[] = []
    const dotColor = parseColor("#101a18")
    const dotCenters: Point[] = []
    for (let i = 0; i < projectedPoints.length; i += 1) {
      const { point, coords } = projectedPoints[i]
      dotCenters.push(coords)
      if (
        this.lens.active &&
        Math.abs(coords.x - this.lens.x) <= LENS_SIZE / 2 &&
        Math.abs(coords.y - this.lens.y) <= LENS_SIZE / 2
      ) {
        lensCandidates.push({
          point,
          x: coords.x,
          y: coords.y,
          distance: distanceBetween(
            coords.x,
            coords.y,
            this.lens.x,
            this.lens.y
          ),
        })
      }
    }
    this.renderer.batchDiscs(dotCenters, 2.3, dotColor)

    this.drawQuerySelectionOverlays(layerCoordinates)

    if (this.lasso !== null && this.lasso.length > 1) {
      this.renderer.polyline(
        this.lasso,
        parseColor(this.queries[this.selectedQueryIndex].color)
      )
    }

    if (this.lens.active) {
      this.drawLensOverlay(lensCandidates, rect)
    }
  }

  private drawRollingLargePlot(rect: Rect, animation: RollAnimation): void {
    const progress = (animation.frame + 1) / animation.frames
    const rotation = progress * (Math.PI / 2)
    const sine = Math.sin(rotation)
    const cosine = Math.cos(rotation)
    const fillColor = parseColor("rgba(40, 54, 54, 0.08)")
    const strokeColor = parseColor("rgba(30, 39, 39, 0.24)")
    const dotColor = parseColor("#101a18")

    if (animation.axis === "y") {
      const animatedHeight = rect.height * (sine + cosine)
      const top = rect.y + rect.height / 2 - animatedHeight / 2
      this.renderer.fillRect(
        rect.x,
        top,
        rect.width,
        animatedHeight,
        fillColor
      )
      this.renderer.strokeRect(
        rect.x,
        top,
        rect.width,
        animatedHeight,
        strokeColor
      )
      const projectedPoints = this.collectProjectedPoints(point => {
        const x = this.projectAxisDistance(
          point.atts[animation.toPlot.col],
          this.minAtt[animation.toPlot.col],
          this.maxAtt[animation.toPlot.col],
          rect.width
        )
        const nextY = this.projectAxisDistance(
          point.atts[animation.toPlot.row],
          this.minAtt[animation.toPlot.row],
          this.maxAtt[animation.toPlot.row],
          rect.height
        )
        const previousY = this.projectAxisDistance(
          point.atts[animation.fromPlot.row],
          this.minAtt[animation.fromPlot.row],
          this.maxAtt[animation.fromPlot.row],
          rect.height
        )
        const blendedY = previousY * cosine + nextY * sine
        return { x: rect.x + x, y: top + animatedHeight - blendedY }
      })
      const layerCoordinates = this.buildLayerCoordinates(projectedPoints)
      this.drawLayerPointHighlights(layerCoordinates)
      this.renderer.batchDiscs(
        projectedPoints.map(p => p.coords),
        2.3,
        dotColor
      )
      this.drawQuerySelectionOverlays(layerCoordinates)

      const foldHeight =
        Math.sin(Math.PI / 4 - rotation) * rect.height * Math.SQRT2
      const midY = rect.y + rect.height / 2
      const rightX = rect.x + rect.width
      this.renderer.lineSegments(
        [
          {
            x1: rect.x,
            y1: midY - foldHeight / 2,
            x2: rightX,
            y2: midY - foldHeight / 2,
          },
          {
            x1: rect.x,
            y1: midY + foldHeight / 2,
            x2: rightX,
            y2: midY + foldHeight / 2,
          },
        ],
        strokeColor
      )
    } else {
      const animatedWidth = rect.width * (sine + cosine)
      const left = rect.x + rect.width / 2 - animatedWidth / 2
      this.renderer.fillRect(
        left,
        rect.y,
        animatedWidth,
        rect.height,
        fillColor
      )
      this.renderer.strokeRect(
        left,
        rect.y,
        animatedWidth,
        rect.height,
        strokeColor
      )
      const projectedPoints = this.collectProjectedPoints(point => {
        const previousX = this.projectAxisDistance(
          point.atts[animation.fromPlot.col],
          this.minAtt[animation.fromPlot.col],
          this.maxAtt[animation.fromPlot.col],
          rect.width
        )
        const nextX = this.projectAxisDistance(
          point.atts[animation.toPlot.col],
          this.minAtt[animation.toPlot.col],
          this.maxAtt[animation.toPlot.col],
          rect.width
        )
        const y = this.projectAxisDistance(
          point.atts[animation.toPlot.row],
          this.minAtt[animation.toPlot.row],
          this.maxAtt[animation.toPlot.row],
          rect.height
        )
        const blendedX = previousX * cosine + nextX * sine
        return { x: left + blendedX, y: rect.y + rect.height - y }
      })
      const layerCoordinates = this.buildLayerCoordinates(projectedPoints)
      this.drawLayerPointHighlights(layerCoordinates)
      this.renderer.batchDiscs(
        projectedPoints.map(p => p.coords),
        2.3,
        dotColor
      )
      this.drawQuerySelectionOverlays(layerCoordinates)

      const foldWidth =
        Math.sin(Math.PI / 4 - rotation) * rect.width * Math.SQRT2
      const midX = rect.x + rect.width / 2
      const bottomY = rect.y + rect.height
      this.renderer.lineSegments(
        [
          {
            x1: midX - foldWidth / 2,
            y1: rect.y,
            x2: midX - foldWidth / 2,
            y2: bottomY,
          },
          {
            x1: midX + foldWidth / 2,
            y1: rect.y,
            x2: midX + foldWidth / 2,
            y2: bottomY,
          },
        ],
        strokeColor
      )
    }
  }

  private collectProjectedPoints(
    projectPoint: (point: ScatterplotMatrixPoint) => Point
  ): ProjectedPoint[] {
    return this.points.map(point => ({ point, coords: projectPoint(point) }))
  }

  private buildLayerCoordinates(
    projectedPoints: ProjectedPoint[]
  ): LayerCoordinate[][] {
    const coordinatesByLayer: LayerCoordinate[][] = this.queries.map(() => [])
    for (const projected of projectedPoints) {
      const { point, coords } = projected
      for (const layer of this.queries) {
        if (layer.members.has(point.id)) {
          coordinatesByLayer[layer.index].push({
            id: point.id,
            x: coords.x,
            y: coords.y,
          })
        }
      }
    }
    return coordinatesByLayer
  }

  private drawLayerPointHighlights(
    layerCoordinates: LayerCoordinate[][]
  ): void {
    // One batched draw per layer collapses what would otherwise be one disc
    // per member-per-layer into at most `queries.length` draw calls.
    for (const layer of this.queries) {
      const coords = layerCoordinates[layer.index]
      if (coords.length === 0) {
        continue
      }
      this.renderer.batchDiscs(coords, 5.2, rgba(layer.color, 0.18))
    }
  }

  private drawQuerySelectionOverlays(
    layerCoordinates: LayerCoordinate[][]
  ): void {
    for (const layer of this.queries) {
      const pts = layerCoordinates[layer.index]
      if (pts.length === 0) {
        continue
      }
      const fillColor = rgba(layer.color, 0.12)
      if (pts.length === 1) {
        this.renderer.disc(pts[0].x, pts[0].y, 7, fillColor)
        continue
      }
      if (pts.length === 2) {
        this.renderer.line(
          pts[0].x,
          pts[0].y,
          pts[1].x,
          pts[1].y,
          rgba(layer.color, 0.3)
        )
        continue
      }
      drawQuadStrip(this.renderer, pts, fillColor)
    }
  }

  private drawLensOverlay(lensCandidates: LensCandidate[], rect: Rect): void {
    const candidates = lensCandidates
      .sort((left, right) => left.distance - right.distance)
      .slice(0, MAX_LENS_LABELS)
    const lensX = this.lens.x - LENS_SIZE / 2
    const lensY = this.lens.y - LENS_SIZE / 2
    this.renderer.fillRect(
      lensX,
      lensY,
      LENS_SIZE,
      LENS_SIZE,
      parseColor("rgba(255, 255, 255, 0.35)")
    )
    this.renderer.strokeRect(
      lensX,
      lensY,
      LENS_SIZE,
      LENS_SIZE,
      parseColor("rgba(40, 51, 50, 0.7)")
    )
    const font = `12px ${BODY_FONT_FAMILY}`

    const left: LensCandidate[] = []
    const right: LensCandidate[] = []
    for (const candidate of candidates) {
      if (candidate.x <= this.lens.x) {
        left.push(candidate)
      } else {
        right.push(candidate)
      }
    }

    const leftStartY = clamp(
      this.lens.y - (left.length * 14) / 2,
      rect.y + 16,
      rect.y + rect.height - 18
    )
    const rightStartY = clamp(
      this.lens.y - (right.length * 14) / 2,
      rect.y + 16,
      rect.y + rect.height - 18
    )

    let widestLeft = 0
    for (const candidate of left) {
      widestLeft = Math.max(
        widestLeft,
        this.renderer.measureText(candidate.point.label, font)
      )
    }

    const leftLineColor = parseColor("rgba(212, 108, 47, 0.78)")
    left.forEach((candidate, index) => {
      const labelY = leftStartY + index * 14
      const labelX = rect.x - widestLeft - 34
      this.renderer.line(
        candidate.x,
        candidate.y,
        labelX + widestLeft,
        labelY - 4,
        leftLineColor
      )
      this.renderer.drawText(candidate.point.label, labelX, labelY, {
        font,
        color: "#9f4c24",
      })
    })

    const rightLineColor = parseColor("rgba(11, 110, 98, 0.75)")
    right.forEach((candidate, index) => {
      const labelY = rightStartY + index * 14
      const labelX = rect.x + rect.width + 20
      this.renderer.line(
        candidate.x,
        candidate.y,
        labelX - 6,
        labelY - 4,
        rightLineColor
      )
      this.renderer.drawText(candidate.point.label, labelX, labelY, {
        font,
        color: "#0a665b",
      })
    })
  }

  private drawQueryPanel(layout: DetailLayout): void {
    const panel = layout.queryPanel
    this.renderer.fillRect(
      panel.x,
      panel.y,
      panel.width,
      panel.height,
      parseColor("rgba(255, 255, 255, 0.44)")
    )
    this.renderer.strokeRect(
      panel.x,
      panel.y,
      panel.width,
      panel.height,
      parseColor("rgba(28, 39, 37, 0.18)")
    )
    this.renderer.drawText("Query Layers", panel.x + 12, panel.y + 20, {
      font: `600 14px ${BODY_FONT_FAMILY}`,
      color: "#1f2b28",
    })

    const bodyFont = `12px ${BODY_FONT_FAMILY}`
    const numPoints = Math.max(1, this.points.length)
    this.queries.forEach((layer, index) => {
      const top = panel.y + 32 + index * QUERY_PANEL_ROW_HEIGHT
      const rowFill =
        index === this.selectedQueryIndex
          ? "rgba(11, 110, 98, 0.12)"
          : "rgba(255, 255, 255, 0.12)"
      this.renderer.fillRect(
        panel.x + 10,
        top - 14,
        panel.width - 20,
        22,
        parseColor(rowFill)
      )
      this.renderer.fillRect(
        panel.x + 18,
        top - 9,
        18,
        12,
        rgba(layer.color, index === this.selectedQueryIndex ? 0.78 : 0.08)
      )
      this.renderer.drawText(
        `${layer.label} (${layer.members.size})`,
        panel.x + 46,
        top,
        { font: bodyFont, color: "#243230" }
      )
      const percentage = Math.round((layer.members.size / numPoints) * 100)
      const barMaxWidth = 36
      const barX = panel.x + panel.width - barMaxWidth - 42
      const barHeight = 12
      this.renderer.fillRect(
        barX,
        top - 9,
        barMaxWidth,
        barHeight,
        parseColor("rgba(255, 255, 255, 0.3)")
      )
      this.renderer.strokeRect(
        barX,
        top - 9,
        barMaxWidth,
        barHeight,
        parseColor("rgba(28, 39, 37, 0.18)")
      )
      const barFill = (layer.members.size / numPoints) * barMaxWidth
      if (barFill > 0) {
        this.renderer.fillRect(
          barX,
          top - 9,
          barFill,
          barHeight,
          parseColor("rgba(45, 80, 180, 0.7)")
        )
      }
      this.renderer.drawText(
        `${percentage}%`,
        panel.x + panel.width - 38,
        top,
        {
          font: bodyFont,
          color: "#243230",
        }
      )
    })

    const clearTop = panel.y + panel.height - 24
    this.renderer.fillRect(
      panel.x + 10,
      clearTop - 14,
      panel.width - 20,
      20,
      parseColor("rgba(212, 108, 47, 0.14)")
    )
    this.renderer.drawText("Clear All Queries", panel.x + 18, clearTop, {
      font: bodyFont,
      color: "#a64a18",
    })
  }
}

// ===========================================================================
// WebGL renderer
//
// Immediate-mode 2D renderer over WebGL 2. Two programs (solid colour and
// textured) with VAOs bound once at init, all geometry streamed through a
// pair of DYNAMIC_DRAW buffers. Colours are stored premultiplied; the blend
// func matches so translucent fills composite correctly over each other.
// Text is rasterised on an offscreen 2D canvas and uploaded as a per-string
// texture (LRU-evicted) since WebGL has no native text.
// ===========================================================================

interface TextEntry {
  tex: WebGLTexture
  width: number
  height: number
  textWidth: number
  ascent: number
  padding: number
}

interface AtlasEntry {
  tex: WebGLTexture
  version: string | null
  width: number
  height: number
}

interface DrawTextOptions {
  font?: string
  color?: string
  align?: "left" | "center" | "right"
}

class WebGLRenderer {
  private readonly gl: WebGL2RenderingContext

  private viewportWidth = 1

  private viewportHeight = 1

  // Pixel-space view transform (scale + translate) applied in the vertex
  // shaders so the whole scene can be zoomed and panned.
  private viewScale = 1

  private viewTranslateX = 0

  private viewTranslateY = 0

  private readonly textCanvas: HTMLCanvasElement

  private readonly textCtx: CanvasRenderingContext2D

  private readonly textCache = new Map<string, TextEntry>()

  private readonly textCacheOrder: string[] = []

  private readonly textCacheLimit = 512

  private readonly measureCache = new Map<string, number>()

  private readonly atlasCache = new Map<string, AtlasEntry>()

  private solidProgram!: WebGLProgram

  private texProgram!: WebGLProgram

  private solidVars!: {
    a_position: number
    a_color: number
    u_resolution: WebGLUniformLocation | null
    u_view: WebGLUniformLocation | null
  }

  private texVars!: {
    a_position: number
    a_uv: number
    u_resolution: WebGLUniformLocation | null
    u_view: WebGLUniformLocation | null
    u_texture: WebGLUniformLocation | null
  }

  private solidBuffer!: WebGLBuffer

  private texBuffer!: WebGLBuffer

  private solidVao!: WebGLVertexArrayObject

  private texVao!: WebGLVertexArrayObject

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      premultipliedAlpha: true,
      antialias: true,
      alpha: false,
    })
    if (!gl) {
      throw new Error("WebGL 2 is not supported in this browser.")
    }
    this.gl = gl
    this.textCanvas = document.createElement("canvas")
    const textCtx = this.textCanvas.getContext("2d")
    if (textCtx === null) {
      throw new Error("Could not create a 2D canvas context.")
    }
    this.textCtx = textCtx
    this.initPrograms()

    gl.enable(gl.BLEND)
    gl.blendFuncSeparate(
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA
    )
    gl.disable(gl.DEPTH_TEST)
  }

  private initPrograms(): void {
    const gl = this.gl
    const solidVs = `#version 300 es
      in vec2 a_position;
      in vec4 a_color;
      uniform vec2 u_resolution;
      uniform vec4 u_view;
      out vec4 v_color;
      void main() {
        vec2 pos = a_position * u_view.xy + u_view.zw;
        vec2 clip = (pos / u_resolution) * 2.0 - 1.0;
        gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
        v_color = a_color;
      }
    `
    const solidFs = `#version 300 es
      precision mediump float;
      in vec4 v_color;
      out vec4 outColor;
      void main() {
        outColor = vec4(v_color.rgb * v_color.a, v_color.a);
      }
    `
    this.solidProgram = makeProgram(gl, solidVs, solidFs)
    this.solidVars = {
      a_position: gl.getAttribLocation(this.solidProgram, "a_position"),
      a_color: gl.getAttribLocation(this.solidProgram, "a_color"),
      u_resolution: gl.getUniformLocation(this.solidProgram, "u_resolution"),
      u_view: gl.getUniformLocation(this.solidProgram, "u_view"),
    }

    const texVs = `#version 300 es
      in vec2 a_position;
      in vec2 a_uv;
      uniform vec2 u_resolution;
      uniform vec4 u_view;
      out vec2 v_uv;
      void main() {
        vec2 pos = a_position * u_view.xy + u_view.zw;
        vec2 clip = (pos / u_resolution) * 2.0 - 1.0;
        gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
        v_uv = a_uv;
      }
    `
    const texFs = `#version 300 es
      precision mediump float;
      in vec2 v_uv;
      uniform sampler2D u_texture;
      out vec4 outColor;
      void main() {
        outColor = texture(u_texture, v_uv);
      }
    `
    this.texProgram = makeProgram(gl, texVs, texFs)
    this.texVars = {
      a_position: gl.getAttribLocation(this.texProgram, "a_position"),
      a_uv: gl.getAttribLocation(this.texProgram, "a_uv"),
      u_resolution: gl.getUniformLocation(this.texProgram, "u_resolution"),
      u_view: gl.getUniformLocation(this.texProgram, "u_view"),
      u_texture: gl.getUniformLocation(this.texProgram, "u_texture"),
    }

    this.solidBuffer = gl.createBuffer()
    this.texBuffer = gl.createBuffer()

    const solidStride = 6 * 4
    this.solidVao = gl.createVertexArray()
    gl.bindVertexArray(this.solidVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.solidBuffer)
    gl.enableVertexAttribArray(this.solidVars.a_position)
    gl.vertexAttribPointer(
      this.solidVars.a_position,
      2,
      gl.FLOAT,
      false,
      solidStride,
      0
    )
    gl.enableVertexAttribArray(this.solidVars.a_color)
    gl.vertexAttribPointer(
      this.solidVars.a_color,
      4,
      gl.FLOAT,
      false,
      solidStride,
      8
    )

    const texStride = 4 * 4
    this.texVao = gl.createVertexArray()
    gl.bindVertexArray(this.texVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer)
    gl.enableVertexAttribArray(this.texVars.a_position)
    gl.vertexAttribPointer(
      this.texVars.a_position,
      2,
      gl.FLOAT,
      false,
      texStride,
      0
    )
    gl.enableVertexAttribArray(this.texVars.a_uv)
    gl.vertexAttribPointer(this.texVars.a_uv, 2, gl.FLOAT, false, texStride, 8)

    gl.bindVertexArray(null)
  }

  /**
   * Deletes all GPU resources owned by this renderer. Required because the
   * canvas and its WebGL context outlive the renderer across app reruns.
   */
  dispose(): void {
    const gl = this.gl
    for (const entry of this.textCache.values()) {
      gl.deleteTexture(entry.tex)
    }
    this.textCache.clear()
    this.textCacheOrder.length = 0
    for (const entry of this.atlasCache.values()) {
      gl.deleteTexture(entry.tex)
    }
    this.atlasCache.clear()
    gl.deleteBuffer(this.solidBuffer)
    gl.deleteBuffer(this.texBuffer)
    gl.deleteVertexArray(this.solidVao)
    gl.deleteVertexArray(this.texVao)
    gl.deleteProgram(this.solidProgram)
    gl.deleteProgram(this.texProgram)
  }

  resize(width: number, height: number): void {
    this.viewportWidth = width
    this.viewportHeight = height
    this.gl.viewport(0, 0, width, height)
  }

  setViewTransform(
    scale: number,
    translateX: number,
    translateY: number
  ): void {
    this.viewScale = scale
    this.viewTranslateX = translateX
    this.viewTranslateY = translateY
  }

  beginFrame(backgroundColor: RGBA): void {
    // Every frame starts at identity; the caller opts into a transform
    // after beginFrame.
    this.setViewTransform(1, 0, 0)
    const gl = this.gl
    const [r, g, b, a] = backgroundColor
    gl.clearColor(r * a, g * a, b * a, a)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  private useSolid(): void {
    const gl = this.gl
    gl.useProgram(this.solidProgram)
    gl.uniform2f(
      this.solidVars.u_resolution,
      this.viewportWidth,
      this.viewportHeight
    )
    gl.uniform4f(
      this.solidVars.u_view,
      this.viewScale,
      this.viewScale,
      this.viewTranslateX,
      this.viewTranslateY
    )
  }

  private drawSolid(verts: Float32Array, mode: number): void {
    if (verts.length === 0) {
      return
    }
    const gl = this.gl
    this.useSolid()
    gl.bindVertexArray(this.solidVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.solidBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW)
    gl.drawArrays(mode, 0, verts.length / 6)
    gl.bindVertexArray(null)
  }

  fillRect(x: number, y: number, w: number, h: number, color: RGBA): void {
    const [r, g, b, a] = color
    const verts = new Float32Array([
      x,
      y,
      r,
      g,
      b,
      a,
      x + w,
      y,
      r,
      g,
      b,
      a,
      x,
      y + h,
      r,
      g,
      b,
      a,
      x + w,
      y,
      r,
      g,
      b,
      a,
      x + w,
      y + h,
      r,
      g,
      b,
      a,
      x,
      y + h,
      r,
      g,
      b,
      a,
    ])
    this.drawSolid(verts, this.gl.TRIANGLES)
  }

  strokeRect(x: number, y: number, w: number, h: number, color: RGBA): void {
    const [r, g, b, a] = color
    const verts = new Float32Array([
      x,
      y,
      r,
      g,
      b,
      a,
      x + w,
      y,
      r,
      g,
      b,
      a,
      x + w,
      y,
      r,
      g,
      b,
      a,
      x + w,
      y + h,
      r,
      g,
      b,
      a,
      x + w,
      y + h,
      r,
      g,
      b,
      a,
      x,
      y + h,
      r,
      g,
      b,
      a,
      x,
      y + h,
      r,
      g,
      b,
      a,
      x,
      y,
      r,
      g,
      b,
      a,
    ])
    this.drawSolid(verts, this.gl.LINES)
  }

  line(x1: number, y1: number, x2: number, y2: number, color: RGBA): void {
    const [r, g, b, a] = color
    const verts = new Float32Array([x1, y1, r, g, b, a, x2, y2, r, g, b, a])
    this.drawSolid(verts, this.gl.LINES)
  }

  /**
   * Emits an array of disjoint line segments in a single draw call. Cheap
   * replacement for multiple `line()` calls that share a color.
   */
  lineSegments(
    segments: Array<{ x1: number; y1: number; x2: number; y2: number }>,
    color: RGBA
  ): void {
    const n = segments.length
    if (n === 0) {
      return
    }
    const [r, g, b, a] = color
    const verts = new Float32Array(n * 12)
    let o = 0
    for (let i = 0; i < n; i += 1) {
      const s = segments[i]
      verts[o++] = s.x1
      verts[o++] = s.y1
      verts[o++] = r
      verts[o++] = g
      verts[o++] = b
      verts[o++] = a
      verts[o++] = s.x2
      verts[o++] = s.y2
      verts[o++] = r
      verts[o++] = g
      verts[o++] = b
      verts[o++] = a
    }
    this.drawSolid(verts, this.gl.LINES)
  }

  polyline(points: Point[], color: RGBA, closed = false): void {
    if (points.length < 2) {
      return
    }
    const [r, g, b, a] = color
    const verts: number[] = []
    for (let i = 0; i < points.length - 1; i += 1) {
      verts.push(
        points[i].x,
        points[i].y,
        r,
        g,
        b,
        a,
        points[i + 1].x,
        points[i + 1].y,
        r,
        g,
        b,
        a
      )
    }
    if (closed) {
      const last = points.length - 1
      verts.push(
        points[last].x,
        points[last].y,
        r,
        g,
        b,
        a,
        points[0].x,
        points[0].y,
        r,
        g,
        b,
        a
      )
    }
    this.drawSolid(new Float32Array(verts), this.gl.LINES)
  }

  dashedLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: RGBA,
    dashLen = 5,
    gapLen = 4
  ): void {
    const dx = x2 - x1
    const dy = y2 - y1
    const length = Math.hypot(dx, dy)
    if (length === 0) {
      return
    }
    const ux = dx / length
    const uy = dy / length
    const step = dashLen + gapLen
    const [r, g, b, a] = color
    const verts: number[] = []
    for (let t = 0; t < length; t += step) {
      const end = Math.min(t + dashLen, length)
      verts.push(
        x1 + ux * t,
        y1 + uy * t,
        r,
        g,
        b,
        a,
        x1 + ux * end,
        y1 + uy * end,
        r,
        g,
        b,
        a
      )
    }
    this.drawSolid(new Float32Array(verts), this.gl.LINES)
  }

  disc(
    x: number,
    y: number,
    radius: number,
    color: RGBA,
    segments = 20
  ): void {
    const [r, g, b, a] = color
    const verts: number[] = []
    for (let i = 0; i < segments; i += 1) {
      const a1 = (i / segments) * Math.PI * 2
      const a2 = ((i + 1) / segments) * Math.PI * 2
      verts.push(
        x,
        y,
        r,
        g,
        b,
        a,
        x + Math.cos(a1) * radius,
        y + Math.sin(a1) * radius,
        r,
        g,
        b,
        a,
        x + Math.cos(a2) * radius,
        y + Math.sin(a2) * radius,
        r,
        g,
        b,
        a
      )
    }
    this.drawSolid(new Float32Array(verts), this.gl.TRIANGLES)
  }

  /**
   * Emits one top-left-anchored `size`x`size` square per entry in `points`
   * in a single draw call. Drop-in batched replacement for thousands of
   * tiny fillRect calls (e.g. matrix scatter dots).
   */
  batchFillRects(points: Point[], size: number, color: RGBA): void {
    const n = points.length
    if (n === 0) {
      return
    }
    const [r, g, b, a] = color
    const verts = new Float32Array(n * 36)
    let o = 0
    for (let i = 0; i < n; i += 1) {
      const p = points[i]
      const x0 = p.x
      const y0 = p.y
      const x1 = x0 + size
      const y1 = y0 + size
      verts[o++] = x0
      verts[o++] = y0
      verts[o++] = r
      verts[o++] = g
      verts[o++] = b
      verts[o++] = a
      verts[o++] = x1
      verts[o++] = y0
      verts[o++] = r
      verts[o++] = g
      verts[o++] = b
      verts[o++] = a
      verts[o++] = x0
      verts[o++] = y1
      verts[o++] = r
      verts[o++] = g
      verts[o++] = b
      verts[o++] = a
      verts[o++] = x1
      verts[o++] = y0
      verts[o++] = r
      verts[o++] = g
      verts[o++] = b
      verts[o++] = a
      verts[o++] = x1
      verts[o++] = y1
      verts[o++] = r
      verts[o++] = g
      verts[o++] = b
      verts[o++] = a
      verts[o++] = x0
      verts[o++] = y1
      verts[o++] = r
      verts[o++] = g
      verts[o++] = b
      verts[o++] = a
    }
    this.drawSolid(verts, this.gl.TRIANGLES)
  }

  /**
   * Emits one triangle-fan disc per center in a single draw call. The unit
   * circle is precomputed once per call so the inner loop is branch-free.
   */
  batchDiscs(
    centers: Point[],
    radius: number,
    color: RGBA,
    segments = 20
  ): void {
    const n = centers.length
    if (n === 0) {
      return
    }
    const [r, g, b, a] = color
    const cos = new Float32Array(segments)
    const sin = new Float32Array(segments)
    for (let s = 0; s < segments; s += 1) {
      const angle = (s / segments) * Math.PI * 2
      cos[s] = Math.cos(angle)
      sin[s] = Math.sin(angle)
    }
    const verts = new Float32Array(n * segments * 18)
    let o = 0
    for (let i = 0; i < n; i += 1) {
      const cx = centers[i].x
      const cy = centers[i].y
      for (let s = 0; s < segments; s += 1) {
        const s2 = (s + 1) % segments
        verts[o++] = cx
        verts[o++] = cy
        verts[o++] = r
        verts[o++] = g
        verts[o++] = b
        verts[o++] = a
        verts[o++] = cx + cos[s] * radius
        verts[o++] = cy + sin[s] * radius
        verts[o++] = r
        verts[o++] = g
        verts[o++] = b
        verts[o++] = a
        verts[o++] = cx + cos[s2] * radius
        verts[o++] = cy + sin[s2] * radius
        verts[o++] = r
        verts[o++] = g
        verts[o++] = b
        verts[o++] = a
      }
    }
    this.drawSolid(verts, this.gl.TRIANGLES)
  }

  polygonFromTriangulation(
    points: Point[],
    triangles: number[][],
    color: RGBA
  ): void {
    if (triangles.length === 0) {
      return
    }
    const [r, g, b, a] = color
    const verts = new Float32Array(triangles.length * 3 * 6)
    let offset = 0
    for (const tri of triangles) {
      for (const idx of tri) {
        const p = points[idx]
        verts[offset] = p.x
        verts[offset + 1] = p.y
        verts[offset + 2] = r
        verts[offset + 3] = g
        verts[offset + 4] = b
        verts[offset + 5] = a
        offset += 6
      }
    }
    this.drawSolid(verts, this.gl.TRIANGLES)
  }

  measureText(text: string, font: string): number {
    // Cache measurements — the 2D context's measureText / font-state setup
    // isn't free and this method is called in tight per-frame loops.
    const key = `${font}|${text}`
    const cached = this.measureCache.get(key)
    if (cached !== undefined) {
      return cached
    }
    this.textCtx.font = font
    const width = this.textCtx.measureText(text).width
    this.measureCache.set(key, width)
    return width
  }

  /**
   * Uploads or refreshes a named atlas texture from an offscreen canvas and
   * blits it as a single textured quad at viewport-space (x, y). Callers
   * pass a stable `key` plus a `version` string; if the version matches the
   * cached one the canvas upload is skipped and only the draw happens.
   */
  blitCanvasAtlas(
    key: string,
    version: string,
    canvas: HTMLCanvasElement,
    x: number,
    y: number
  ): void {
    const gl = this.gl
    let entry = this.atlasCache.get(key)
    if (entry === undefined) {
      entry = {
        tex: gl.createTexture(),
        version: null,
        width: 0,
        height: 0,
      }
      this.atlasCache.set(key, entry)
    }
    if (
      entry.version !== version ||
      entry.width !== canvas.width ||
      entry.height !== canvas.height
    ) {
      gl.bindTexture(gl.TEXTURE_2D, entry.tex)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        canvas
      )
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      entry.version = version
      entry.width = canvas.width
      entry.height = canvas.height
    }
    const w = entry.width
    const h = entry.height
    const verts = new Float32Array([
      x,
      y,
      0,
      0,
      x + w,
      y,
      1,
      0,
      x,
      y + h,
      0,
      1,
      x + w,
      y,
      1,
      0,
      x + w,
      y + h,
      1,
      1,
      x,
      y + h,
      0,
      1,
    ])
    this.drawTextured(entry.tex, verts)
  }

  private getTextEntry(text: string, font: string, color: string): TextEntry {
    const key = `${text}|${font}|${color}`
    const existing = this.textCache.get(key)
    if (existing !== undefined) {
      return existing
    }
    const ctx = this.textCtx
    ctx.font = font
    const metrics = ctx.measureText(text)
    const ascent = metrics.actualBoundingBoxAscent || 10
    const descent = metrics.actualBoundingBoxDescent || 4
    const textWidth = metrics.width
    const padding = 2
    const w = Math.max(1, Math.ceil(textWidth) + padding * 2)
    const h = Math.max(1, Math.ceil(ascent + descent) + padding * 2)
    this.textCanvas.width = w
    this.textCanvas.height = h
    ctx.clearRect(0, 0, w, h)
    ctx.font = font
    ctx.textBaseline = "alphabetic"
    ctx.fillStyle = color
    ctx.fillText(text, padding, ascent + padding)
    const gl = this.gl
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.textCanvas
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const entry: TextEntry = {
      tex,
      width: w,
      height: h,
      textWidth,
      ascent,
      padding,
    }
    this.textCache.set(key, entry)
    this.textCacheOrder.push(key)
    if (this.textCacheOrder.length > this.textCacheLimit) {
      const evictKey = this.textCacheOrder.shift()
      if (evictKey !== undefined) {
        const evicted = this.textCache.get(evictKey)
        if (evicted) {
          gl.deleteTexture(evicted.tex)
          this.textCache.delete(evictKey)
        }
      }
    }
    return entry
  }

  drawText(
    text: string,
    x: number,
    y: number,
    options: DrawTextOptions = {}
  ): void {
    if (text === "") {
      return
    }
    const font = options.font || "12px sans-serif"
    const color = options.color || "#000"
    const align = options.align || "left"
    const entry = this.getTextEntry(String(text), font, color)

    let originX = -entry.padding
    if (align === "center") {
      originX = -entry.textWidth / 2 - entry.padding
    } else if (align === "right") {
      originX = -entry.textWidth - entry.padding
    }
    const originY = -entry.ascent - entry.padding

    const w = entry.width
    const h = entry.height
    const x0 = x + originX
    const y0 = y + originY
    const verts = new Float32Array([
      x0,
      y0,
      0,
      0,
      x0 + w,
      y0,
      1,
      0,
      x0,
      y0 + h,
      0,
      1,
      x0 + w,
      y0,
      1,
      0,
      x0 + w,
      y0 + h,
      1,
      1,
      x0,
      y0 + h,
      0,
      1,
    ])
    this.drawTextured(entry.tex, verts)
  }

  private drawTextured(tex: WebGLTexture, verts: Float32Array): void {
    const gl = this.gl
    gl.useProgram(this.texProgram)
    gl.uniform2f(
      this.texVars.u_resolution,
      this.viewportWidth,
      this.viewportHeight
    )
    gl.uniform4f(
      this.texVars.u_view,
      this.viewScale,
      this.viewScale,
      this.viewTranslateX,
      this.viewTranslateY
    )
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.uniform1i(this.texVars.u_texture, 0)
    gl.bindVertexArray(this.texVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.bindVertexArray(null)
  }
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type)
  if (shader === null) {
    throw new Error("Could not create a WebGL shader.")
  }
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compile error: ${info}`)
  }
  return shader
}

function makeProgram(
  gl: WebGL2RenderingContext,
  vs: string,
  fs: string
): WebGLProgram {
  const vsShader = compileShader(gl, gl.VERTEX_SHADER, vs)
  const fsShader = compileShader(gl, gl.FRAGMENT_SHADER, fs)
  const program = gl.createProgram()
  if (program === null) {
    throw new Error("Could not create a WebGL program.")
  }
  gl.attachShader(program, vsShader)
  gl.attachShader(program, fsShader)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Program link error: ${info}`)
  }
  return program
}

// ===========================================================================
// Color and geometry utilities
// ===========================================================================

const colorCache = new Map<string, RGBA>()

let colorParseCtx: CanvasRenderingContext2D | null = null

function getColorParseCtx(): CanvasRenderingContext2D | null {
  if (colorParseCtx === null && typeof document !== "undefined") {
    const canvas = document.createElement("canvas")
    canvas.width = 1
    canvas.height = 1
    colorParseCtx = canvas.getContext("2d")
  }
  return colorParseCtx
}

function parseColor(value: string): RGBA {
  const cached = colorCache.get(value)
  if (cached !== undefined) {
    return cached
  }
  let result: RGBA
  const ctx = getColorParseCtx()
  if (ctx) {
    ctx.fillStyle = "#000"
    ctx.fillStyle = value
    const normalized = ctx.fillStyle
    if (normalized.startsWith("#")) {
      const [r, g, b] = hexToRgb(normalized)
      result = [r / 255, g / 255, b / 255, 1]
    } else {
      const parts = (normalized.match(/[\d.]+/g) ?? ["0", "0", "0"]).map(
        Number
      )
      result = [
        parts[0] / 255,
        parts[1] / 255,
        parts[2] / 255,
        parts.length > 3 ? parts[3] : 1,
      ]
    }
  } else {
    result = [0, 0, 0, 1]
  }
  colorCache.set(value, result)
  return result
}

function rgba(value: string, alpha: number): RGBA {
  const [r, g, b] = parseColor(value)
  return [r, g, b, alpha]
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "")
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map(character => character + character)
          .join("")
      : normalized
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

function getMatrixCellRect(
  layout: DetailLayout,
  col: number,
  row: number
): Rect {
  return {
    x: layout.matrixX + col * (layout.cellSize + layout.gap),
    y: layout.matrixY + row * (layout.cellSize + layout.gap),
    width: layout.cellSize,
    height: layout.cellSize,
  }
}

function getMatrixCellCenter(
  layout: DetailLayout,
  col: number,
  row: number
): Point {
  const rect = getMatrixCellRect(layout, col, row)
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

function projectPointToRect(
  xValue: number,
  xMin: number,
  xMax: number,
  yValue: number,
  yMin: number,
  yMax: number,
  rect: Rect
): Point {
  const xRange = xMax - xMin
  const yRange = yMax - yMin
  const x =
    rect.x +
    (xRange === 0 ? rect.width / 2 : ((xValue - xMin) / xRange) * rect.width)
  const y =
    rect.y +
    rect.height -
    (yRange === 0 ? rect.height / 2 : ((yValue - yMin) / yRange) * rect.height)
  return { x, y }
}

function drawQuadStrip(
  renderer: WebGLRenderer,
  pts: Point[],
  fillColor: RGBA
): void {
  const triangles: number[][] = []
  for (let i = 0; i + 3 < pts.length; i += 2) {
    triangles.push([i, i + 1, i + 3])
    triangles.push([i, i + 3, i + 2])
  }
  if (pts.length >= 4) {
    const last = pts.length % 2 === 0 ? pts.length : pts.length - 1
    triangles.push([last - 2, last - 1, 1])
    triangles.push([last - 2, 1, 0])
  }
  renderer.polygonFromTriangulation(pts, triangles, fillColor)
}

/**
 * Filters a restored query layer's point ids down to those still present in
 * the current dataset (e.g. after a row was excluded for having a
 * non-finite value in a matrix dimension), and reports whether anything was
 * dropped so the caller can push the reconciled selection back to Python
 * instead of leaving stale ids in the widget state.
 */
export function reconcileSelectionIds(
  restoredIds: number[],
  pointIds: ReadonlySet<number>
): { keptIds: number[]; wasReconciled: boolean } {
  const keptIds = restoredIds.filter(id => pointIds.has(id))
  return { keptIds, wasReconciled: keptIds.length !== restoredIds.length }
}

export function buildNavigationSteps(
  fromPlot: PlotCoords,
  toPlot: PlotCoords
): RollStep[] {
  const steps: RollStep[] = []
  let column = fromPlot.col
  let row = fromPlot.row
  const moveRowsFirst =
    Math.abs(column - toPlot.col) > Math.abs(toPlot.row - row)

  const addColumnSteps = (): void => {
    while (column !== toPlot.col) {
      column += Math.sign(toPlot.col - column)
      steps.push({ col: column, row, axis: "x" })
    }
  }

  const addRowSteps = (): void => {
    while (row !== toPlot.row) {
      row += Math.sign(toPlot.row - row)
      steps.push({ col: column, row, axis: "y" })
    }
  }

  if (moveRowsFirst) {
    addRowSteps()
    addColumnSteps()
  } else {
    addColumnSteps()
    addRowSteps()
  }
  return steps
}

export function pointInPolygon(
  x: number,
  y: number,
  polygon: Point[]
): boolean {
  let inside = false
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index, index += 1
  ) {
    const xi = polygon[index].x
    const yi = polygon[index].y
    const xj = polygon[previous].x
    const yj = polygon[previous].y
    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi
    if (intersects) {
      inside = !inside
    }
  }
  return inside
}

function pointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}

function samePlot(left: PlotCoords, right: PlotCoords): boolean {
  return left.col === right.col && left.row === right.row
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function distanceBetween(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.hypot(x2 - x1, y2 - y1)
}
