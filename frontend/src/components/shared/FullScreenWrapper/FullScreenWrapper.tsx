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

import React, { PureComponent } from "react"
import Icon from "../Icon"
import { SCSS_VARS } from "autogen/scssVariables"
import "./FullScreenWrapper.scss"

export type Size = {
  height?: number
  width: number
}

/*
 * Function responsible for rendering children.
 * This function should implement the following signature:
 * ({ height, width }) => PropTypes.element
 */
interface Props {
  children: (props: Size) => React.ReactNode
  width: number
  height?: number
}

interface State {
  expanded: boolean
  fullwidth: number
  fullheight: number
}

/*
 * A component that draws a button on the top right of the
 * wrapper element. OnClick, change the element container
 * to fixed and cover all screen, updating wrapped element height and width
 */
class FullScreenWrapper extends PureComponent<Props, State> {
  static isFullScreen = false

  public state: State = { expanded: false, fullwidth: 0, fullheight: 0 }

  componentDidMount(): void {
    this.updateWindowDimensions()
    window.addEventListener("resize", this.updateWindowDimensions)
    document.addEventListener("keydown", this.controlKeys, false)
  }

  componentWillUnmount(): void {
    window.removeEventListener("resize", this.updateWindowDimensions)
    document.removeEventListener("keydown", this.controlKeys, false)
  }

  controlKeys = (event: any): void => {
    const { expanded } = this.state

    if (event.keyCode === 27 && expanded) {
      // Exit fullscreen
      this.zoomOut()
    }
  }

  zoomIn = (): void => {
    document.body.style.overflow = "hidden"
    FullScreenWrapper.isFullScreen = true
    this.setState({ expanded: true })
  }

  zoomOut = (): void => {
    document.body.style.overflow = "unset"
    FullScreenWrapper.isFullScreen = false
    this.setState({ expanded: false })
  }

  convertScssRemValueToPixels = (scssValue: string): number => {
    const remValue = parseFloat(scssValue)
    return (
      remValue *
      parseFloat(getComputedStyle(document.documentElement).fontSize)
    )
  }

  updateWindowDimensions = (): void => {
    const padding = this.convertScssRemValueToPixels(
      SCSS_VARS["$fullscreen-padding"]
    )
    const paddingTop = this.convertScssRemValueToPixels(
      SCSS_VARS["$fullscreen-padding-top"]
    )
    this.setState({
      fullwidth: window.innerWidth - padding * 2, // Left and right
      fullheight: window.innerHeight - (padding + paddingTop), // Bottom and Top
    })
  }

  public render(): JSX.Element {
    const { expanded, fullwidth, fullheight } = this.state
    const { children, width, height } = this.props

    let buttonClassName = "overlayBtn stButton-enter"
    let buttonImage = "fullscreen-enter"
    let buttonOnClick = this.zoomIn
    let buttonTitle = "View fullscreen"

    if (expanded) {
      buttonClassName = "overlayBtn stButton-exit"
      buttonImage = "fullscreen-exit"
      buttonOnClick = this.zoomOut
      buttonTitle = "Exit fullscreen"
    }

    return (
      <div className={`fullScreenFrame${expanded ? "--expanded" : ""}`}>
        <button
          className={buttonClassName}
          onClick={buttonOnClick}
          title={buttonTitle}
        >
          <Icon type={buttonImage} />
        </button>
        {expanded
          ? children({ width: fullwidth, height: fullheight })
          : children({ width, height })}
      </div>
    )
  }
}

export default FullScreenWrapper
