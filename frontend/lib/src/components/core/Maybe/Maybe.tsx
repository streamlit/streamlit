/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
import React, { memo, PropsWithChildren } from "react"

interface MaybeProps
  extends PropsWithChildren<{
    enable: boolean
  }> {}

const Maybe: React.FC<MaybeProps> = memo(
  function Maybe({ children }) {
    return <>{children}</>
  },
  (prevProps, nextProps) => {
    // If either prevProps.enable OR nextProps.enable is true, we want to update
    // the component. In order to do so, we return false to indicate that props
    // are not the same. This ensures that we rerender in the case that an
    // Element is removed by replacing it with an empty one (so goes from
    // enabled->disabled).
    return !(prevProps.enable || nextProps.enable)
  }
)

export default Maybe
