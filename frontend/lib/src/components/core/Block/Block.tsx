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
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type {
  ReactElement,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react"

import classNames from "classnames"

import { Block as BlockProto, streamlit } from "@streamlit/protobuf"

import { BlockNode } from "~lib/AppNode"
import {
  FlexContext,
  FlexContextProvider,
} from "~lib/components/core/Layout/FlexContext"
import {
  extractLayoutSubElement,
  useLayoutStyles,
} from "~lib/components/core/Layout/useLayoutStyles"
import {
  Direction,
  getDirectionOfBlock,
  MinFlexElementWidth,
  shouldWidthStretch,
} from "~lib/components/core/Layout/utils"
import { ScriptRunContext } from "~lib/components/core/ScriptRunContext"
import ChatMessage from "~lib/components/elements/ChatMessage/ChatMessage"
import Dialog from "~lib/components/elements/Dialog/Dialog"
import Expander from "~lib/components/elements/Expander/Expander"
import Popover from "~lib/components/elements/Popover/Popover"
import Tabs from "~lib/components/elements/Tabs/Tabs"
import type { TabProps } from "~lib/components/elements/Tabs/Tabs"
import { useWindowDimensionsContext } from "~lib/components/shared/WindowDimensions/useWindowDimensionsContext"
import Form from "~lib/components/widgets/Form/Form"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useScrollToBottom } from "~lib/hooks/useScrollToBottom"
import { notNullOrUndefined } from "~lib/util/utils"

import { RenderNodeVisitor } from "./RenderNodeVisitor"
import {
  StyledColumn,
  StyledFlexContainerBlock,
  StyledFlexContainerBlockProps,
  StyledLayoutWrapper,
  StyledResizableColumnHandle,
} from "./styled-components"
import {
  assignDividerColor,
  BaseBlockProps,
  checkFlexContainerBackwardsCompatibile,
  convertKeyToClassName,
  getBorderBackwardsCompatible,
  getClassnamePrefix,
  getColumnGapSize,
  getKeyFromId,
  isComponentStale,
  shouldActivateScrollToBottom,
  shouldComponentBeEnabled,
} from "./utils"

const MIN_RESIZABLE_COLUMN_WIDTH_PX = 64
const KEYBOARD_RESIZE_STEP_PX = 10
let fallbackResizableColumnKeyCounter = 0
const fallbackResizableColumnKeys = new WeakMap<BlockNode, string>()

const getResizableColumnKey = (columnNode: BlockNode): string => {
  const { id } = columnNode.deltaBlock
  if (id) {
    return id
  }

  let key = fallbackResizableColumnKeys.get(columnNode)
  if (!key) {
    key = `resizable-column-${fallbackResizableColumnKeyCounter}`
    fallbackResizableColumnKeyCounter += 1
    fallbackResizableColumnKeys.set(columnNode, key)
  }
  return key
}

const ChildRenderer = (props: BlockPropsWithoutWidth): ReactElement => {
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

  return <>{elements}</>
}

/**
 * Returns true if the block has resizable columns.
 * Note: This requires *all* child blocks to have `resizable: true` on their
 * column proto. A single non-resizable child disables resizing for the entire
 * group. This matches the Python API where `resizable` is set uniformly on
 * all columns in an `st.columns()` call.
 */
const hasResizableColumns = (node: BlockNode): boolean =>
  Boolean(
    node.children?.length &&
    getDirectionOfBlock(node.deltaBlock) === Direction.HORIZONTAL &&
    node.children.every(
      child => child instanceof BlockNode && child.deltaBlock.column?.resizable
    )
  )

interface ContainerContentsWrapperProps extends BaseBlockProps {
  node: BlockNode
  height: React.CSSProperties["height"]
  isRoot?: boolean
}

export const ContainerContentsWrapper = (
  props: ContainerContentsWrapperProps
): ReactElement => {
  const parentContext = useContext(FlexContext)

  const defaultStyles: StyledFlexContainerBlockProps = {
    direction: Direction.VERTICAL,
    flex: 1,
    gap: streamlit.GapSize.SMALL,
    height: props.height,
    // eslint-disable-next-line streamlit-custom/no-hardcoded-theme-values
    border: false,
  }

  return (
    <FlexContextProvider
      direction={Direction.VERTICAL}
      isRoot={props.isRoot}
      parentContext={parentContext}
    >
      <StyledFlexContainerBlock
        {...defaultStyles}
        className={getClassnamePrefix(Direction.VERTICAL)}
        data-testid={getClassnamePrefix(Direction.VERTICAL)}
      >
        <ChildRenderer {...props} />
      </StyledFlexContainerBlock>
    </FlexContextProvider>
  )
}

type ResizableColumnsBlockProps = BlockPropsWithoutWidth

const ResizableColumnsBlock = (
  props: ResizableColumnsBlockProps
): ReactElement => {
  const theme = useEmotionTheme()
  const { innerWidth } = useWindowDimensionsContext()
  const columns = useMemo(
    () => props.node.children.filter(child => child instanceof BlockNode),
    [props.node.children]
  )
  const isNarrowLayout =
    innerWidth <= Number.parseInt(theme.breakpoints.columns, 10)
  const columnElementsRef = useRef<Array<HTMLDivElement | null>>([])
  const dragStateRef = useRef<{
    index: number
    startX: number
    startWidths: number[]
  } | null>(null)
  const [columnWidths, setColumnWidths] = useState<number[] | null>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)

  // Track previous values to detect when re-measurement is needed
  const prevColumnsLengthRef = useRef(columns.length)
  const prevInnerWidthRef = useRef(innerWidth)

  useLayoutEffect(() => {
    // Reset and re-measure when columns configuration or window width changes
    const needsReset =
      prevColumnsLengthRef.current !== columns.length ||
      prevInnerWidthRef.current !== innerWidth

    prevColumnsLengthRef.current = columns.length
    prevInnerWidthRef.current = innerWidth

    if (isNarrowLayout) {
      if (columnWidths !== null) {
        setColumnWidths(null)
      }
      return
    }

    if (needsReset && columnWidths !== null) {
      // Configuration changed while we have measured widths; clear them and
      // return early so the next effect cycle measures the natural flex-based
      // widths (not stale pixel overrides from widthOverride).

      setColumnWidths(null)
      return
    }

    if (columnWidths) {
      // Widths already set and no reset needed
      return
    }

    const measuredWidths = columns.map((_, index) => {
      const columnElement = columnElementsRef.current[index]
      if (!columnElement) {
        return 0
      }

      // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Initial measurements are required so dragging preserves the row width instead of wrapping columns.
      return columnElement.getBoundingClientRect().width
    })

    if (measuredWidths.every(width => width > 0)) {
      setColumnWidths(measuredWidths)
    }
  }, [columnWidths, columns, isNarrowLayout, innerWidth])

  useEffect(() => {
    if (draggingIndex === null) {
      return
    }

    // Set body cursor to prevent flickering when mouse moves faster than handle
    const previousCursor = document.body.style.cursor
    document.body.style.cursor = "col-resize"

    const handleMouseMove = (event: MouseEvent): void => {
      const dragState = dragStateRef.current
      if (!dragState) {
        return
      }

      const pairWidth =
        dragState.startWidths[dragState.index] +
        dragState.startWidths[dragState.index + 1]
      const nextLeftWidth = Math.min(
        Math.max(
          dragState.startWidths[dragState.index] +
            (event.clientX - dragState.startX),
          MIN_RESIZABLE_COLUMN_WIDTH_PX
        ),
        pairWidth - MIN_RESIZABLE_COLUMN_WIDTH_PX
      )
      const nextWidths = [...dragState.startWidths]
      nextWidths[dragState.index] = nextLeftWidth
      nextWidths[dragState.index + 1] = pairWidth - nextLeftWidth
      setColumnWidths(nextWidths)
    }

    const handleMouseUp = (): void => {
      dragStateRef.current = null
      setDraggingIndex(null)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.body.style.cursor = previousCursor
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [draggingIndex])

  /**
   * Adjusts adjacent column widths by a given delta in pixels.
   * The left column grows/shrinks by delta and the right column
   * compensates to maintain total width.
   */
  const adjustColumnWidths = useCallback(
    (index: number, delta: number): void => {
      if (!columnWidths || index >= columnWidths.length - 1) {
        return
      }

      const pairWidth = columnWidths[index] + columnWidths[index + 1]
      const nextLeftWidth = Math.min(
        Math.max(columnWidths[index] + delta, MIN_RESIZABLE_COLUMN_WIDTH_PX),
        pairWidth - MIN_RESIZABLE_COLUMN_WIDTH_PX
      )
      const nextWidths = [...columnWidths]
      nextWidths[index] = nextLeftWidth
      nextWidths[index + 1] = pairWidth - nextLeftWidth
      setColumnWidths(nextWidths)
    },
    [columnWidths]
  )

  return (
    <>
      {columns.map((columnNode, index): ReactElement => {
        const column = columnNode.deltaBlock.column
        const gap = getColumnGapSize(column ?? {})
        const canResize =
          !isNarrowLayout &&
          columnWidths !== null &&
          columnWidths.length === columns.length &&
          index < columns.length - 1

        const handleResizeStart = (
          event: ReactMouseEvent<HTMLDivElement>
        ): void => {
          if (
            columnWidths?.length !== columns.length ||
            index >= columnWidths.length - 1
          ) {
            return
          }

          event.preventDefault()
          dragStateRef.current = {
            index,
            startX: event.clientX,
            startWidths: [...columnWidths],
          }
          setDraggingIndex(index)
        }

        const handleKeyDown = (
          event: ReactKeyboardEvent<HTMLDivElement>
        ): void => {
          if (event.key === "ArrowLeft") {
            event.preventDefault()
            adjustColumnWidths(index, -KEYBOARD_RESIZE_STEP_PX)
          } else if (event.key === "ArrowRight") {
            event.preventDefault()
            adjustColumnWidths(index, KEYBOARD_RESIZE_STEP_PX)
          }
        }

        return (
          <StyledColumn
            key={getResizableColumnKey(columnNode)}
            ref={(columnElementRef): void => {
              columnElementsRef.current[index] = columnElementRef
            }}
            weight={column?.weight ?? 0}
            widthOverride={columnWidths?.[index]}
            gap={gap}
            verticalAlignment={column?.verticalAlignment ?? undefined}
            showBorder={column?.showBorder ?? false}
            isResizable={canResize}
            className="stColumn"
            data-testid="stColumn"
          >
            <ContainerContentsWrapper
              {...props}
              node={columnNode}
              height="100%"
              disableFullscreenMode={props.disableFullscreenMode}
            />
            {canResize && (
              <StyledResizableColumnHandle
                gap={gap}
                data-testid="stColumnResizeHandle"
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize column"
                aria-valuenow={Math.round(
                  (columnWidths[index] /
                    (columnWidths[index] + columnWidths[index + 1])) *
                    100
                )}
                aria-valuemin={0}
                aria-valuemax={100}
                tabIndex={0}
                onMouseDown={handleResizeStart}
                onKeyDown={handleKeyDown}
              />
            )}
          </StyledColumn>
        )
      })}
    </>
  )
}

interface FlexBoxContainerProps extends BaseBlockProps {
  node: BlockNode
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

  const styles = {
    gap:
      // This is backwards compatible with old proto messages since previously
      // the gap size was defaulted to small.
      props.node.deltaBlock.flexContainer?.gapConfig?.gapSize ??
      streamlit.GapSize.SMALL,
    direction: direction,
    // This is also backwards compatible since previously wrap was not added
    // to the flex container.
    $wrap: props.node.deltaBlock.flexContainer?.wrap ?? false,
    overflow: layout_styles.overflow,
    border: getBorderBackwardsCompatible(props.node.deltaBlock),
    // We need the height on the container for scrolling.
    height: layout_styles.height,
    // Flex properties are set on the LayoutWrapper.
    flex: "1",
    align: props.node.deltaBlock.flexContainer?.align,
    justify: props.node.deltaBlock.flexContainer?.justify,
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
  const renderResizableColumns = hasResizableColumns(props.node)

  return (
    <FlexContextProvider
      direction={direction}
      parentWidth={parentWidth}
      hasContentWidth={hasContentWidth}
      hasFixedWidth={hasFixedWidth}
      parentContext={parentContext}
    >
      <StyledFlexContainerBlock
        {...styles}
        className={classNames(
          getClassnamePrefix(direction),
          convertKeyToClassName(userKey)
        )}
        data-testid={getClassnamePrefix(direction)}
        ref={scrollContainerRef as React.RefObject<HTMLDivElement>}
        data-test-scroll-behavior={
          activateScrollToBottom ? "scroll-to-bottom" : "normal"
        }
      >
        {/* Note: ResizableColumnsBlock renders StyledColumn directly, bypassing
            BlockNodeRenderer. This means column rendering logic exists in two places:
            - BlockNodeRenderer (normal columns, see column handling below)
            - ResizableColumnsBlock (resizable columns)
            Future changes to column rendering may need to update both locations. */}
        {renderResizableColumns ? (
          <ResizableColumnsBlock {...props} />
        ) : (
          <ChildRenderer {...props} />
        )}
      </StyledFlexContainerBlock>
    </FlexContextProvider>
  )
}

export interface BlockPropsWithoutWidth extends BaseBlockProps {
  node: BlockNode
}

const LARGE_STRETCH_BEHAVIOR = ["tabContainer"]
const MEDIUM_STRETCH_BEHAVIOR = ["chatInput"]

export const BlockNodeRenderer = (
  props: BlockPropsWithoutWidth
): ReactElement => {
  const { node } = props
  const { scriptRunState, scriptRunId, fragmentIdsThisRun } =
    useContext(ScriptRunContext)

  let minStretchBehavior: MinFlexElementWidth
  if (LARGE_STRETCH_BEHAVIOR.includes(node.deltaBlock.type ?? "")) {
    minStretchBehavior = "14rem"
  } else if (MEDIUM_STRETCH_BEHAVIOR.includes(node.deltaBlock.type ?? "")) {
    minStretchBehavior = "8rem"
  } else if (node.deltaBlock.type === "chatMessage") {
    if (node.isEmpty) {
      minStretchBehavior = "8rem"
    }
  } else if (
    node.deltaBlock.type === "flexContainer" ||
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

  if (node.isEmpty && !node.deltaBlock.allowEmpty) {
    return <></>
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

  if (node.deltaBlock.dialog) {
    return (
      <Dialog
        element={node.deltaBlock.dialog as BlockProto.Dialog}
        deltaMsgReceivedAt={node.deltaMsgReceivedAt}
        widgetMgr={props.widgetMgr}
        fragmentId={node.fragmentId}
      >
        {child}
      </Dialog>
    )
  }

  if (node.deltaBlock.expandable) {
    keyClassOnWrapper = true
    containerElement = (
      <Expander
        isStale={isStale}
        element={node.deltaBlock.expandable as BlockProto.Expandable}
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
    const column = node.deltaBlock.column
    return (
      <StyledColumn
        weight={column.weight ?? 0}
        gap={getColumnGapSize(column)}
        verticalAlignment={column.verticalAlignment ?? undefined}
        showBorder={column.showBorder ?? false}
        className="stColumn"
        data-testid="stColumn"
      >
        {child}
      </StyledColumn>
    )
  }

  if (node.deltaBlock.tabContainer) {
    const renderTabContent = (
      mappedChildProps: JSX.IntrinsicAttributes & BlockPropsWithoutWidth
    ): ReactElement => {
      // avoid circular dependency where Tab uses VerticalBlock but VerticalBlock uses tabs
      return <ContainerContentsWrapper {...mappedChildProps} height="auto" />
    }
    // We can't use StyledLayoutWrapper for tabs currently because of the horizontal scrolling
    // management that is handled in the Tabs component. TODO(lwilby): Investigate whether it makes
    // sense to consolidate that logic with the StyledLayoutWrapper.
    const tabsProps: TabProps = {
      ...childProps,
      isStale,
      renderTabContent,
      width: styles.width,
      flex: styles.flex,
      fragmentId: node.fragmentId,
    }
    return <Tabs {...tabsProps} />
  }

  if (containerElement) {
    return (
      <StyledLayoutWrapper
        data-testid="stLayoutWrapper"
        className={convertKeyToClassName(
          keyClassOnWrapper ? userKey : undefined
        )}
        {...styles}
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
