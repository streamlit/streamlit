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

import { DynamicIcon } from "~lib/components/shared/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown"

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

export interface StepProps {
  element: BlockProto.Step
  isLastStep?: boolean
}

const Step: React.FC<React.PropsWithChildren<StepProps>> = ({
  element,
  isLastStep = false,
  children,
}): ReactElement => {
  const {
    label,
    description,
    icon,
    state,
    expanded: initialExpanded,
  } = element
  const hasChildren = Boolean(children)

  const [isExpanded, setIsExpanded] = useState<boolean>(
    initialExpanded ?? true
  )
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    if (initialExpanded !== undefined && initialExpanded !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing with external backend value
      setIsExpanded(initialExpanded)
    }
  }, [initialExpanded])

  const handleToggle = useCallback((): void => {
    if (hasChildren) {
      setIsExpanded(prev => !prev)
    }
  }, [hasChildren])

  const handleMouseEnter = useCallback((): void => {
    setIsHovered(true)
  }, [])

  const handleMouseLeave = useCallback((): void => {
    setIsHovered(false)
  }, [])

  // Show chevron instead of icon when hovering and has children
  const showChevron = hasChildren && isHovered
  const chevronIcon = isExpanded
    ? ":material/keyboard_arrow_down:"
    : ":material/keyboard_arrow_right:"

  return (
    <StyledStep
      className="stStep"
      data-testid="stStep"
      state={state}
      data-state={BlockProto.Step.State[state]}
    >
      <StyledStepIconColumn>
        {!isLastStep && <StyledStepConnector />}
        <StyledStepIconWrapper state={state} isHovered={showChevron}>
          <DynamicIcon
            iconValue={showChevron ? chevronIcon : icon || ":material/circle:"}
            size="lg"
          />
        </StyledStepIconWrapper>
      </StyledStepIconColumn>
      <StyledStepContent>
        <StyledStepHeader
          onClick={handleToggle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          role={hasChildren ? "button" : undefined}
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
              <StyledStepDescription state={state}>
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
