/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

import React, { ReactElement } from "react"
import { styled } from "styletron-react"
import classNames from "classnames"
import { iconSizes, sizes } from "lib/widgetTheme"
import "./MaterialIcon.scss"

interface Props {
  icon: string
  type?: string
  className?: string
  size?: sizes
}

export const StyledMaterialIcon = styled("i", (props: { size: sizes }) => ({
  fontSize: iconSizes[props.size],
}))

const MaterialIcon = ({
  icon,
  type,
  className,
  size = sizes.small,
}: Props): ReactElement => (
  <StyledMaterialIcon
    className={classNames(
      `material-${type ? `${type}-` : ""}icons`,
      className
    )}
    aria-hidden="true"
    size={size}
  >
    {icon}
  </StyledMaterialIcon>
)

export default MaterialIcon
