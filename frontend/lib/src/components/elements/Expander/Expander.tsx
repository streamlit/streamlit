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
  useState,
} from "react"

import classNames from "classnames"

import { Block as BlockProto } from "@streamlit/protobuf"

import {
  convertKeyToClassName,
  getKeyFromId,
} from "~lib/components/core/Block/utils"
import { DynamicIcon } from "~lib/components/shared/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown"
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
  widgetMgr?: WidgetStateManager
  blockId?: string
  fragmentId?: string
}

const Expander: FC<PropsWithChildren<ExpanderProps>> = ({
  element,
  isStale,
  widgetMgr,
  blockId,
  fragmentId,
  children,
}): ReactElement => {
  const { label, expanded: backendExpandedState, icon } = element
  const [isHovered, setIsHovered] = useState(false)

  // Callback to notify backend of toggle (only used in widget mode)
  const handleWidgetToggle = useCallback(
    (newOpen: boolean): void => {
      if (widgetMgr && blockId) {
        widgetMgr.setBoolValue(
          { id: blockId },
          newOpen,
          { fromUi: true },
          fragmentId
        )
      }
    },
    [widgetMgr, blockId, fragmentId]
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
          {children}
        </StyledDetailsPanel>
      </StyledDetails>
    </StyledExpandableContainer>
  )
}

export default memo(Expander)
