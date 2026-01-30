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
  memo,
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

import { PLACEMENT, TRIGGER_TYPE, Popover as UIPopover } from "baseui/popover"

import { Block as BlockProto } from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import { TextLineSkeleton } from "~lib/components/elements/Skeleton/styled-components"
import { Box } from "~lib/components/shared/Base/styled-components"
import BaseButton, {
  BaseButtonKind,
  BaseButtonSize,
  BaseButtonTooltip,
  DynamicButtonLabel,
} from "~lib/components/shared/BaseButton"
import { DynamicIcon } from "~lib/components/shared/Icon"
import { useCalculatedDimensions } from "~lib/hooks/useCalculatedDimensions"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { ScriptRunState } from "~lib/ScriptRunState"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledPopoverExpansionIcon,
  StyledPopoverLabelContainer,
} from "./styled-components"

export interface PopoverProps {
  element: BlockProto.Popover
  empty: boolean
  // TODO (lawilby): This is can probably be simplified if we
  // rewrite the min width calculation to translate rem to px.
  stretchWidth: boolean
  widgetMgr?: WidgetStateManager
  blockId?: string
  fragmentId?: string
  /** Current script run state - used to detect when content loading is complete */
  scriptRunState: ScriptRunState
  /** Current script run ID - used to detect when a new script run completes */
  scriptRunId: string
}

const Popover: React.FC<React.PropsWithChildren<PopoverProps>> = ({
  element,
  empty,
  children,
  stretchWidth,
  widgetMgr,
  blockId,
  fragmentId,
  scriptRunState,
  scriptRunId,
}): ReactElement => {
  const isInSidebar = useContext(IsSidebarContext)

  const theme = useEmotionTheme()

  // Check if this is a widget (dynamic popover with state tracking)
  const isWidget = Boolean(widgetMgr && blockId)

  // Single state with optimistic updates for instant UI feedback
  // Initialize from backend state (supports initial open parameter and programmatic control)
  const [open, setOpen] = useState(element.open ?? false)

  // Track loading state: true when we're waiting for backend content after optimistic open
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const previousBackendOpenRef = useRef(element.open ?? false)

  // Track the scriptRunId when loading started - used to detect when the
  // script run that would populate content has completed
  const loadingStartScriptRunIdRef = useRef<string | null>(null)

  // Sync backend state changes for programmatic control via session_state
  // This useEffect is valid: syncing with external system (backend widget state)
  useEffect(() => {
    if (isWidget && element.open !== undefined && element.open !== null) {
      const backendOpen = element.open

      // Detect when backend state has updated
      if (backendOpen !== previousBackendOpenRef.current) {
        previousBackendOpenRef.current = backendOpen
        // Clear loading state when backend responds AND we have content
        // Keep spinner until content is actually available (not empty)
        if (!empty) {
          // eslint-disable-next-line
          setIsLoadingContent(false)
        }
      }

      // Sync local open state with backend
      setOpen(backendOpen)
    }
  }, [isWidget, element.open, empty])

  // Clear loading state if popover becomes non-empty (content arrived)
  // This effect detects when children are rendered (external content system)
  useEffect(() => {
    if (!empty && isLoadingContent) {
      // eslint-disable-next-line
      setIsLoadingContent(false)
    }
  }, [empty, isLoadingContent])

  // Clear loading state when script run completes (for empty popovers)
  // This replaces the previous timeout-based approach with accurate detection:
  // - When loading starts, we capture the current scriptRunId
  // - When the script run completes (state becomes NOT_RUNNING with a different ID),
  //   we know all content that will be rendered has been rendered
  // This works for both slow code (waits for completion) and empty popovers (clears immediately)
  useEffect(() => {
    // Capture scriptRunId when loading starts
    if (isLoadingContent && loadingStartScriptRunIdRef.current === null) {
      loadingStartScriptRunIdRef.current = scriptRunId
    }

    // Clear loading when script run completes
    // We check that:
    // 1. We're currently loading
    // 2. Script is no longer running
    // 3. We have a starting scriptRunId recorded
    // 4. The current scriptRunId is different (a new run completed)
    if (
      isLoadingContent &&
      scriptRunState === ScriptRunState.NOT_RUNNING &&
      loadingStartScriptRunIdRef.current !== null &&
      scriptRunId !== loadingStartScriptRunIdRef.current
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing with external system (backend script run state)
      setIsLoadingContent(false)
      loadingStartScriptRunIdRef.current = null
    }
  }, [isLoadingContent, scriptRunState, scriptRunId])

  // It would be nice to remove this since it uses a resize observer
  // and therefore has a performance overhead. However, this is needed
  // to link the width of the button to the popover width. I think we
  // can remove the need for this as part of the BaseWeb migration.
  const { width: calculatedWidth, elementRef } = useCalculatedDimensions()

  // Handle popover toggle with optimistic updates for instant feedback
  const handleToggle = useCallback(
    (newOpen: boolean): void => {
      // Optimistic update: set state IMMEDIATELY for instant UI feedback
      // This makes the popover feel responsive even if backend is slow
      setOpen(newOpen)

      // If opening a widget popover, show loading state until content arrives
      if (isWidget && newOpen && empty) {
        setIsLoadingContent(true)
        // Reset the ref so the effect will capture the new scriptRunId
        loadingStartScriptRunIdRef.current = null
      } else {
        setIsLoadingContent(false)
        loadingStartScriptRunIdRef.current = null
      }

      // Send state update to backend in parallel
      // Backend will send updated state back which gets synced via useEffect
      if (isWidget && widgetMgr && blockId) {
        widgetMgr.setBoolValue(
          { id: blockId },
          newOpen,
          { fromUi: true },
          fragmentId
        )
      }
    },
    [isWidget, widgetMgr, blockId, fragmentId, empty]
  )

  let kind = BaseButtonKind.SECONDARY
  if (element.type === "primary") {
    kind = BaseButtonKind.PRIMARY
  } else if (element.type === "tertiary") {
    kind = BaseButtonKind.TERTIARY
  }

  return (
    <Box data-testid="stPopover" className="stPopover" ref={elementRef}>
      <UIPopover
        triggerType={TRIGGER_TYPE.click}
        placement={PLACEMENT.bottomLeft}
        content={() => {
          // Show skeleton while loading - no extra padding needed as Body has padding
          if (isLoadingContent) {
            return <TextLineSkeleton width="100%" />
          }

          // Show actual content (or empty if no content)
          return children
        }}
        isOpen={open}
        onClickOutside={() => handleToggle(false)}
        // We need to handle the click here as well to allow closing the
        // popover when the user clicks next to the button in the available
        // width in the surrounding container.
        onClick={() => (open ? handleToggle(false) : undefined)}
        onEsc={() => handleToggle(false)}
        ignoreBoundary={isInSidebar}
        // TODO(lukasmasuch): We currently use renderAll to have a consistent
        // width during the first and subsequent opens of the popover. Once we ,
        // support setting an explicit width we should reconsider turning this to
        // false for a better performance.
        renderAll={true}
        overrides={{
          Body: {
            props: {
              "data-testid": "stPopoverBody",
            },
            style: () => ({
              marginRight: theme.spacing.lg,
              marginBottom: theme.spacing.lg,

              maxHeight: "70vh",
              overflow: "auto",
              maxWidth: `calc(${theme.sizes.contentMaxWidth} - 2*${theme.spacing.lg})`,
              minWidth: stretchWidth
                ? // If width="stretch", we use the container width as minimum:
                  `${Math.max(calculatedWidth, 160)}px` // 10rem ~= 160px
                : theme.sizes.minPopupWidth,
              [`@media (max-width: ${theme.breakpoints.sm})`]: {
                maxWidth: `calc(100% - ${theme.spacing.threeXL})`,
              },
              borderTopLeftRadius: theme.radii.xl,
              borderTopRightRadius: theme.radii.xl,
              borderBottomRightRadius: theme.radii.xl,
              borderBottomLeftRadius: theme.radii.xl,

              borderLeftWidth: theme.sizes.borderWidth,
              borderRightWidth: theme.sizes.borderWidth,
              borderTopWidth: theme.sizes.borderWidth,
              borderBottomWidth: theme.sizes.borderWidth,

              paddingRight: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`, // 1px to account for border.
              paddingLeft: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`,
              paddingBottom: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`,
              paddingTop: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`,

              borderLeftStyle: "solid",
              borderRightStyle: "solid",
              borderTopStyle: "solid",
              borderBottomStyle: "solid",

              borderLeftColor: theme.colors.borderColor,
              borderRightColor: theme.colors.borderColor,
              borderTopColor: theme.colors.borderColor,
              borderBottomColor: theme.colors.borderColor,

              boxShadow: theme.shadows.popover,
            }),
          },
        }}
      >
        {/* This needs to be wrapped into a div, otherwise
        the BaseWeb popover implementation will not work correctly. */}
        <div>
          <BaseButtonTooltip help={element.help} containerWidth={true}>
            <BaseButton
              data-testid="stPopoverButton"
              kind={kind}
              size={BaseButtonSize.SMALL}
              disabled={element.disabled || (!isWidget && empty)}
              containerWidth={true}
              onClick={() => handleToggle(!open)}
            >
              <StyledPopoverLabelContainer>
                <DynamicButtonLabel
                  icon={element.icon}
                  label={element.label}
                />
                <StyledPopoverExpansionIcon>
                  <DynamicIcon
                    iconValue={
                      open
                        ? ":material/expand_less:"
                        : ":material/expand_more:"
                    }
                    size="lg"
                  />
                </StyledPopoverExpansionIcon>
              </StyledPopoverLabelContainer>
            </BaseButton>
          </BaseButtonTooltip>
        </div>
      </UIPopover>
    </Box>
  )
}

export default memo(Popover)
