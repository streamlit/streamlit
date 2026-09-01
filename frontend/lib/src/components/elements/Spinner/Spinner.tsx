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

import { memo, ReactElement, useEffect, useRef, useState } from "react"

import { Spinner as SpinnerProto } from "@streamlit/protobuf"

import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"

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
      className={cache ? "stSpinner stCacheSpinner" : "stSpinner"}
      data-testid="stSpinner"
      cache={cache}
    >
      <StyledSpinnerContainer>
        {/* `DynamicIcon` marks the spinner icon aria-hidden; the label below
            carries the accessible name. */}
        <DynamicIcon size="lg" iconValue="spinner" />
        <StyledSpinnerText>
          {/* Scope the live region to the label. `role="status"` implies
              `aria-atomic="true"`, and the elapsed time is rewritten every
              100ms, so a region spanning both would re-read the label on every
              tick. Outside the region, the time is still reachable on demand.

              This region mounts already populated, which many screen readers
              do not announce — the same trade-off as `SkillsInstallCallout`.
              Accepted here: the label is in the accessibility tree, where
              previously nothing was exposed. */}
          <div role="status">
            <StreamlitMarkdown source={element.text} allowHTML={false} />
          </div>
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
