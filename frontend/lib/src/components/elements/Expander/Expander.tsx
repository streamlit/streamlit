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
  FC,
  memo,
  PropsWithChildren,
  ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import classNames from "classnames"

import { Block as BlockProto } from "@streamlit/protobuf"

import {
  convertKeyToClassName,
  getKeyFromId,
} from "~lib/components/core/Block/utils"
import { TextLineSkeleton } from "~lib/components/elements/Skeleton/styled-components"
import { DynamicIcon } from "~lib/components/shared/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown"
import { ScriptRunState } from "~lib/ScriptRunState"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledDetails,
  StyledDetailsPanel,
  StyledExpandableContainer,
  StyledSummary,
  StyledSummaryHeading,
  StyledSummaryLabelWrapper,
} from "./styled-components"
import { useDetailsAnimation } from "./useDetailsAnimation"

export interface ExpanderIconProps {
  icon?: string
}

/**
 * Renders an icon for the expander and optionally a user-defined icon.
 *
 * If the icon is "spinner", it will render a spinner icon.
 * If the icon is a valid, user-defined icon, it will render the user-defined icon.
 * Otherwise, it will render nothing.
 *
 * @param {string} icon - The icon to render.
 * @returns {ReactElement}
 */
export const ExpanderIcon = (props: ExpanderIconProps): ReactElement => {
  const { icon } = props

  const statusIconTestIds: Record<string, string> = {
    ":material/check:": "stExpanderIconCheck",
    ":material/error:": "stExpanderIconError",
    spinner: "stExpanderIconSpinner",
  }

  return icon ? (
    <DynamicIcon
      size="lg"
      iconValue={icon}
      testid={statusIconTestIds[icon] || "stExpanderIcon"}
    />
  ) : (
    <></>
  )
}

export interface ExpanderProps {
  element: BlockProto.Expandable
  isStale: boolean
  empty: boolean
  widgetMgr?: WidgetStateManager
  blockId?: string
  fragmentId?: string
  /** Current script run state - used to detect when content loading is complete */
  scriptRunState: ScriptRunState
  /** Current script run ID - used to detect when a new script run completes */
  scriptRunId: string
}

const Expander: FC<PropsWithChildren<ExpanderProps>> = ({
  element,
  isStale,
  empty,
  widgetMgr,
  blockId,
  fragmentId,
  scriptRunState,
  scriptRunId,
  children,
}): ReactElement => {
  const { label, expanded: backendExpandedState, icon } = element
  const [isHovered, setIsHovered] = useState(false)

  // Check if this is a widget (dynamic expander with state tracking)
  const isWidget = Boolean(widgetMgr && blockId)

  // Track loading state: true when we're waiting for backend content after opening
  const [isLoadingContent, setIsLoadingContent] = useState(false)

  // Track the scriptRunId when loading started - used to detect when the
  // script run that would populate content has completed
  const loadingStartScriptRunIdRef = useRef<string | null>(null)

  // Clear loading state if expander becomes non-empty (content arrived)
  useEffect(() => {
    if (!empty && isLoadingContent) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing with external system (backend content)
      setIsLoadingContent(false)
    }
  }, [empty, isLoadingContent])

  // Clear loading state when script run completes (for empty expanders)
  useEffect(() => {
    // Clear loading when script run completes
    // scriptRunId is captured synchronously in handleWidgetToggle before triggering rerun
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

  // Callback to notify backend of toggle (only used in widget mode)
  const handleWidgetToggle = useCallback(
    (newOpen: boolean): void => {
      // If opening a widget expander with empty content, show loading state
      // Capture scriptRunId synchronously BEFORE triggering rerun to avoid race condition
      if (isWidget && newOpen && empty) {
        setIsLoadingContent(true)
        loadingStartScriptRunIdRef.current = scriptRunId
      } else {
        setIsLoadingContent(false)
        loadingStartScriptRunIdRef.current = null
      }

      // Send state update to backend - must happen AFTER capturing scriptRunId
      if (widgetMgr && blockId) {
        widgetMgr.setBoolValue(
          { id: blockId },
          newOpen,
          { fromUi: true },
          fragmentId
        )
      }
    },
    [widgetMgr, blockId, fragmentId, isWidget, empty, scriptRunId]
  )

  // Delegate all animation/state logic to hook
  const { isOpen, detailsRef, summaryRef, contentRef, handleToggle } =
    useDetailsAnimation({
      backendOpen: backendExpandedState ?? false,
      label,
      onToggle: widgetMgr && blockId ? handleWidgetToggle : undefined,
    })

  // Icon display logic
  const showChevron = !icon || isHovered
  const showUserIcon = icon && !isHovered

  const userKey = getKeyFromId(blockId)

  return (
    <StyledExpandableContainer
      className={classNames("stExpander", convertKeyToClassName(userKey))}
      data-testid="stExpander"
    >
      <StyledDetails
        isStale={isStale}
        ref={detailsRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <StyledSummary
          onClick={handleToggle}
          ref={summaryRef}
          isStale={isStale}
          expanded={isOpen}
        >
          <StyledSummaryHeading>
            {showChevron && (
              <DynamicIcon
                iconValue={
                  isOpen
                    ? ":material/keyboard_arrow_down:"
                    : ":material/keyboard_arrow_right:"
                }
                size="lg"
              />
            )}
            {showUserIcon && <ExpanderIcon icon={icon} />}

            <StyledSummaryLabelWrapper>
              <StreamlitMarkdown
                source={label}
                allowHTML={false}
                isLabel
                largerLabel
              />
            </StyledSummaryLabelWrapper>
          </StyledSummaryHeading>
        </StyledSummary>
        <StyledDetailsPanel data-testid="stExpanderDetails" ref={contentRef}>
          {isLoadingContent ? <TextLineSkeleton width="100%" /> : children}
        </StyledDetailsPanel>
      </StyledDetails>
    </StyledExpandableContainer>
  )
}

export default memo(Expander)
