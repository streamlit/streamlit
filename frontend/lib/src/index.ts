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

// These imports are each exported specifically in order to minimize public apis.
export {
  IS_DEV_ENV,
  RERUN_PROMPT_MODAL_DIALOG,
  WEBSOCKET_PORT_DEV,
} from "./baseconsts"
export { default as VerticalBlock } from "./components/core/Block"
export { default as ElementNodeRenderer } from "./components/core/Block/ElementNodeRenderer"
export type { ElementNodeRendererProps } from "./components/core/Block/ElementNodeRenderer"
export type { BlockPropsWithoutWidth } from "./components/core/Block"
export type { StreamlitEndpoints } from "./StreamlitEndpoints"
export { SessionInfo } from "./SessionInfo"
export { ScriptRunState } from "./ScriptRunState"
export { WidgetStateManager, createFormsData } from "./WidgetStateManager"
export type { FormsData } from "./WidgetStateManager"
export { FileUploadClient } from "./FileUploadClient"
export { ComponentRegistry } from "./components/widgets/CustomComponent"
export { BlockNode, AppRoot, ElementNode } from "./AppNode"
export { Quiver } from "./dataframes/Quiver"
export type {
  DeployedAppMetadata,
  IGuestToHostMessage,
  IMenuItem,
  IHostConfigResponse,
  IToolbarItem,
  AppConfig,
} from "./hostComm/types"
export {
  default as Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalButton,
} from "./components/shared/Modal"
export { default as ThemeProvider } from "./components/core/ThemeProvider"
export { LocalStore, localStorageAvailable } from "./util/storageUtils"
export {
  createAutoTheme,
  createPresetThemes,
  CUSTOM_THEME_NAME,
  getCachedTheme,
  toExportedTheme,
  AUTO_THEME_NAME,
  getDefaultTheme,
  globalStyles,
  isPresetTheme,
  removeCachedTheme,
  setCachedTheme,
  createTheme,
  lightTheme,
  darkTheme,
  toThemeInput,
  baseTheme,
  hasLightBackgroundColor,
} from "./theme"
export { default as emotionLightTheme } from "./theme/emotionLightTheme"
export type { ThemeConfig, EmotionTheme } from "./theme"
export { mount, shallow, mockWindowLocation, render } from "./test_util"
export { logError, logMessage, logWarning, logAlways } from "./util/log"
export { getPossibleBaseUris, buildHttpUri, buildWsUri } from "./util/UriUtil"
export type { BaseUriParts } from "./util/UriUtil"
export { ensureError } from "./util/ErrorHandling"
export {
  default as BaseButton,
  BaseButtonKind,
} from "./components/shared/BaseButton"
export { PerformanceEvents } from "./profiler/PerformanceEvents"
export { ForwardMsgCache } from "./ForwardMessageCache"
export { default as Resolver } from "./util/Resolver"
export {
  mockSessionInfo,
  mockSessionInfoProps,
  mockEndpoints,
} from "./mocks/mocks"
export { default as UISelectbox } from "./components/shared/Dropdown/Selectbox"
export { default as Icon, EmojiIcon } from "./components/shared/Icon"
export { default as StreamlitMarkdown } from "./components/shared/StreamlitMarkdown"
export {
  hashString,
  generateUID,
  getElementWidgetID,
  getEmbeddingIdClassName,
  getIFrameEnclosingApp,
  isColoredLineDisplayed,
  isDarkTheme,
  isEmbed,
  isFooterDisplayed,
  isInChildFrame,
  isLightTheme,
  isPaddingDisplayed,
  isScrollingHidden,
  isToolbarDisplayed,
  notUndefined,
  setCookie,
  extractPageNameFromPathName,
  makeElementWithInfoText,
  getCookie,
} from "./util/utils"
export { useIsOverflowing } from "./util/Hooks"
export { LibContext } from "./components/core/LibContext"
export type { LibContextProps, LibConfig } from "./components/core/LibContext"
export { handleFavicon } from "./components/elements/Favicon"
export { default as HostCommunicationManager } from "./hostComm"
export { HOST_COMM_VERSION } from "./hostComm/HostCommunicationManager"
export { default as IsSidebarContext } from "./components/core/IsSidebarContext"
export { default as Tooltip, Placement } from "./components/shared/Tooltip"
export { default as BaseColorPicker } from "./components/shared/BaseColorPicker"
export { Timer } from "./util/Timer"
export { Small } from "./components/shared/TextElements"
export { spacing, fonts } from "./theme/primitives"
export { mockTheme } from "./mocks/mockTheme"
export { default as AlertElement } from "./components/elements/AlertElement"
export { default as TextElement } from "./components/elements/TextElement"
export { default as useScrollToBottom } from "./hooks/useScrollToBottom"
export { RootStyleProvider } from "./RootStyleProvider"
export * from "./proto"
