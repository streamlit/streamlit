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

import {
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { Block as BlockProto, streamlit } from "@streamlit/protobuf"

import {
  type AppNode,
  BlockNode,
  ElementNode,
  TransientNode,
} from "~lib/AppNode"
import {
  FlexContext,
  FlexContextProvider,
} from "~lib/components/core/Layout/FlexContext"
import { Direction } from "~lib/components/core/Layout/utils"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import {
  type DOMRectKeys,
  useResizeObserver,
} from "~lib/hooks/useResizeObserver"
import { convertRemToPx } from "~lib/theme/utils"
import {
  getElementId,
  isNullOrUndefined,
  notNullOrUndefined,
} from "~lib/util/utils"

import {
  clampColumnSpan,
  cssLengthToPx,
  gridTracksMinWidthPx,
  resolveDefaultGridContentBoxPx,
  resolveGridColumnCount,
  resolveMinColumnWidthPx,
  shouldEnableOverflowScroll,
  shouldScrollHorizontally,
} from "./gridUtils"
import { RenderNodeVisitor } from "./RenderNodeVisitor"
import {
  gridCellJustifyContent,
  StyledGridCell,
  StyledGridCellBody,
  StyledGridCellContent,
  StyledGridContainerBlock,
  StyledGridContentMeasure,
  StyledGridScrollBody,
  translateGapWidth,
} from "./styled-components"
import {
  assignDividerColor,
  type BaseBlockProps,
  convertKeyToClassName,
  getKeyFromId,
} from "./utils"

interface GridContainerProps extends BaseBlockProps {
  node: BlockNode
}

const GRID_OBSERVED_PROPERTIES: DOMRectKeys[] = ["width"]
const HEIGHT_OBSERVED_PROPERTIES: DOMRectKeys[] = ["height"]
const PORT_OBSERVED_PROPERTIES: DOMRectKeys[] = ["height", "width"]

interface GridCellProps {
  hasFixedRowHeight: boolean
  verticalAlignment: BlockProto.GridContainer.VerticalAlignment
  showBorder: boolean
  columnSpan?: number
  columnSpanAll: boolean
  rowSpan?: number
  children: ReactNode
}

/**
 * One observer for the cell body and its content. The hook updates state
 * only when the scroll decision changes, so a resize that stays on the same
 * side of the row height does not re-render the cell.
 */
function useCellOverflowScroll(
  active: boolean,
  bodyRef: { readonly current: HTMLDivElement | null },
  contentRef: { readonly current: HTMLDivElement | null }
): boolean {
  const [scroll, setScroll] = useState(false)
  const scrollRef = useRef(false)
  useLayoutEffect(() => {
    const publish = (next: boolean): void => {
      if (scrollRef.current === next) {
        return
      }
      scrollRef.current = next
      setScroll(next)
    }
    const body = bodyRef.current
    const content = contentRef.current
    if (!active || !body || !content) {
      publish(false)
      return
    }

    const update = (): void => {
      // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Height is needed to decide overflow.
      const contentHeight = content.getBoundingClientRect().height
      // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Height is needed to decide overflow.
      const bodyHeight = body.getBoundingClientRect().height
      publish(shouldEnableOverflowScroll(contentHeight, bodyHeight))
    }
    update()

    let frameId = 0
    const observer = new ResizeObserver(() => {
      if (frameId) {
        cancelAnimationFrame(frameId)
      }
      frameId = window.requestAnimationFrame(update)
    })
    observer.observe(body)
    observer.observe(content)
    return () => {
      observer.disconnect()
      if (frameId) {
        cancelAnimationFrame(frameId)
      }
    }
  }, [active, bodyRef, contentRef])
  return scroll
}

/**
 * One CSS Grid item. The cell itself never becomes a scrollport: hover
 * toolbars sit `position: absolute` above charts and would be clipped even
 * when in-flow content fits. The inner body stays mounted in both row-height
 * modes so toggling `row_height` does not remount cell contents. Content
 * rows use `display: contents` on that body. Definite-height rows fill the
 * cell and switch to `overflow: auto` only if in-flow content exceeds it.
 */
const GridCell = ({
  hasFixedRowHeight,
  verticalAlignment,
  showBorder,
  columnSpan,
  columnSpanAll,
  rowSpan,
  children,
}: GridCellProps): ReactElement => {
  const bodyRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const scroll = useCellOverflowScroll(hasFixedRowHeight, bodyRef, contentRef)

  return (
    <StyledGridCell
      verticalAlignment={verticalAlignment}
      $showBorder={showBorder}
      className="stGridCell"
      data-testid="stGridCell"
      $columnSpan={columnSpan}
      $columnSpanAll={columnSpanAll}
      $rowSpan={rowSpan}
    >
      <StyledGridCellBody
        ref={hasFixedRowHeight ? bodyRef : undefined}
        $scroll={scroll}
        $passthrough={!hasFixedRowHeight}
        data-testid="stGridCellBody"
        data-test-scroll={String(scroll)}
      >
        <StyledGridCellContent
          ref={hasFixedRowHeight ? contentRef : undefined}
          verticalAlignment={verticalAlignment}
          $passthrough={!hasFixedRowHeight}
          data-testid="stGridCellContent"
        >
          {children}
        </StyledGridCellContent>
      </StyledGridCellBody>
    </StyledGridCell>
  )
}

/**
 * Scroll container for a pixel- or rem-height grid. It scrolls vertically
 * only when the rows overflow, and horizontally when `wrap=False` tracks
 * overflow. For content and stretch heights it renders as
 * `display: contents`, so the grid stays mounted when `height` changes.
 */
const GridScrollport = ({
  bounded,
  wrap,
  horizontalScroll,
  trackMinWidthPx,
  onPortWidthPx,
  children,
}: {
  bounded: boolean
  wrap: boolean
  horizontalScroll: boolean
  trackMinWidthPx?: number
  onPortWidthPx?: (widthPx: number) => void
  children: ReactNode
}): ReactElement => {
  const { values: portSize, elementRef: portRef } =
    useResizeObserver<HTMLDivElement>(PORT_OBSERVED_PROPERTIES, [bounded])
  const { values: contentHeights, elementRef: contentRef } =
    useResizeObserver<HTMLDivElement>(HEIGHT_OBSERVED_PROPERTIES, [bounded])
  const observedPortHeight = portSize[0] ?? 0
  const observedPortWidth = portSize[1] ?? 0
  // A classic horizontal scrollbar also sits inside the border box. Tracks
  // that fit that box but not the height above the scrollbar would be cut
  // off by the cross-axis `overflow-y: hidden`, with nothing to scroll, so
  // the vertical decision subtracts the scrollbar. Remeasure when the port
  // resizes too: a grid first laid out hidden (inactive tab, collapsed
  // expander) reads 0 until it is shown.
  const [horizontalScrollbarPx, setHorizontalScrollbarPx] = useState(0)
  useLayoutEffect(() => {
    const element = portRef.current
    if (!bounded || !horizontalScroll || !element) {
      setHorizontalScrollbarPx(0)
      return
    }
    // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Needed before the first paint so the last row is not clipped.
    setHorizontalScrollbarPx(element.offsetHeight - element.clientHeight)
  }, [
    bounded,
    horizontalScroll,
    observedPortHeight,
    observedPortWidth,
    portRef,
  ])
  const scroll =
    bounded &&
    shouldEnableOverflowScroll(
      contentHeights[0] ?? 0,
      observedPortHeight - horizontalScrollbarPx
    )
  // The grid inside this port grows to the track floor once horizontal
  // scrolling is on. Report the port's client width, not that grid and not
  // the border box: a classic vertical scrollbar sits inside the border box
  // and would otherwise leave the tracks looking like they fit. Remeasure
  // when vertical scrolling toggles, because that gutter does not change
  // the border box the resize observer reports.
  useLayoutEffect(() => {
    if (!onPortWidthPx) {
      return
    }
    if (!bounded) {
      onPortWidthPx(0)
      return
    }
    const element = portRef.current
    if (!element) {
      return
    }
    // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Width is needed before the first paint.
    onPortWidthPx(element.clientWidth)
  }, [bounded, observedPortWidth, scroll, onPortWidthPx, portRef])

  return (
    <StyledGridScrollBody
      ref={bounded ? portRef : undefined}
      $scroll={scroll}
      $horizontalScroll={horizontalScroll}
      $bounded={bounded}
      data-testid="stGridScrollBody"
      data-test-scroll={String(scroll)}
    >
      <StyledGridContentMeasure
        ref={bounded ? contentRef : undefined}
        $passthrough={!bounded}
        $minWidthPx={!bounded || wrap ? undefined : trackMinWidthPx}
        data-testid="stGridContentMeasure"
      >
        {children}
      </StyledGridContentMeasure>
    </StyledGridScrollBody>
  )
}

/**
 * Direct children of a layout-transparent wrapper become grid cells.
 *
 * A fragment that writes into a grid does so through one transparent block.
 * That block has no DOM node, so each of its children is a cell. `grid.cell()`
 * inside the fragment stays one cell. Nested transparent wrappers flatten too.
 */
function collectGridCellSources(
  nodes: AppNode[],
  keyPrefix = ""
): { node: AppNode; sourceKey: string }[] {
  return nodes.flatMap((node, index) => {
    const sourceKey = keyPrefix === "" ? `${index}` : `${keyPrefix}.${index}`
    if (
      node instanceof BlockNode &&
      node.deltaBlock.transparent &&
      !node.deltaBlock.gridCell
    ) {
      return collectGridCellSources(node.children, sourceKey)
    }
    return [{ node, sourceKey }]
  })
}

/**
 * Renders a CSS Grid container with its children wrapped in grid cells.
 */
export const GridContainer = (props: GridContainerProps): ReactElement => {
  const {
    node,
    widgetsDisabled,
    disableFullscreenMode,
    endpoints,
    widgetMgr,
    uploadClient,
    componentRegistry,
  } = props

  const theme = useEmotionTheme()
  // assignDividerColor walks every child and mutates heading colors in
  // place. Memoize that walk so width-driven re-renders do not repeat it.
  const gridNode = useMemo(() => {
    assignDividerColor(node, theme)
    return node
  }, [node, theme])

  const parentContext = useContext(FlexContext)
  const gridConfig = gridNode.deltaBlock.gridContainer

  const userKey = getKeyFromId(node.deltaBlock.id)
  const heightConfig = node.deltaBlock.heightConfig
  // Pixel and rem heights are scrollports. Stretch matches st.container: the
  // grid fills a bounded parent and grows with its content.
  const gridHasBoundedHeight =
    (heightConfig?.pixelHeight ?? 0) > 0 || (heightConfig?.remHeight ?? 0) > 0

  const { values: observedWidths, elementRef } =
    useResizeObserver<HTMLDivElement>(GRID_OBSERVED_PROPERTIES, [
      gridHasBoundedHeight,
    ])
  // Bounded wrap=False grows the grid to its track floor. The scrollport
  // border box stays the layout slot, so horizontal scrolling is decided
  // from this width instead of the grid's.
  const [scrollportWidthPx, setScrollportWidthPx] = useState(0)
  const handlePortWidthPx = useCallback((widthPx: number) => {
    setScrollportWidthPx(current =>
      Math.abs(current - widthPx) < 0.5 ? current : widthPx
    )
  }, [])
  const observedWidth = observedWidths.at(0)
  // The resize observer reports after paint, so a nested grid (sidebar,
  // column) would flash the 704px fallback for a frame. Read the laid-out
  // width before paint. A width of 0 is jsdom or a hidden tab.
  const [layoutWidthPx, setLayoutWidthPx] = useState<number | undefined>()
  useLayoutEffect(() => {
    const element = elementRef.current
    if (!element) {
      return
    }
    // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Width is needed before the first paint.
    const width = element.getBoundingClientRect().width
    if (width > 0) {
      setLayoutWidthPx(previous =>
        previous !== undefined && Math.abs(previous - width) < 0.5
          ? previous
          : width
      )
    }
    // elementRef is stable. Re-measure when the grid gains or loses a
    // bounded height, which changes the box this width is read from.
    // Later resizes come from the resize observer.
  }, [elementRef, gridHasBoundedHeight])
  const measuredWidth =
    observedWidth !== undefined && observedWidth > 0
      ? observedWidth
      : layoutWidthPx

  // Extract grid configuration with defaults
  // Absent optional fields mean columns="auto" and min_column_width="auto".
  const columns =
    notNullOrUndefined(gridConfig?.columns) && gridConfig.columns > 0
      ? gridConfig.columns
      : undefined
  const rawMinColumnWidthPx =
    notNullOrUndefined(gridConfig?.minColumnWidthPx) &&
    gridConfig.minColumnWidthPx > 0
      ? gridConfig.minColumnWidthPx
      : undefined
  const rowGap = gridConfig?.rowGapConfig ?? {
    gapSize: streamlit.GapSize.SMALL,
  }
  const columnGap = gridConfig?.columnGapConfig ?? {
    gapSize: streamlit.GapSize.SMALL,
  }
  const verticalAlignment =
    gridConfig?.verticalAlignment ??
    BlockProto.GridContainer.VerticalAlignment.TOP
  const showCellBorder = gridConfig?.border ?? false
  const rowHeightMode =
    gridConfig?.rowHeightMode ?? BlockProto.GridContainer.RowHeightMode.CONTENT
  const rowHeightPx = gridConfig?.rowHeightConfig?.pixelHeight ?? undefined
  const dense = gridConfig?.dense ?? false
  const wrap = gridConfig?.wrap ?? true

  const minColumnWidthPx = resolveMinColumnWidthPx({
    minColumnWidthPx: rawMinColumnWidthPx,
    autoMinColumnWidthPx: convertRemToPx(
      theme.sizes.gridMinColumnWidth,
      theme.fontSizes.baseFontSize
    ),
  })
  const columnGapPx = cssLengthToPx(
    translateGapWidth(columnGap, theme),
    theme.fontSizes.baseFontSize
  )
  const pixelWidth = node.deltaBlock.widthConfig?.pixelWidth
  // Unmeasured first paint uses the padded content box (704px at a 16px
  // root), not raw contentMaxWidth, so the column count matches the width
  // the resize observer will report.
  const fallbackWidthPx =
    (notNullOrUndefined(pixelWidth) && pixelWidth > 0
      ? pixelWidth
      : undefined) ??
    parentContext?.parentWidth ??
    resolveDefaultGridContentBoxPx({
      contentMaxWidthPx: cssLengthToPx(
        theme.sizes.contentMaxWidth,
        theme.fontSizes.baseFontSize
      ),
      horizontalPaddingPx: cssLengthToPx(
        theme.spacing.lg,
        theme.fontSizes.baseFontSize
      ),
    })
  const columnCount = resolveGridColumnCount({
    availableWidthPx: measuredWidth,
    minColumnWidthPx,
    columnGapPx,
    columns,
    wrap,
    fallbackWidthPx,
  })

  // Collect child elements and their grid cell configurations.
  // Use individual props as dependencies instead of the props object
  // to ensure stable memoization (widgetMgr etc. are stable singletons).
  // Do not depend on columnCount here: clamp spans when wrapping so a
  // wrap-driven N change does not re-run RenderNodeVisitor.
  const childrenWithCells = useMemo(() => {
    const visitor = new RenderNodeVisitor({
      node,
      widgetsDisabled,
      disableFullscreenMode,
      endpoints,
      widgetMgr,
      uploadClient,
      componentRegistry,
    })

    return collectGridCellSources(node.children).flatMap(
      ({ node: childNode, sourceKey }) => {
        // An empty block that does not allow empty renders nothing in other
        // layouts, so it gets no cell either. `grid.cell()` allows empty and
        // keeps the cell it reserves.
        if (
          childNode instanceof BlockNode &&
          childNode.isEmpty &&
          !childNode.deltaBlock.allowEmpty
        ) {
          return []
        }

        // A spinner wraps the anchor in a TransientNode, which has no id of
        // its own. Key and span come from the anchor so the cell stays
        // mounted when the spinner appears or clears.
        let columnSpan: number | undefined
        let columnSpanAll = false
        let rowSpan: number | undefined
        let nodeId: string | undefined
        const layoutNode =
          childNode instanceof TransientNode ? childNode.anchor : childNode

        if (layoutNode instanceof BlockNode) {
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- blank block id means unset
          nodeId = layoutNode.deltaBlock.id || undefined
          if (layoutNode.deltaBlock.gridCell) {
            const gridCell = layoutNode.deltaBlock.gridCell
            if (gridCell.columnSpanAll === true) {
              columnSpanAll = true
            } else if (gridCell.columnSpan && gridCell.columnSpan > 1) {
              columnSpan = gridCell.columnSpan
            }
            if (gridCell.rowSpan && gridCell.rowSpan > 1) {
              rowSpan = gridCell.rowSpan
            }
          }
        } else if (layoutNode instanceof ElementNode) {
          nodeId = getElementId(layoutNode.element)
        }

        // Render the child element using the return value from accept()
        // instead of indexing into reactElements, since the visitor may
        // push 0, 1, or multiple elements per node (e.g., transient nodes).
        const childElement = childNode.accept(visitor)
        // Transient nodes (e.g. a cleared spinner) can return [] — that is not
        // null, but it must not become an empty bordered grid cell.
        if (
          isNullOrUndefined(childElement) ||
          (Array.isArray(childElement) && childElement.length === 0)
        ) {
          return []
        }

        return [
          {
            element: childElement,
            nodeId,
            sourceKey,
            columnSpan,
            columnSpanAll,
            rowSpan,
          },
        ]
      }
    )
  }, [
    node,
    widgetsDisabled,
    disableFullscreenMode,
    endpoints,
    widgetMgr,
    uploadClient,
    componentRegistry,
  ])

  const hasFixedRowHeight =
    rowHeightMode === BlockProto.GridContainer.RowHeightMode.FIXED

  // With wrap=False, tracks never shrink below `tracksMinWidthPx`, so the
  // grid scrolls horizontally once that floor is wider than the available
  // width. That scrollport clips the cross axis, so toolbar padding on the
  // grid keeps hover chrome inside the clip.
  // - Unbounded grids scroll on the grid itself and never apply the floor,
  //   so they compare against their own width.
  // - Bounded grids scroll on the port and compare against the port's
  //   client width, which also excludes a classic vertical scrollbar. Their
  //   own width grows with the floor and would toggle scrolling in a loop.
  const tracksMinWidthPx = gridTracksMinWidthPx(
    columnCount,
    minColumnWidthPx,
    columnGapPx
  )
  const horizontalScrollAvailableWidthPx = gridHasBoundedHeight
    ? scrollportWidthPx > 0
      ? scrollportWidthPx
      : fallbackWidthPx
    : measuredWidth !== undefined && measuredWidth > 0
      ? measuredWidth
      : fallbackWidthPx
  const horizontalScroll = shouldScrollHorizontally(
    wrap,
    tracksMinWidthPx,
    horizontalScrollAvailableWidthPx
  )
  const boundedScrollMinWidthPx =
    gridHasBoundedHeight && horizontalScroll ? tracksMinWidthPx : undefined

  // Wrap each child in a grid cell with span information.
  // Use nodeId for stable React keys so width-driven template updates do not
  // remount cells. Fall back to the source path so filtering a duplicate
  // widget does not shift later cell() keys.
  const wrappedChildren = useMemo(
    () =>
      childrenWithCells.map(child => (
        <GridCell
          key={child.nodeId ?? `grid-child-${child.sourceKey}`}
          hasFixedRowHeight={hasFixedRowHeight}
          verticalAlignment={verticalAlignment}
          showBorder={showCellBorder}
          columnSpan={
            child.columnSpanAll || !child.columnSpan
              ? undefined
              : clampColumnSpan(child.columnSpan, columnCount)
          }
          columnSpanAll={child.columnSpanAll}
          rowSpan={child.rowSpan}
        >
          <FlexContextProvider
            direction={Direction.VERTICAL}
            isDirectlyInColumn
            fillAvailableHeight={hasFixedRowHeight}
            fillJustify={
              hasFixedRowHeight
                ? gridCellJustifyContent(verticalAlignment)
                : undefined
            }
            // Direct children of a fixed-height cell (not wrapped in
            // grid.cell()) still need a definite height so stretch charts
            // fill the track instead of falling back to their default size.
            hasFixedHeight={hasFixedRowHeight}
            parentContext={parentContext}
          >
            {child.element}
          </FlexContextProvider>
        </GridCell>
      )),
    [
      childrenWithCells,
      columnCount,
      verticalAlignment,
      showCellBorder,
      hasFixedRowHeight,
      parentContext,
    ]
  )

  // Always render the port so switching height does not remount the grid.
  // Content and stretch heights style the port as `display: contents`.
  return (
    <GridScrollport
      bounded={gridHasBoundedHeight}
      wrap={wrap}
      horizontalScroll={horizontalScroll}
      trackMinWidthPx={boundedScrollMinWidthPx}
      onPortWidthPx={handlePortWidthPx}
    >
      <StyledGridContainerBlock
        ref={elementRef}
        columnCount={columnCount}
        minColumnWidthPx={minColumnWidthPx}
        $wrap={wrap}
        $horizontalScroll={!gridHasBoundedHeight && horizontalScroll}
        $overlayClearance={horizontalScroll}
        rowGap={rowGap}
        columnGap={columnGap}
        rowHeightMode={rowHeightMode}
        rowHeightPx={rowHeightPx}
        $dense={dense}
        className={["stGrid", convertKeyToClassName(userKey)]
          .filter(Boolean)
          .join(" ")}
        data-testid="stGrid"
        data-test-column-count={columnCount}
        data-test-wrap={String(wrap)}
      >
        {wrappedChildren}
      </StyledGridContainerBlock>
    </GridScrollport>
  )
}
