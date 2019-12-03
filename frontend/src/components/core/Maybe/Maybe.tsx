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

import React from "react"
import { ReportRunState } from "../../../lib/ReportRunState"
import { Map as ImmutableMap } from "immutable"

type SimpleElement = ImmutableMap<string, any>

export interface Props {
  // reportRunState: ReportRunState
  enable: boolean
  // element: SimpleElement
}

export interface State {
  // count: number
  // oldElement: ReactElement | null
}

class Maybe extends React.Component<Props, State> {
  // public state: State = {
  //   count: 0,
  //   // oldElement: null
  // }

  // public componentDidUpdate(): void {
  //   if (this.state.count === 0) {
  //     this.setState((state, props) => ({
  //       count: state.count + 1,
  //     }))
  //   }
  //
  //   // const element = this.props.children
  //
  //   // this.setState((state, props) => ({
  //   //   count: 1,
  //   // }))
  // }

  public shouldComponentUpdate(
    nextProps: Readonly<Props>,
    nextState: Readonly<State>,
    nextContext: any
  ): boolean {
    console.log("state", this.state)
    console.log("props", this.props)
    console.log("props.children[1]", (this.props as any).children[1])
    console.log("nextState", nextState)
    console.log("nextProps", nextProps)
    console.log("nextProps.children[1]", (nextProps as any).children[1])
    // if (nextProps.reportRunState === ReportRunState.RUNNING) {
    //   const isEmpty = nextProps.element.get("type") !== "empty"
    //   console.log("isEmpty", isEmpty)
    //   return false
    // }
    return nextProps.enable
  }

  public render(): React.ReactNode {
    console.log("children", this.props.children)
    if (this.props.children == null) {
      throw "This is undefined"
    }
    return this.props.children
  }
}

export default Maybe
