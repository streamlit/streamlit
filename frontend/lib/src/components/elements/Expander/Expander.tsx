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

import { memo, ReactElement, useCallback, useState } from "react"

import { Block as BlockProto } from "@streamlit/protobuf"
import { notNullOrUndefined } from "@streamlit/utils"

import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { useExecuteWhenChanged } from "~lib/hooks/useExecuteWhenChanged"
import useWidgetManagerElementState from "~lib/hooks/useWidgetManagerElementState"
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

interface ExpanderIconProps {
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
const ExpanderIcon = (props: ExpanderIconProps): ReactElement => {
  const { icon } = props

  const statusIconTestIds: Record<string, string> = {
    ":material/check:": "stExpanderIconCheck",
    ":material/error:": "stExpanderIconError",
    spinner: "stExpanderIconSpinner",
  }

  return icon ? (
    <DynamicIcon
      size="base"
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
  widgetMgr: WidgetStateManager
  /** Block-level ID for CSS key styling (may be set without widget mode). */
  blockId?: string
  fragmentId?: string
}

const Expander: React.FC<React.PropsWithChildren<ExpanderProps>> = ({
  element,
  isStale,
  widgetMgr,
  blockId,
  fragmentId,
  children,
}): ReactElement => {
  const { label, icon, type } = element
  const [isHovered, setIsHovered] = useState(false)

  // element.id is only set when the backend registers the expander as a
  // stateful widget (on_change="rerun"). block.id may still be set for
  // CSS key styling without implying widget mode.
  const widgetId = element.id || undefined
  const isWidget = Boolean(widgetMgr && widgetId)
  const isPassivelyKeyed = Boolean(blockId) && !isWidget

  // Persist expanded state across remounts via elementStates.
  // The hook is always called (Rules of Hooks) but only effective when
  // isPassivelyKeyed — otherwise the empty id produces a no-op entry.
  const [storedExpanded, setStoredExpanded] =
    useWidgetManagerElementState<boolean>({
      widgetMgr,
      id: isPassivelyKeyed ? (blockId ?? "") : "",
      key: "expanded",
      defaultValue: element.expanded ?? false,
    })

  const initialExpanded = isPassivelyKeyed ? storedExpanded : element.expanded

  // Sync widget manager state when the backend programmatically changes the
  // expanded value (e.g. st.session_state.key = False). Without this, the
  // widget manager retains the stale value and sends it back on the next
  // rerun, causing the expander to revert to its old state.
  useExecuteWhenChanged(() => {
    if (!widgetId || !notNullOrUndefined(element.expanded)) {
      return
    }
    widgetMgr.setBoolValue(
      { id: widgetId },
      element.expanded,
      { fromUi: false },
      fragmentId
    )
  }, [widgetId, element.expanded])

  // Callback to notify backend of toggle (only used in widget mode)
  const handleWidgetToggle = useCallback(
    (newOpen: boolean): void => {
      if (widgetMgr && widgetId) {
        widgetMgr.setBoolValue(
          { id: widgetId },
          newOpen,
          { fromUi: true },
          fragmentId
        )
      }
    },
    [widgetMgr, widgetId, fragmentId]
  )

  // Callback for passive persistence (only when passively keyed)
  const handlePersistToggle = useCallback(
    (newOpen: boolean): void => {
      setStoredExpanded(newOpen)
    },
    [setStoredExpanded]
  )

  const onToggle = isWidget
    ? handleWidgetToggle
    : isPassivelyKeyed
      ? handlePersistToggle
      : undefined

  const isCompact = type === BlockProto.Expandable.Type.COMPACT

  // Leading icon logic: normal mode swaps between chevron and user icon on hover;
  // compact mode always shows user icon (if any) since the chevron is trailing.
  const showLeadingChevron = !isCompact && (!icon || isHovered)
  const showLeadingUserIcon = isCompact ? Boolean(icon) : icon && !isHovered

  const { isOpen, detailsRef, summaryRef, contentRef, handleToggle } =
    useDetailsAnimation({
      backendExpanded: initialExpanded,
      label,
      onToggle,
      isCompact,
    })

  const handleMouseEnter = (): void => {
    setIsHovered(true)
  }

  const handleMouseLeave = (): void => {
    setIsHovered(false)
  }

  return (
    <StyledExpandableContainer className="stExpander" data-testid="stExpander">
      <StyledDetails
        isStale={isStale}
        isCompact={isCompact}
        ref={detailsRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <StyledSummary
          onClick={handleToggle}
          ref={summaryRef}
          isStale={isStale}
          expanded={isOpen}
          isCompact={isCompact}
        >
          <StyledSummaryHeading>
            {showLeadingChevron && (
              <DynamicIcon
                iconValue={
                  isOpen
                    ? ":material/keyboard_arrow_down:"
                    : ":material/keyboard_arrow_right:"
                }
                size="base"
              />
            )}
            {showLeadingUserIcon && <ExpanderIcon icon={icon} />}

            <StyledSummaryLabelWrapper isCompact={isCompact}>
              <StreamlitMarkdown source={label} allowHTML={false} isLabel />
            </StyledSummaryLabelWrapper>

            {/* Trailing chevron for compact mode (uses chevron_right for tighter appearance) */}
            {isCompact && (
              <DynamicIcon
                iconValue={
                  isOpen
                    ? ":material/keyboard_arrow_down:"
                    : ":material/chevron_right:"
                }
                size="lg"
              />
            )}
          </StyledSummaryHeading>
        </StyledSummary>
        <StyledDetailsPanel
          data-testid="stExpanderDetails"
          ref={contentRef}
          isCompact={isCompact}
          // Exclude collapsed content from browser find-in-page (Cmd+F) searches.
          // Using "" instead of true for consistent behavior in jsdom tests.
          inert={!isOpen ? "" : undefined}
        >
          {children}
        </StyledDetailsPanel>
      </StyledDetails>
    </StyledExpandableContainer>
  )
}

export default memo(Expander)
