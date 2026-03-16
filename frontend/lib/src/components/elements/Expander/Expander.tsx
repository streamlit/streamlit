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

import classNames from "classnames"

import { Block as BlockProto } from "@streamlit/protobuf"

import {
  convertKeyToClassName,
  getKeyFromId,
} from "~lib/components/core/Block/utils"
import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
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
  widgetMgr?: WidgetStateManager
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
  const { label, icon } = element
  const [isHovered, setIsHovered] = useState(false)

  // element.id is only set when the backend registers the expander as a
  // stateful widget (on_change="rerun"). block.id may still be set for
  // CSS key styling without implying widget mode.
  const widgetId = element.id || undefined
  const isWidget = Boolean(widgetMgr && widgetId)

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

  const { isOpen, detailsRef, summaryRef, contentRef, handleToggle } =
    useDetailsAnimation({
      backendExpanded: element.expanded,
      label,
      onToggle: isWidget ? handleWidgetToggle : undefined,
    })

  // Determine which icon to show
  const showChevron = !icon || isHovered
  const showUserIcon = icon && !isHovered

  const handleMouseEnter = (): void => {
    setIsHovered(true)
  }

  const handleMouseLeave = (): void => {
    setIsHovered(false)
  }

  const userKey = getKeyFromId(blockId)

  return (
    <StyledExpandableContainer
      className={classNames("stExpander", convertKeyToClassName(userKey))}
      data-testid="stExpander"
    >
      <StyledDetails
        isStale={isStale}
        ref={detailsRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
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
        <StyledDetailsPanel
          data-testid="stExpanderDetails"
          ref={contentRef}
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
