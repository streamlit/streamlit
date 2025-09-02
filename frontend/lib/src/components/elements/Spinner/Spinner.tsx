/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import React, { memo, ReactElement, useEffect, useRef, useState } from "react"

import classNames from "classnames"

import { Spinner as SpinnerProto } from "@streamlit/protobuf"

import { StyledSpinnerIcon } from "~lib/components/shared/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown"

import {
  StyledSpinner,
  StyledSpinnerContainer,
  StyledSpinnerText,
  StyledSpinnerTimeText,
} from "./styled-components"
import { formatTime } from "./utils"

export interface SpinnerProps {
  element: SpinnerProto
}

function Spinner({ element }: Readonly<SpinnerProps>): ReactElement {
  const { cache, showTime } = element
  const [elapsedTime, setElapsedTime] = useState(0)
  const initialTimeRef = useRef<number | null>(null)

  useEffect(() => {
    if (!showTime) return

    // Record the start time when the component mounts
    initialTimeRef.current = Date.now()

    const updateElapsedTime = (): void => {
      if (initialTimeRef.current !== null) {
        const currentTime = Date.now()
        const elapsed = (currentTime - initialTimeRef.current) / 1000 // Convert to seconds
        setElapsedTime(elapsed)
      }
    }

    // Update immediately
    updateElapsedTime()

    // Set up interval to update every 100ms
    const timer = setInterval(updateElapsedTime, 100)

    return () => clearInterval(timer)
  }, [showTime])

  return (
    <StyledSpinner
      className={classNames({ stSpinner: true, stCacheSpinner: cache })}
      data-testid="stSpinner"
      cache={cache}
    >
      <StyledSpinnerContainer>
        <StyledSpinnerIcon size="base" margin="0 md 0 0" padding="0" />
        <StyledSpinnerText>
          <StreamlitMarkdown source={element.text} allowHTML={false} />
          {showTime && (
            <StyledSpinnerTimeText>
              {formatTime(elapsedTime)}
            </StyledSpinnerTimeText>
          )}
        </StyledSpinnerText>
      </StyledSpinnerContainer>
    </StyledSpinner>
  )
}

export default memo(Spinner)
