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

import { FC, memo } from "react"

import type { BidiComponent as BidiComponentProto } from "@streamlit/protobuf"

import { BidiComponentContextProvider } from "~lib/components/widgets/BidiComponent/BidiComponentContextProvider"
import { IsolatedComponent } from "~lib/components/widgets/BidiComponent/IsolatedComponent"
import { NonIsolatedComponent } from "~lib/components/widgets/BidiComponent/NonIsolatedComponent"
import { ThemeCssProvider } from "~lib/components/widgets/BidiComponent/ThemeCssProvider"
import type { ComponentRegistry } from "~lib/components/widgets/CustomComponent"
import type { WidgetStateManager } from "~lib/WidgetStateManager"

import { StyledBidiComponentWrapper } from "./styled-components"

type BidiComponentProps = {
  element: BidiComponentProto
  widgetMgr: WidgetStateManager
  fragmentId: string | undefined
  componentRegistry: ComponentRegistry
}

const BidiComponent: FC<BidiComponentProps> = ({
  element,
  widgetMgr,
  fragmentId,
  componentRegistry,
}) => {
  const { isolateStyles } = element

  return (
    <BidiComponentContextProvider
      element={element}
      widgetMgr={widgetMgr}
      fragmentId={fragmentId}
      componentRegistry={componentRegistry}
    >
      <StyledBidiComponentWrapper className="stBidiComponent">
        <ThemeCssProvider>
          {isolateStyles ? <IsolatedComponent /> : <NonIsolatedComponent />}
        </ThemeCssProvider>
      </StyledBidiComponentWrapper>
    </BidiComponentContextProvider>
  )
}

export default memo(BidiComponent)
