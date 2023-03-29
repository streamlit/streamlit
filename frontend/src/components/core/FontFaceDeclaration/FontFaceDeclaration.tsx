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

import { Global, css } from "@emotion/react"

export interface FontFaceDeclarationProps {
  fontFaces: object[]
}

const FontFaceDeclaration = ({ fontFaces }: FontFaceDeclarationProps) => {
  const fontMarkup = fontFaces.map((font: any) => {
    const { family, weight, url } = font

    return `
      @font-face {
        font-family: ${family};
        font-weight: ${weight};
        font-style: normal;
        font-display: swap;
        src: url(${url}) format("woff2");
      }
    `
  })

  return (
    <Global
      styles={css`
        ${fontMarkup}
      `}
    />
  )
}

export default FontFaceDeclaration
