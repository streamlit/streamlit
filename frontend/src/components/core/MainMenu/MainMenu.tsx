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

import React, { ReactElement, useState, memo } from "react"
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from "reactstrap"

import useS4ACommunication from "hooks/useS4ACommunication"

import Icon from "components/shared/Icon"
import ScreencastOption from "./component/ScreencastOption"

import "./MainMenu.scss"

const ONLINE_DOCS_URL = "https://docs.streamlit.io"
const COMMUNITY_URL = "https://discuss.streamlit.io"
const TEAMS_URL = "https://streamlit.io/forteams"
const BUG_URL = "https://github.com/streamlit/streamlit/issues/new/choose"

interface Props {
  /** True if report sharing is properly configured and enabled. */
  sharingEnabled: boolean

  /** True if we're connected to the Streamlit server. */
  isServerConnected: () => boolean

  /** Rerun the report. */
  quickRerunCallback: () => void

  /** Clear the cache. */
  clearCacheCallback: () => void

  /** Show the screen recording dialog. */
  screencastCallback: () => void

  /** Share the report to S3. */
  shareCallback: () => void

  /** Show the Settings dialog. */
  settingsCallback: () => void

  /** Show the About dialog. */
  aboutCallback: () => void

  screenCastState: string
}

const getOpenInWindowCallback = (url: string) => (): void => {
  window.open(url, "_blank")
}

function MainMenu(props: Props): ReactElement {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const { items, sendMessage } = useS4ACommunication()
  const isServerDisconnected = !props.isServerConnected()

  function toggleDropdown(): void {
    setDropdownOpen(prevState => !prevState)
  }

  const S4AMenuOptions = items.map(item => {
    if (item.type === "separator") {
      return <DropdownItem divider />
    }

    return (
      <DropdownItem
        key={item.key}
        onClick={() =>
          sendMessage({
            type: "MENU_ITEM_CALLBACK",
            key: item.key,
          })
        }
      >
        <span>{item.label}</span>
      </DropdownItem>
    )
  })

  const shouldShowS4AMenu = !!S4AMenuOptions.length

  const coreMenuOptions = {
    rerun: (
      <DropdownItem
        disabled={isServerDisconnected}
        onClick={props.quickRerunCallback}
      >
        <span>Rerun</span>
        <span className="shortcut">R</span>
      </DropdownItem>
    ),
    clearCache: (
      <DropdownItem
        disabled={isServerDisconnected}
        onClick={props.clearCacheCallback}
      >
        <span>Clear cache</span>
        <span className="shortcut">C</span>
      </DropdownItem>
    ),
    divider: <DropdownItem divider />,
    recordScreencast: (
      <ScreencastOption
        screenCastState={props.screenCastState}
        onClick={props.screencastCallback}
      />
    ),
    saveSnapshot: (
      <DropdownItem
        disabled={isServerDisconnected}
        onClick={props.shareCallback}
      >
        Save a snapshot
      </DropdownItem>
    ),
    documentation: (
      <DropdownItem onClick={getOpenInWindowCallback(ONLINE_DOCS_URL)}>
        Documentation
      </DropdownItem>
    ),
    community: (
      <DropdownItem onClick={getOpenInWindowCallback(COMMUNITY_URL)}>
        Ask a question
      </DropdownItem>
    ),
    report: (
      <DropdownItem onClick={getOpenInWindowCallback(BUG_URL)}>
        Report a bug
      </DropdownItem>
    ),
    s4t: (
      <DropdownItem onClick={getOpenInWindowCallback(TEAMS_URL)}>
        Streamlit for Teams
      </DropdownItem>
    ),
    settings: (
      <DropdownItem onClick={props.settingsCallback}>Settings</DropdownItem>
    ),
    about: <DropdownItem onClick={props.aboutCallback}>About</DropdownItem>,
  }

  let menuOptions = [coreMenuOptions.rerun, coreMenuOptions.clearCache]

  if (shouldShowS4AMenu) {
    menuOptions = [
      ...menuOptions,
      coreMenuOptions.settings,
      coreMenuOptions.divider,
      coreMenuOptions.recordScreencast,
      ...S4AMenuOptions,
    ]
  } else {
    menuOptions = [
      ...menuOptions,
      coreMenuOptions.divider,
      coreMenuOptions.recordScreencast,
      coreMenuOptions.divider,
      coreMenuOptions.documentation,
      coreMenuOptions.community,
      coreMenuOptions.report,
      coreMenuOptions.divider,
      coreMenuOptions.s4t,
      coreMenuOptions.settings,
      coreMenuOptions.about,
    ]
  }

  return (
    <Dropdown id="MainMenu" isOpen={dropdownOpen} toggle={toggleDropdown}>
      <DropdownToggle outline color="secondary" id="MainMenuButton">
        <Icon type="menu" />

        {props.screenCastState === "RECORDING" && (
          <span className="recording-indicator" />
        )}
      </DropdownToggle>

      <DropdownMenu right>{menuOptions}</DropdownMenu>
    </Dropdown>
  )
}

export default memo(MainMenu)
