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
  type JSX,
  type ReactElement,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useMemo,
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
  type IFlexContext,
} from "~lib/components/core/Layout/FlexContext"
import { STEP_BLOCK_ATTRIBUTE } from "~lib/components/core/Layout/stepConnector"
import {
  extractLayoutSubElement,
  useLayoutStyles,
} from "~lib/components/core/Layout/useLayoutStyles"
import {
  Direction,
  getDirectionOfBlock,
  type MinFlexElementWidth,
  shouldWidthStretch,
} from "~lib/components/core/Layout/utils"
import { ScriptRunContext } from "~lib/components/core/ScriptRunContext"
import ChatMessage from "~lib/components/elements/ChatMessage/ChatMessage"
import Dialog from "~lib/components/elements/Dialog/Dialog"
import Expander from "~lib/components/elements/Expander/Expander"
import Popover from "~lib/components/elements/Popover/Popover"
import Tabs, { type TabProps } from "~lib/components/elements/Tabs/Tabs"
import Form from "~lib/components/widgets/Form/Form"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import {
  type DOMRectKeys,
  useResizeObserver,
} from "~lib/hooks/useResizeObserver"
import { useScrollToBottom } from "~lib/hooks/useScrollToBottom"
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
  StyledColumn,
  StyledDialogContentEndPad,
  StyledFlexContainerBlock,
  type StyledFlexContainerBlockProps,
  StyledGridCell,
  StyledGridCellBody,
  StyledGridCellContent,
  StyledGridContainerBlock,
  StyledGridContentMeasure,
  StyledGridScrollBody,
  StyledLayoutWrapper,
  translateGapWidth,
} from "./styled-components"
import {
  assignDividerColor,
  type BaseBlockProps,
  checkFlexContainerBackwardsCompatibile,
  convertKeyToClassName,
  getBorderBackwardsCompatible,
  getClassnamePrefix,
  getColumnGapConfig,
  getKeyFromId,
  isComponentStale,
  shouldActivateScrollToBottom,
  shouldComponentBeEnabled,
  shouldHideStaleDialog,
} from "./utils"

const ChildRenderer = (props: BlockPropsWithoutWidth): ReactNode => {
  // Handle cycling of colors for dividers:
  assignDividerColor(props.node, useEmotionTheme())

  const {
    node,
    widgetsDisabled,
    disableFullscreenMode,
    endpoints,
    widgetMgr,
    uploadClient,
    componentRegistry,
  } = props

  // Memoize traversal to avoid recomputing during resize events.
  // All props are included in deps to satisfy exhaustive-deps lint rule.
  // The singleton props (endpoints, widgetMgr, etc.) never change references,
  // so including them doesn't cause unnecessary recomputation.
  const elements = useMemo(
    () =>
      RenderNodeVisitor.collectReactElements({
        node,
        widgetsDisabled,
        disableFullscreenMode,
        endpoints,
        widgetMgr,
        uploadClient,
        componentRegistry,
      }),
    [
      node,
      widgetsDisabled,
      disableFullscreenMode,
      endpoints,
      widgetMgr,
      uploadClient,
      componentRegistry,
    ]
  )

  return elements
}

interface ContainerContentsWrapperProps extends BaseBlockProps {
  node: BlockNode
  height: React.CSSProperties["height"]
  isRoot?: boolean
  /** Extra in-flow space after the last widget. Used by side-drawer dialogs. */
  padContentEnd?: boolean
}

export const ContainerContentsWrapper = (
  props: ContainerContentsWrapperProps
): ReactElement => {
  const parentContext = useContext(FlexContext)

  const defaultStyles: StyledFlexContainerBlockProps = {
    direction: Direction.VERTICAL,
    flex: 1,
    gap: { gapSize: streamlit.GapSize.SMALL },
    height: props.height,
    // eslint-disable-next-line streamlit-custom/no-hardcoded-theme-values
    border: false,
  }

  return (
    <FlexContextProvider
      direction={Direction.VERTICAL}
      isRoot={props.isRoot}
      // True only when this node is itself an `st.columns` column, so auto wrap
      // stays compact for the column's direct children. Deliberately not inherited
      // from parentContext. Nested providers that use this wrapper (form, expander,
      // tabs, …) are not columns, so the flag resets to false. Nested st.container
      // resets the same way because FlexBoxContainer only sets this prop when the
      // node is a column or grid cell.
      isDirectlyInColumn={notNullOrUndefined(props.node.deltaBlock.column)}
      parentContext={parentContext}
    >
      <StyledFlexContainerBlock
        {...defaultStyles}
        className={getClassnamePrefix(Direction.VERTICAL)}
        data-testid={getClassnamePrefix(Direction.VERTICAL)}
      >
        <ChildRenderer {...props} />
        {props.padContentEnd && (
          <StyledDialogContentEndPad
            aria-hidden="true"
            data-testid="stDialogContentEndPad"
          />
        )}
      </StyledFlexContainerBlock>
    </FlexContextProvider>
  )
}

interface FlexBoxContainerProps extends BaseBlockProps {
  node: BlockNode
}

/**
 * A definite-height grid cell's `grid.cell()` block must fill the cell.
 * The layout wrapper and the inner flex block both use this, so stretch
 * children do not collapse when one of them forgets the check.
 */
function shouldFillGridCell(
  deltaBlock: BlockProto,
  flexContext: IFlexContext | null
): boolean {
  return (
    notNullOrUndefined(deltaBlock.gridCell) &&
    Boolean(flexContext?.fillAvailableHeight)
  )
}

export const FlexBoxContainer = (
  props: FlexBoxContainerProps
): ReactElement => {
  const direction = getDirectionOfBlock(props.node.deltaBlock)
  const parentContext = useContext(FlexContext)

  const activateScrollToBottom = shouldActivateScrollToBottom(props.node)
  const scrollContainerRef = useScrollToBottom(activateScrollToBottom)

  const layout_styles = useLayoutStyles({
    element: props.node.deltaBlock,
    subElement: extractLayoutSubElement(props.node.deltaBlock),
  })

  // Absent wrap on a FlexContainer message means nowrap. This is also
  // backwards compatible, since older messages did not set wrap.
  const wrap = props.node.deltaBlock.flexContainer?.wrap ?? false
  // A horizontal container with `wrap=false` (including st.columns(wrap=False))
  // keeps its elements in a single row and scrolls horizontally when they
  // don't fit, instead of wrapping.
  const enableHorizontalScroll = direction === Direction.HORIZONTAL && !wrap

  // A pixel row is definite height. The cell block has no height of its
  // own, so without this it stays content-sized and stretch children
  // resolve against 0. Content rows leave the block content-sized so
  // vertical_alignment can still move it.
  const fillGridCell = shouldFillGridCell(props.node.deltaBlock, parentContext)

  const styles: StyledFlexContainerBlockProps = {
    gap:
      // This is backwards compatible with old proto messages since previously
      // the gap size was defaulted to small.
      props.node.deltaBlock.flexContainer?.gapConfig ?? {
        gapSize: streamlit.GapSize.SMALL,
      },
    direction: direction,
    $wrap: wrap,
    overflow: layout_styles.overflow,
    overflowX: enableHorizontalScroll ? ("auto" as const) : undefined,
    border: getBorderBackwardsCompatible(props.node.deltaBlock),
    // We need the height on the container for scrolling.
    height: fillGridCell ? "100%" : layout_styles.height,
    minHeight: fillGridCell ? 0 : undefined,
    // Flex properties are set on the LayoutWrapper.
    flex: "1",
    align: props.node.deltaBlock.flexContainer?.align,
    justify: props.node.deltaBlock.flexContainer?.justify,
    $fillJustify: fillGridCell ? parentContext?.fillJustify : undefined,
  }

  const userKey = getKeyFromId(props.node.deltaBlock.id)

  // Extract pixel width if the container has a fixed width
  const parentWidth =
    props.node.deltaBlock.widthConfig?.pixelWidth ?? undefined

  // Determine width configuration for FlexContext
  const hasContentWidth =
    props.node.deltaBlock.widthConfig?.useContent ?? false
  const hasFixedWidth =
    (props.node.deltaBlock.widthConfig?.pixelWidth ?? 0) > 0 ||
    (props.node.deltaBlock.widthConfig?.remWidth ?? 0) > 0

  return (
    <FlexContextProvider
      direction={direction}
      wrap={wrap}
      parentWidth={parentWidth}
      hasContentWidth={hasContentWidth}
      hasFixedWidth={hasFixedWidth}
      // True for `st.columns` columns and `st.grid` cells so auto wrap stays
      // compact for their direct children. Nested containers omit both fields
      // and reset the flag. Not inherited from parentContext.
      isDirectlyInColumn={
        notNullOrUndefined(props.node.deltaBlock.column) ||
        notNullOrUndefined(props.node.deltaBlock.gridCell)
      }
      // Stretch children of this cell take leftover space. Do not copy
      // fillAvailableHeight: nested containers must not fill the cell
      // unless they ask for stretch.
      verticalStretchGrows={fillGridCell}
      parentContext={parentContext}
    >
      <StyledFlexContainerBlock
        {...styles}
        className={[
          getClassnamePrefix(direction),
          convertKeyToClassName(userKey),
        ]
          .filter(Boolean)
          .join(" ")}
        data-testid={getClassnamePrefix(direction)}
        data-test-wrap={String(wrap)}
        ref={scrollContainerRef as React.RefObject<HTMLDivElement>}
        data-test-scroll-behavior={
          activateScrollToBottom ? "scroll-to-bottom" : "normal"
        }
      >
        <ChildRenderer {...props} />
      </StyledFlexContainerBlock>
    </FlexContextProvider>
  )
}

interface GridContainerProps extends BaseBlockProps {
  node: BlockNode
}

const GRID_OBSERVED_PROPERTIES: DOMRectKeys[] = ["width"]
const HEIGHT_OBSERVED_PROPERTIES: DOMRectKeys[] = ["height"]
// Descendants only. The scroll body itself is not included, so giving it
// tabIndex={0} does not count as an existing tab stop.
const FOCUSABLE_DESCENDANT =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * `tabIndex={0}` on a scrollport that has no focusable descendant, so
 * keyboard users can scroll text-only overflow. No `role="region"`: every
 * cell would otherwise be a landmark with the same name. Widgets inside
 * the scrollport stay the tab stops; this does not add a second one.
 */
function useExposeScrollTarget(
  active: boolean,
  elementRef: { readonly current: HTMLElement | null },
  dependency: unknown
): boolean {
  const [exposed, setExposed] = useState(false)
  useLayoutEffect(() => {
    const element = elementRef.current
    const next =
      active &&
      !!element &&
      element.querySelector(FOCUSABLE_DESCENDANT) === null
    setExposed(current => (current === next ? current : next))
  }, [active, elementRef, dependency])
  return exposed
}

interface GridCellProps {
  constrainOverflow: boolean
  verticalAlignment: BlockProto.GridContainer.VerticalAlignment
  showBorder: boolean
  columnSpan?: number
  columnSpanAll: boolean
  rowSpan?: number
  children: ReactNode
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
  constrainOverflow,
  verticalAlignment,
  showBorder,
  columnSpan,
  columnSpanAll,
  rowSpan,
  children,
}: GridCellProps): ReactElement => {
  const { values: bodyHeights, elementRef: bodyRef } =
    useResizeObserver<HTMLDivElement>(HEIGHT_OBSERVED_PROPERTIES, [
      constrainOverflow,
    ])
  const { values: contentHeights, elementRef: contentRef } =
    useResizeObserver<HTMLDivElement>(HEIGHT_OBSERVED_PROPERTIES, [
      constrainOverflow,
    ])
  const scroll =
    constrainOverflow &&
    shouldEnableOverflowScroll(contentHeights[0] ?? 0, bodyHeights[0] ?? 0)
  // A text-only scrollport is not in the tab order. Widgets already inside
  // the cell are, so do not add a second stop in that case.
  const keyboardScrollTarget = useExposeScrollTarget(scroll, bodyRef, children)

  return (
    <StyledGridCell
      verticalAlignment={verticalAlignment}
      showBorder={showBorder}
      className="stGridCell"
      data-testid="stGridCell"
      columnSpan={columnSpan}
      columnSpanAll={columnSpanAll}
      rowSpan={rowSpan}
    >
      <StyledGridCellBody
        ref={constrainOverflow ? bodyRef : undefined}
        $scroll={scroll}
        $passthrough={!constrainOverflow}
        data-testid="stGridCellBody"
        data-test-scroll={String(scroll)}
        tabIndex={keyboardScrollTarget ? 0 : undefined}
      >
        <StyledGridCellContent
          ref={constrainOverflow ? contentRef : undefined}
          verticalAlignment={verticalAlignment}
          $passthrough={!constrainOverflow}
          data-testid="stGridCellContent"
        >
          {children}
        </StyledGridCellContent>
      </StyledGridCellBody>
    </StyledGridCell>
  )
}

const OverflowAwareGridPort = ({
  bounded,
  wrap,
  horizontalScroll,
  trackMinWidthPx,
  children,
}: {
  bounded: boolean
  wrap: boolean
  horizontalScroll: boolean
  trackMinWidthPx?: number
  children: ReactNode
}): ReactElement => {
  const { values: portHeights, elementRef: portRef } =
    useResizeObserver<HTMLDivElement>(HEIGHT_OBSERVED_PROPERTIES, [bounded])
  const { values: contentHeights, elementRef: contentRef } =
    useResizeObserver<HTMLDivElement>(HEIGHT_OBSERVED_PROPERTIES, [bounded])
  const scroll =
    bounded &&
    shouldEnableOverflowScroll(contentHeights[0] ?? 0, portHeights[0] ?? 0)
  const keyboardScrollTarget = useExposeScrollTarget(
    bounded && (scroll || horizontalScroll),
    portRef,
    children
  )

  return (
    <StyledGridScrollBody
      ref={bounded ? portRef : undefined}
      $scroll={scroll}
      $horizontalScroll={horizontalScroll}
      $bounded={bounded}
      data-testid="stGridScrollBody"
      data-test-scroll={String(scroll)}
      tabIndex={keyboardScrollTarget ? 0 : undefined}
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
      return collectGridCellSources(node.children ?? [], sourceKey)
    }
    return [{ node, sourceKey }]
  })
}

/**
 * Renders a CSS Grid container with its children wrapped in grid cells.
 */
const GridContainer = (props: GridContainerProps): ReactElement => {
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
  // Width changes re-render this component. Keep the divider walk off that
  // path; ChildRenderer already memoizes its own traversal. The returned
  // node is the same object, after divider colors are assigned.
  const gridNode = useMemo(() => {
    assignDividerColor(node, theme)
    return node
  }, [node, theme])

  const parentContext = useContext(FlexContext)
  const gridConfig = gridNode.deltaBlock.gridContainer

  const userKey = getKeyFromId(node.deltaBlock.id)
  const heightConfig = node.deltaBlock.heightConfig
  const gridHasBoundedHeight = Boolean(
    heightConfig?.useStretch ||
    heightConfig?.pixelHeight ||
    heightConfig?.remHeight
  )

  const { values: observedWidths, elementRef } =
    useResizeObserver<HTMLDivElement>(GRID_OBSERVED_PROPERTIES, [
      gridHasBoundedHeight,
    ])
  const observedWidth = observedWidths[0]
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
  const maxColumns = gridConfig?.maxColumns ?? 0
  const rawMinColumnWidthPx = gridConfig?.minColumnWidthPx ?? 0
  const rowGap = gridConfig?.rowGapConfig ?? {
    gapSize: streamlit.GapSize.SMALL,
  }
  const columnGap = gridConfig?.columnGapConfig ?? {
    gapSize: streamlit.GapSize.SMALL,
  }
  const verticalAlignment =
    gridConfig?.verticalAlignment ??
    BlockProto.GridContainer.VerticalAlignment.TOP
  const showCellBorder = gridConfig?.showCellBorder ?? false
  const cellHeightMode =
    gridConfig?.cellHeightMode ??
    BlockProto.GridContainer.CellHeightMode.CONTENT
  const cellHeightPx = gridConfig?.cellHeightConfig?.pixelHeight ?? undefined
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
    maxColumns,
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

    return collectGridCellSources(node.children ?? []).flatMap(
      ({ node: childNode, sourceKey }) => {
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
          nodeId = layoutNode.deltaBlock.id || undefined
          if (layoutNode.deltaBlock.gridCell) {
            const gridCell = layoutNode.deltaBlock.gridCell
            if (gridCell.columnSpanAll) {
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

  const constrainOverflow =
    cellHeightMode === BlockProto.GridContainer.CellHeightMode.FIXED

  // wrap=False tracks will not shrink below this floor. The scrollport's
  // content box must be at least that wide, or overflow-x clips the columns.
  // Only become a scrollport once the tracks are wider than the box.
  // overflow-x: auto would otherwise coerce overflow-y and clip toolbars
  // even when every column fits.
  const tracksMinWidthPx = gridTracksMinWidthPx(
    columnCount,
    minColumnWidthPx,
    columnGapPx
  )
  const horizontalScroll = shouldScrollHorizontally(
    wrap,
    tracksMinWidthPx,
    measuredWidth !== undefined && measuredWidth > 0
      ? measuredWidth
      : fallbackWidthPx
  )
  const trackMinWidthPx =
    gridHasBoundedHeight && horizontalScroll ? tracksMinWidthPx : undefined
  const gridKeyboardScrollTarget = useExposeScrollTarget(
    !gridHasBoundedHeight && horizontalScroll,
    elementRef,
    childrenWithCells
  )

  // Wrap each child in a grid cell with span information.
  // Use nodeId for stable React keys so width-driven template updates do not
  // remount cells. Fall back to the source path so filtering a duplicate
  // widget does not shift later cell() keys.
  const wrappedChildren = useMemo(
    () =>
      childrenWithCells.map(child => (
        <GridCell
          key={child.nodeId ?? `grid-child-${child.sourceKey}`}
          constrainOverflow={constrainOverflow}
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
            fillAvailableHeight={constrainOverflow}
            fillJustify={
              constrainOverflow
                ? gridCellJustifyContent(verticalAlignment)
                : undefined
            }
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
      constrainOverflow,
      parentContext,
    ]
  )

  // Always render the port so switching height does not remount the grid.
  // Content height styles the port as `display: contents`.
  return (
    <OverflowAwareGridPort
      bounded={gridHasBoundedHeight}
      wrap={wrap}
      horizontalScroll={horizontalScroll}
      trackMinWidthPx={trackMinWidthPx}
    >
      <StyledGridContainerBlock
        ref={elementRef}
        columnCount={columnCount}
        minColumnWidthPx={minColumnWidthPx}
        $wrap={wrap}
        $horizontalScroll={!gridHasBoundedHeight && horizontalScroll}
        rowGap={rowGap}
        columnGap={columnGap}
        cellHeightMode={cellHeightMode}
        cellHeightPx={cellHeightPx}
        $dense={dense}
        className={["stGrid", convertKeyToClassName(userKey)]
          .filter(Boolean)
          .join(" ")}
        data-testid="stGrid"
        data-test-column-count={columnCount}
        data-test-wrap={String(wrap)}
        tabIndex={gridKeyboardScrollTarget ? 0 : undefined}
      >
        {wrappedChildren}
      </StyledGridContainerBlock>
    </OverflowAwareGridPort>
  )
}

export interface BlockPropsWithoutWidth extends BaseBlockProps {
  node: BlockNode
}

const LARGE_STRETCH_BEHAVIOR = new Set(["tabContainer"])
const MEDIUM_STRETCH_BEHAVIOR = new Set(["chatInput"])

export const BlockNodeRenderer = (
  props: BlockPropsWithoutWidth
): ReactElement | null => {
  const { node } = props
  const { scriptRunState, scriptRunId, fragmentIdsThisRun } =
    useContext(ScriptRunContext)
  const flexContext = useContext(FlexContext)

  let minStretchBehavior: MinFlexElementWidth
  if (LARGE_STRETCH_BEHAVIOR.has(node.deltaBlock.type ?? "")) {
    minStretchBehavior = "14rem"
  } else if (MEDIUM_STRETCH_BEHAVIOR.has(node.deltaBlock.type ?? "")) {
    minStretchBehavior = "8rem"
  } else if (node.deltaBlock.type === "chatMessage") {
    if (node.isEmpty) {
      minStretchBehavior = "8rem"
    }
  } else if (
    node.deltaBlock.type === "flexContainer" ||
    node.deltaBlock.type === "gridContainer" ||
    node.deltaBlock.column ||
    node.deltaBlock.expandable
  ) {
    if (!node.isEmpty) {
      minStretchBehavior = "8rem"
    }
  }

  const styles = useLayoutStyles({
    element: node.deltaBlock,
    subElement: extractLayoutSubElement(node.deltaBlock),
    minStretchBehavior,
  })

  // grid.cell() is wrapped in stLayoutWrapper. In a definite-height row that
  // wrapper must fill the cell; otherwise its default flex (0 1 auto) and
  // height: auto collapse stretch children to 0.
  const fillGridCell = shouldFillGridCell(node.deltaBlock, flexContext)
  const wrapperStyles = fillGridCell
    ? { ...styles, height: "100%", flex: "1 1 auto", minHeight: 0 }
    : styles

  if (node.isEmpty && !node.deltaBlock.allowEmpty) {
    return null
  }

  const enable = shouldComponentBeEnabled("", scriptRunState)
  const isStale = isComponentStale(
    enable,
    node,
    scriptRunState,
    scriptRunId,
    fragmentIdsThisRun
  )

  const childProps = { ...props, node }

  // Disable fullscreen mode if already disabled by parent
  // (e.g., via libConfig or ancestor dialog/popover),
  // or if this block itself is a dialog or popover
  const disableFullscreenMode =
    props.disableFullscreenMode ||
    notNullOrUndefined(node.deltaBlock.dialog) ||
    notNullOrUndefined(node.deltaBlock.popover)

  // Transparent blocks group elements in the backend tree without adding DOM.
  // Children render directly in the parent's flex context.
  if (node.deltaBlock.transparent) {
    return (
      <ChildRenderer
        {...childProps}
        disableFullscreenMode={disableFullscreenMode}
      />
    )
  }

  let containerElement: ReactElement | undefined
  // Whether the CSS key class (st-key-*) is applied on StyledLayoutWrapper.
  // Gating this per container so we can analyze each one to confirm that
  // applying it on the wrapper makes sense. Currently enabled for expander
  // and popover only.
  let keyClassOnWrapper = false

  // Marks the wrapper as a timeline step so the parent flex container can let
  // the step's connector line bridge the gap to an adjacent step. Empty steps
  // must be marked too: they draw no connector of their own, but the preceding
  // step extends its line to whatever step follows it, which is how a trailing
  // empty step terminates a timeline at its icon.
  const isStepBlock =
    node.deltaBlock.expandable?.type === BlockProto.Expandable.Type.STEP

  const userKey = getKeyFromId(node.deltaBlock.id)
  const child: ReactElement = (
    <ContainerContentsWrapper
      {...childProps}
      disableFullscreenMode={disableFullscreenMode}
      height="100%"
    />
  )

  if (checkFlexContainerBackwardsCompatibile(node.deltaBlock)) {
    containerElement = <FlexBoxContainer {...childProps} />
  }

  if (node.deltaBlock.gridContainer) {
    containerElement = <GridContainer {...childProps} />
  }

  if (node.deltaBlock.dialog) {
    // Hide leftover dialogs from a previous full-app run as soon as the next
    // full-app run starts. Stale-node cleanup waits until the run finishes,
    // which would leave the overlay up during blocking work (issue #9405).
    // Same unmount as that later prune. Do not go through Dialog's onClose:
    // that path is user dismiss and would newly fire on_dismiss.
    // Re-opening the same dialog in this run remounts it when the new delta
    // arrives; keeping a dialog open across st.rerun() is not supported.
    if (
      shouldHideStaleDialog(
        node,
        scriptRunState,
        scriptRunId,
        fragmentIdsThisRun
      )
    ) {
      return null
    }

    const dialog = node.deltaBlock.dialog as BlockProto.Dialog
    const isDrawer =
      dialog.position === BlockProto.Dialog.DialogPosition.LEFT ||
      dialog.position === BlockProto.Dialog.DialogPosition.RIGHT
    return (
      <Dialog
        element={dialog}
        deltaMsgReceivedAt={node.deltaMsgReceivedAt}
        widgetMgr={props.widgetMgr}
        fragmentId={node.fragmentId}
      >
        <ContainerContentsWrapper
          {...childProps}
          disableFullscreenMode={disableFullscreenMode}
          height="100%"
          padContentEnd={isDrawer}
        />
      </Dialog>
    )
  }

  if (node.deltaBlock.expandable) {
    keyClassOnWrapper = true
    containerElement = (
      <Expander
        isStale={isStale}
        element={node.deltaBlock.expandable as BlockProto.Expandable}
        empty={node.isEmpty}
        widgetMgr={props.widgetMgr}
        blockId={node.deltaBlock.id || undefined}
        fragmentId={node.fragmentId}
      >
        {child}
      </Expander>
    )
  }

  if (node.deltaBlock.popover) {
    keyClassOnWrapper = true
    containerElement = (
      <Popover
        empty={node.isEmpty}
        element={node.deltaBlock.popover as BlockProto.Popover}
        stretchWidth={shouldWidthStretch(node.deltaBlock.widthConfig)}
        widgetMgr={props.widgetMgr}
        blockId={node.deltaBlock.id || undefined}
        fragmentId={node.fragmentId}
      >
        {child}
      </Popover>
    )
  }

  if (node.deltaBlock.type === "form") {
    const { formId, clearOnSubmit, enterToSubmit, border } = node.deltaBlock
      .form as BlockProto.Form
    containerElement = (
      <Form
        formId={formId}
        clearOnSubmit={clearOnSubmit}
        enterToSubmit={enterToSubmit}
        widgetMgr={props.widgetMgr}
        border={border}
        overflow={styles.overflow}
      >
        {child}
      </Form>
    )
  }

  if (node.deltaBlock.chatMessage) {
    containerElement = (
      <ChatMessage
        element={node.deltaBlock.chatMessage as BlockProto.ChatMessage}
        endpoints={props.endpoints}
      >
        {child}
      </ChatMessage>
    )
  }

  if (node.deltaBlock.column) {
    return (
      <StyledColumn
        weight={node.deltaBlock.column.weight ?? 0}
        gap={getColumnGapConfig(node.deltaBlock.column)}
        verticalAlignment={
          node.deltaBlock.column.verticalAlignment ?? undefined
        }
        showBorder={node.deltaBlock.column.showBorder ?? false}
        // Inherit parent row wrap; default true when FlexContext is absent.
        $wrap={flexContext?.wrap ?? true}
        className="stColumn"
        data-testid="stColumn"
      >
        {child}
      </StyledColumn>
    )
  }

  if (node.deltaBlock.tabContainer) {
    // Only pixel / stretch heights actually constrain the tab container. A
    // `height="content"` config yields `styles.height === "auto"`, which
    // shouldn't switch tabs into the fill-and-scroll layout — that would clip
    // content that legitimately overflows (tooltips, focus rings, drop
    // shadows).
    const heightConfig = node.deltaBlock.heightConfig
    const hasConstrainingHeight =
      notNullOrUndefined(heightConfig) && !heightConfig.useContent
    const contentHeight = hasConstrainingHeight ? "100%" : "auto"
    const renderTabContent = (
      mappedChildProps: JSX.IntrinsicAttributes & BlockPropsWithoutWidth
    ): ReactElement => {
      // avoid circular dependency where Tab uses VerticalBlock but VerticalBlock uses tabs
      return (
        <ContainerContentsWrapper
          {...mappedChildProps}
          height={contentHeight}
        />
      )
    }
    // We can't use StyledLayoutWrapper for tabs currently because of the horizontal scrolling
    // management that is handled in the Tabs component. TODO(lwilby): Investigate whether it makes
    // sense to consolidate that logic with the StyledLayoutWrapper.
    const tabsProps: TabProps = {
      ...childProps,
      isStale,
      renderTabContent,
      width: styles.width,
      height: hasConstrainingHeight ? styles.height : undefined,
      flex: styles.flex,
      fragmentId: node.fragmentId,
    }
    return <Tabs {...tabsProps} />
  }

  if (containerElement) {
    return (
      <StyledLayoutWrapper
        data-testid="stLayoutWrapper"
        {...{ [STEP_BLOCK_ATTRIBUTE]: isStepBlock ? "true" : undefined }}
        className={convertKeyToClassName(
          keyClassOnWrapper ? userKey : undefined
        )}
        {...wrapperStyles}
      >
        {containerElement}
      </StyledLayoutWrapper>
    )
  }

  return child
}

export const VerticalBlock = (props: BlockPropsWithoutWidth): ReactElement => {
  // Deprecated. Use FlexBoxContainer instead.
  return <FlexBoxContainer {...props} />
}
