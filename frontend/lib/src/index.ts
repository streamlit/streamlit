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

// These imports are each exported specifically in order to minimize public apis.
export { AppRoot, BlockNode, ElementNode } from "./AppNode"
export { IS_DEV_ENV, WEBSOCKET_PORT_DEV } from "./baseconsts"
export { default as VerticalBlock } from "./components/core/Block"
export type { BlockPropsWithoutWidth } from "./components/core/Block"
export { default as ElementNodeRenderer } from "./components/core/Block/ElementNodeRenderer"
export type { ElementNodeRendererProps } from "./components/core/Block/ElementNodeRenderer"
export { default as IsDialogContext } from "./components/core/IsDialogContext"
export { default as IsSidebarContext } from "./components/core/IsSidebarContext"
export { LibContext } from "./components/core/LibContext"
export type { LibConfig, LibContextProps } from "./components/core/LibContext"
export { default as ThemeProvider } from "./components/core/ThemeProvider"
export { default as AlertElement } from "./components/elements/AlertElement"
export { handleFavicon } from "./components/elements/Favicon"
export { default as TextElement } from "./components/elements/TextElement"
export {
  default as BaseButton,
  BaseButtonKind,
} from "./components/shared/BaseButton"
export { default as BaseColorPicker } from "./components/shared/BaseColorPicker"
export { default as UISelectbox } from "./components/shared/Dropdown/Selectbox"
export { EmojiIcon, default as Icon } from "./components/shared/Icon"
export {
  default as Modal,
  ModalBody,
  ModalButton,
  ModalFooter,
  ModalHeader,
} from "./components/shared/Modal"
export { default as StreamlitMarkdown } from "./components/shared/StreamlitMarkdown"
export { Small } from "./components/shared/TextElements"
export { Placement, default as Tooltip } from "./components/shared/Tooltip"
export { ComponentRegistry } from "./components/widgets/CustomComponent"
export { Quiver } from "./dataframes/Quiver"
export { FileUploadClient } from "./FileUploadClient"
export { ForwardMsgCache } from "./ForwardMessageCache"
export { default as useScrollToBottom } from "./hooks/useScrollToBottom"
export { default as HostCommunicationManager } from "./hostComm"
export { HOST_COMM_VERSION } from "./hostComm/HostCommunicationManager"
export type {
  AppConfig,
  DeployedAppMetadata,
  IGuestToHostMessage,
  IHostConfigResponse,
  IMenuItem,
  IToolbarItem,
} from "./hostComm/types"
export {
  mockEndpoints,
  mockSessionInfo,
  mockSessionInfoProps,
} from "./mocks/mocks"
export { mockTheme } from "./mocks/mockTheme"
export { PerformanceEvents } from "./profiler/PerformanceEvents"
export * from "./proto"
export { RootStyleProvider } from "./RootStyleProvider"
export { ScriptRunState } from "./ScriptRunState"
export { SessionInfo } from "./SessionInfo"
export type {
  JWTHeader,
  StreamlitEndpoints,
  FileUploadClientConfig,
} from "./StreamlitEndpoints"
export { mockWindowLocation, render } from "./test_util"
export {
  AUTO_THEME_NAME,
  CUSTOM_THEME_NAME,
  baseTheme,
  createAutoTheme,
  createPresetThemes,
  createTheme,
  darkTheme,
  getCachedTheme,
  getDefaultTheme,
  getHostSpecifiedTheme,
  globalStyles,
  hasLightBackgroundColor,
  isPresetTheme,
  lightTheme,
  removeCachedTheme,
  setCachedTheme,
  toExportedTheme,
  toThemeInput,
} from "./theme"
export type { EmotionTheme, PresetThemeName, ThemeConfig } from "./theme"
export { default as emotionLightTheme } from "./theme/emotionLightTheme"
export { fonts, spacing } from "./theme/primitives"
export { ensureError } from "./util/ErrorHandling"
export { useIsOverflowing } from "./util/Hooks"
export { logAlways, logError, logMessage, logWarning } from "./util/log"
export { default as Resolver } from "./util/Resolver"
export { LocalStore, localStorageAvailable } from "./util/storageUtils"
export { Timer } from "./util/Timer"
export {
  buildHttpUri,
  buildWsUri,
  getPossibleBaseUris,
  makePath,
} from "./util/UriUtil"
export type { BaseUriParts } from "./util/UriUtil"
export {
  extractPageNameFromPathName,
  generateUID,
  getCookie,
  getElementId,
  getEmbeddingIdClassName,
  getIFrameEnclosingApp,
  hashString,
  isColoredLineDisplayed,
  isDarkThemeInQueryParams,
  isEmbed,
  isInChildFrame,
  isLightThemeInQueryParams,
  isPaddingDisplayed,
  isScrollingHidden,
  isToolbarDisplayed,
  makeElementWithInfoText,
  notUndefined,
  setCookie,
} from "./util/utils"
export { WidgetStateManager, createFormsData } from "./WidgetStateManager"
export type { FormsData } from "./WidgetStateManager"
