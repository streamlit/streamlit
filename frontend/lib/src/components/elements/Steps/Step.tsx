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

import { memo, ReactElement, useCallback, useEffect, useState } from "react"

import { Block as BlockProto } from "@streamlit/protobuf"

import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { notNullOrUndefined } from "~lib/util/utils"

import {
  StyledStep,
  StyledStepBody,
  StyledStepConnector,
  StyledStepContent,
  StyledStepDescription,
  StyledStepHeader,
  StyledStepHeaderContent,
  StyledStepIconColumn,
  StyledStepIconWrapper,
  StyledStepLabel,
} from "./styled-components"

interface StepProps {
  element: BlockProto.Step
  empty: boolean
}

const Step: React.FC<React.PropsWithChildren<StepProps>> = ({
  element,
  empty,
  children,
}): ReactElement => {
  const {
    label,
    description,
    icon,
    state,
    expanded: initialExpanded,
  } = element
  // Only allow expand/collapse if the step has actual content
  const hasChildren = !empty

  const [isExpanded, setIsExpanded] = useState(initialExpanded ?? true)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    if (notNullOrUndefined(initialExpanded)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing with external backend value
      setIsExpanded(initialExpanded)
    }
  }, [initialExpanded])

  const handleToggle = useCallback((): void => {
    if (hasChildren) {
      setIsExpanded(prev => !prev)
    }
  }, [hasChildren])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): void => {
      if (hasChildren && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault()
        setIsExpanded(prev => !prev)
      }
    },
    [hasChildren]
  )

  // Show chevron instead of icon when hovering and has children
  const showChevron = hasChildren && isHovered
  const chevronIcon = isExpanded
    ? ":material/keyboard_arrow_down:"
    : ":material/keyboard_arrow_right:"

  // Determine which icon to show:
  // 1. Chevron when hovering expandable step (overrides all other icons)
  // 2. Icon from backend (already derived from state if not custom)
  const displayIcon = showChevron ? chevronIcon : icon || ":material/circle:"

  return (
    <StyledStep
      className="stStep"
      data-testid="stStep"
      state={state}
      data-state={BlockProto.Step.State[state]}
      role="listitem"
    >
      <StyledStepIconColumn>
        <StyledStepConnector data-testid="stStepConnector" />
        <StyledStepIconWrapper isHovered={showChevron}>
          <DynamicIcon iconValue={displayIcon} size="lg" />
        </StyledStepIconWrapper>
      </StyledStepIconColumn>
      <StyledStepContent>
        <StyledStepHeader
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          role={hasChildren ? "button" : undefined}
          tabIndex={hasChildren ? 0 : undefined}
          aria-expanded={hasChildren ? isExpanded : undefined}
          hasChildren={hasChildren}
        >
          <StyledStepHeaderContent>
            <StyledStepLabel>
              <StreamlitMarkdown
                source={label}
                allowHTML={false}
                isLabel
                largerLabel
              />
            </StyledStepLabel>
            {description && (
              <StyledStepDescription>
                <StreamlitMarkdown
                  source={description}
                  allowHTML={false}
                  isLabel
                />
              </StyledStepDescription>
            )}
          </StyledStepHeaderContent>
        </StyledStepHeader>
        {isExpanded && hasChildren && (
          <StyledStepBody data-testid="stStepBody">{children}</StyledStepBody>
        )}
      </StyledStepContent>
    </StyledStep>
  )
}

export default memo(Step)
