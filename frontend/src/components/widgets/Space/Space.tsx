/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
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
import { Space as SpaceProto } from "src/autogen/proto"
import { WidgetStateManager } from "src/lib/WidgetStateManager"

export interface Props {
  element: SpaceProto
  widgetMgr: WidgetStateManager
  width: number
}

class Space extends React.PureComponent<Props> {
  public render(): React.ReactNode {
    const { element } = this.props
    const { size } = element

    let divSize = "0rem"

    if (size === "small") {
      divSize = "1rem"
    } else if (size === "medium") {
      divSize = "4rem"
    } else if (size === "large") {
      divSize = "16rem"
    }

    return (
      <div
        data-testid="stSpace"
        style={{
          width: divSize,
          height: divSize,
          backgroundColor: "red",
        }}
      ></div>
    )
  }
}

export default Space
