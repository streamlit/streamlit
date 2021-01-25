/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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

const sidebar = 100
const menuButton = sidebar + 10
const balloons = 1000000
const header = balloons + 20
const sidebarMobile = balloons + 30
const popupMenu = balloons + 40
const fullscreenWrapper = balloons + 50

export const zIndices = {
  hide: -1,
  auto: "auto",
  base: 0,
  sidebar,
  menuButton,
  balloons,
  header,
  sidebarMobile,
  popupMenu,
  fullscreenWrapper,
}
