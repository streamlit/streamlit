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

import { PureComponent, ReactNode } from "react"
import { Map as ImmutableMap } from "immutable"
import { getImageURI } from "../ImageList/ImageList"

export interface Props {
  element: ImmutableMap<string, any>
}

/**
 * Hidden element that overwrites the page's favicon with the provided image
 */
export class Favicon extends PureComponent<Props> {
  public render(): ReactNode {
    const { element } = this.props

    const faviconElement: HTMLLinkElement | null = document.querySelector(
      "link[rel='shortcut icon']"
    )

    if (faviconElement) {
      faviconElement.href = getImageURI(element)
      console.log("Fav: ", faviconElement.href)
    }

    return null
  }
}

export default Favicon
