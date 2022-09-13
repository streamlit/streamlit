/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import styled from "@emotion/styled"

export const StyledGraphVizChart = styled.div(({ theme }) => ({
  "& *": {
    fontFamily: theme.genericFonts.bodyFont,
    // Font sizes inside the SVG element are getting huge for some reason.
    // Hacking together a number by eyeballing it:
    // 12px in the SVG looks like 1rem outside, so 9.6px ~= 0.8rem.
    fontSize: "9.6px",
  },
  "& svg": {
    maxWidth: "100%",
  },
}))
