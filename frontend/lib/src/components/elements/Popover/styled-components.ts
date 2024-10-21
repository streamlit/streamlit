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

export const StyledPopoverButtonIcon = styled.div(({ theme }) => ({
  marginLeft: theme.spacing.threeXS,
  // This is a hacky way to offset the "padding" of the expansion svg
  // icon. Reason is that we want to use the same padding to the right side
  // as the text on the left side. The alternative would be to overwrite the
  // right padding of the button, which would also be hacky and involve slightly
  // more logic.
  // If the padding of the icon changes, this value needs to be adjusted.
  // Also, if we want to apply the same adjustment for other elements, we should
  // consider putting this into a theme variable or creating a shared styled component.
  // The SVG icon we are using seems to have an internal padding of around 25%.
  marginRight: `calc(-${theme.iconSizes.lg} * 0.25)`,
}))
