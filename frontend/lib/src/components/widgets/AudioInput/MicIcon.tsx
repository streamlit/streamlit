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

import * as React from "react"
const SvgComponent = (props: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={20}
    height={20}
    fill="none"
    {...props}
  >
    <path
      fill="#7D7F86"
      d="M10 11.666c1.383 0 2.5-1.116 2.5-2.5v-5c0-1.383-1.117-2.5-2.5-2.5a2.497 2.497 0 0 0-2.5 2.5v5c0 1.384 1.116 2.5 2.5 2.5Zm4.925-2.5c-.409 0-.75.3-.817.709A4.18 4.18 0 0 1 10 13.333 4.18 4.18 0 0 1 5.89 9.875a.832.832 0 0 0-.816-.709.837.837 0 0 0-.834.95 5.827 5.827 0 0 0 4.925 4.817v1.733c0 .459.375.834.834.834a.836.836 0 0 0 .833-.834v-1.733a5.827 5.827 0 0 0 4.925-4.816c.084-.5-.325-.95-.833-.95Z"
    />
  </svg>
)

export default SvgComponent
