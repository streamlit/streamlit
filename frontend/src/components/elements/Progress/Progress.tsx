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

import React, { PureComponent, ReactNode } from "react"
import { Map as ImmutableMap } from "immutable"
import { Progress as UIProgress } from "reactstrap"

import "./Progress.scss"

export interface Props {
  width: number
  element: ImmutableMap<string, any>
}

export const FAST_UPDATE_MS = 50

class Progress extends PureComponent<Props> {
  lastValue = -1
  lastAnimatedTime = -1

  isMovingBackwards = (): boolean => {
    const { element } = this.props
    const value = element.get("value")

    return value < this.lastValue
  }

  isMovingSuperFast = (startTime: number, endTime: number): boolean => {
    return startTime - endTime < FAST_UPDATE_MS
  }

  // Checks if the browser tab is visible and active
  isBrowserTabVisible = (): boolean => document.visibilityState === "hidden"

  // Make progress bar stop acting weird when moving backwards or quickly.
  shouldUseTransition = (startTime: number, endTime: number): boolean => {
    return (
      this.isMovingBackwards() ||
      this.isMovingSuperFast(startTime, endTime) ||
      this.isBrowserTabVisible()
    )
  }

  public render(): ReactNode {
    const { element, width } = this.props
    const value = element.get("value")
    const time = new Date().getTime()

    const className = this.shouldUseTransition(time, this.lastAnimatedTime)
      ? "without-transition"
      : "with-transition"

    if (className === "with-transition") {
      this.lastAnimatedTime = time
    }
    this.lastValue = value

    return (
      <UIProgress
        value={value}
        className={"stProgress " + className}
        style={{ width }}
      />
    )
  }
}

export default Progress
