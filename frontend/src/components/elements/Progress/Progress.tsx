/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement, useEffect, useState } from "react"
import { Map as ImmutableMap } from "immutable"
import { Progress as UIProgress } from "reactstrap"

import "./Progress.scss"

export interface ProgressProps {
  width: number
  element: ImmutableMap<string, any>
}

export const FAST_UPDATE_MS = 50

export default function Progress({
  width,
  element,
}: ProgressProps): ReactElement {
  const [lastValue, setLastValue] = useState(-1)

  const [lastAnimatedTime, setLastAnimatedTime] = useState(-1)

  const isMovingBackwards = (): boolean => {
    const value = element.get("value")
    return value < lastValue
  }

  const isMovingSuperFast = (startTime: number, endTime: number): boolean => {
    return startTime - endTime < FAST_UPDATE_MS
  }

  // Checks if the browser tab is visible and active
  const isBrowserTabVisible = (): boolean =>
    document.visibilityState === "hidden"

  // Make progress bar stop acting weird when moving backwards or quickly.
  const shouldUseTransition = (
    startTime: number,
    endTime: number
  ): boolean => {
    return (
      isMovingBackwards() ||
      isMovingSuperFast(startTime, endTime) ||
      isBrowserTabVisible()
    )
  }

  const value = element.get("value")
  const time = new Date().getTime()
  const className = shouldUseTransition(time, lastAnimatedTime)
    ? "without-transition"
    : "with-transition"
  useEffect(() => {
    if (className === "with-transition") {
      setLastAnimatedTime(time)
    }
    setLastValue(value)
  }, [time, className])

  return (
    <UIProgress
      value={value}
      className={`stProgress ${className}`}
      style={{ width }}
    />
  )
}
