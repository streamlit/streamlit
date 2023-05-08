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
import { keyframes } from "@emotion/react"

const screencastCounterAnimation = keyframes`
0% {
  opacity: 0;
}
25% {
  opacity: 1;
}
100% {
  opacity: 0;
}`

export const StyledCountdown = styled.div(({ theme }) => ({
  position: "fixed",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  top: 0,
  left: 0,
  width: theme.sizes.full,
  height: theme.sizes.full,
  fontSize: "40vh",
  color: theme.colors.red,
  fontWeight: theme.fontWeights.bold,
  opacity: "0.8",
  textShadow: `1px 1px 10px ${theme.colors.darkGray}`,
  transition: "opacity 0.3s ease-in-out",
  fontFamily: 'Helvetica, Calibri, Roboto, "Open Sans", Arial, sans-serif',
  animation: `${screencastCounterAnimation} 1s`,
}))
