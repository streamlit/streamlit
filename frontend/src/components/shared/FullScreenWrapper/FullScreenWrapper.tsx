/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
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

import { Button } from "reactstrap"
import openIconic from "assets/img/open-iconic.svg"

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
  static defaultProps: {
    Width: 0
  }

  public state: State = { expanded: false, fullwidth: 0, fullheight: 0 }

  componentDidMount() {
    this.updateWindowDimensions()
    window.addEventListener("resize", this.updateWindowDimensions)
    document.addEventListener("keydown", this.escFunction, false)
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.updateWindowDimensions)
    document.removeEventListener("keydown", this.escFunction, false)
  }

  escFunction = (event: any) => {
    const { expanded } = this.state
    if (event.keyCode === 27 && expanded) {
      this.zoomOut()
    }
  }

  zoomIn = () => {
    document.body.style.overflow = "hidden"
    this.setState({ expanded: true })
  }

  zoomOut = () => {
    document.body.style.overflow = "unset"
    this.setState({ expanded: false })
  }

  updateWindowDimensions = () => {
    this.setState({
      fullwidth: window.innerWidth - 60,
      fullheight: window.innerHeight - 120,
    })
  }

  public render(): JSX.Element {
    const { expanded, fullwidth, fullheight } = this.state
    const { children, width } = this.props

    return (
      <div className={`stFullScreenFrame${expanded ? "--expanded" : ""}`}>
        {expanded ? (
          <Button
            className={"stButton-exit"}
            outline
            size="sm"
            color="info"
            onClick={this.zoomOut}
          >
            <svg className="icon" viewBox="0 0 8 8">
              <use href={openIconic + "#fullscreen-exit"} />
            </svg>
          </Button>
        ) : (
          <Button
            className={"stButton-enter"}
            outline
            size="sm"
            color="info"
            onClick={this.zoomIn}
          >
            <svg className="icon" viewBox="0 0 8 8">
              <use href={openIconic + "#fullscreen-enter"} />
            </svg>
          </Button>
        )}
        {expanded
          ? children({ width: fullwidth, height: fullheight })
          : children({ width })}
      </div>
    )
  }
}

export default FullScreenWrapper
