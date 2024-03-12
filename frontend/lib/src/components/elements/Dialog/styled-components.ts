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

import styled from "@emotion/styled"

// TODO: this is duplicated from Sidebar.StyledSidebarUserContent => create a global styled component and use that here
// and in the Sidebar.
// change appearance of st.title, st.subheader etc.
export const StyledDialogContent = styled.div(({ theme }) => ({
  "& h1": {
    fontSize: theme.fontSizes.xl,
    fontWeight: 600,
  },

  "& h2": {
    fontSize: theme.fontSizes.lg,
    fontWeight: 600,
  },

  "& h3": {
    fontSize: theme.fontSizes.mdLg,
    fontWeight: 600,
  },

  "& h4": {
    fontSize: theme.fontSizes.md,
    fontWeight: 600,
  },

  "& h5": {
    fontSize: theme.fontSizes.sm,
    fontWeight: 600,
  },

  "& h6": {
    fontSize: theme.fontSizes.twoSm,
    fontWeight: 600,
  },
}))
