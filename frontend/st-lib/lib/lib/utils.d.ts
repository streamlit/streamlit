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
import { LabelVisibilityMessage as LabelVisibilityMessageProto, Element } from "src/autogen/proto";
/**
 * Wraps a function to allow it to be called, at most, once per interval
 * (specified in milliseconds). If the wrapper function is called N times
 * within that interval, only the Nth call will go through. The function
 * will only be called after the full interval has elapsed since the last
 * call.
 */
export declare function debounce(delay: number, fn: any): any;
/**
 * Embed query param values, which can be set in ?embed={value}, all should be lowercase
 */
export declare const EMBED_QUERY_PARAM_KEY = "embed";
export declare const EMBED_OPTIONS_QUERY_PARAM_KEY = "embed_options";
export declare const EMBED_SHOW_COLORED_LINE = "show_colored_line";
export declare const EMBED_SHOW_TOOLBAR = "show_toolbar";
export declare const EMBED_SHOW_PADDING = "show_padding";
export declare const EMBED_DISABLE_SCROLLING = "disable_scrolling";
export declare const EMBED_SHOW_FOOTER = "show_footer";
export declare const EMBED_LIGHT_THEME = "light_theme";
export declare const EMBED_DARK_THEME = "dark_theme";
export declare const EMBED_TRUE = "true";
export declare const EMBED_QUERY_PARAM_VALUES: string[];
/**
 * Returns list of defined in EMBED_QUERY_PARAM_VALUES url params of given key
 * (EMBED_QUERY_PARAM_KEY, EMBED_OPTIONS_QUERY_PARAM_KEY). Is case insensitive.
 */
export declare function getEmbedUrlParams(embedKey: string): Set<string>;
/**
 * Returns true if the URL parameters contain ?embed=true (case insensitive).
 */
export declare function isEmbed(): boolean;
/**
 * Returns true if the URL parameters contain ?embed=true&embed_options=show_colored_line (case insensitive).
 */
export declare function isColoredLineDisplayed(): boolean;
/**
 * Returns true if the URL parameters contain ?embed=true&embed_options=show_toolbar (case insensitive).
 */
export declare function isToolbarDisplayed(): boolean;
/**
 * Returns true if the URL parameters contain ?embed=true&embed_options=disable_scrolling (case insensitive).
 */
export declare function isScrollingHidden(): boolean;
/**
 * Returns true if the URL parameters contain ?embed=true&embed_options=show_footer (case insensitive).
 */
export declare function isFooterDisplayed(): boolean;
/**
 * Returns true if the URL parameters contain ?embed=true&embed_options=show_padding (case insensitive).
 */
export declare function isPaddingDisplayed(): boolean;
/**
 * Returns true if the URL parameters contain ?embed_options=light_theme (case insensitive).
 */
export declare function isLightTheme(): boolean;
/**
 * Returns true if the URL parameters contain ?embed_options=dark_theme (case insensitive).
 */
export declare function isDarkTheme(): boolean;
/**
 * Returns true if the parent parameter indicates that we're in an iframe.
 */
export declare function isInChildFrame(): boolean;
/** Return an info Element protobuf with the given text. */
export declare function makeElementWithInfoText(text: string): Element;
/** Return an error Element protobuf with the given text. */
export declare function makeElementWithErrorText(text: string): Element;
/**
 * A helper function to hash a string using xxHash32 algorithm.
 * Seed used: 0xDEADBEEF
 */
export declare function hashString(s: string): string;
/**
 * Coerces a possibly-null value into a non-null value, throwing an error
 * if the value is null or undefined.
 */
export declare function requireNonNull<T>(obj: T | null | undefined): T;
/**
 * A type predicate that is true if the given value is not undefined.
 */
export declare function notUndefined<T>(value: T | undefined): value is T;
/**
 * A type predicate that is true if the given value is not null.
 */
export declare function notNull<T>(value: T | null): value is T;
/**
 * A type predicate that is true if the given value is neither undefined
 * nor null.
 */
export declare function notNullOrUndefined<T>(value: T | null | undefined): value is T;
/**
 * A type predicate that is true if the given value is either undefined
 * or null.
 */
export declare function isNullOrUndefined<T>(value: T | null | undefined): value is null | undefined;
/**
 * A promise that would be resolved after certain time
 * @param ms number
 */
export declare function timeout(ms: number): Promise<void>;
/**
 * Tests if the app is running from a Mac
 */
export declare function isFromMac(): boolean;
/**
 * Tests if the app is running from a Windows
 */
export declare function isFromWindows(): boolean;
/**
 * Returns cookie value
 */
export declare function getCookie(name: string): string | undefined;
/**
 * Sets cookie value
 */
export declare function setCookie(name: string, value?: string, expiration?: Date): void;
/** Return an Element's widget ID if it's a widget, and undefined otherwise. */
export declare function getElementWidgetID(element: Element): string | undefined;
/** True if the given form ID is non-null and non-empty. */
export declare function isValidFormId(formId?: string): formId is string;
/** True if the given widget element is part of a form. */
export declare function isInForm(widget: {
    formId?: string;
}): boolean;
export declare enum LabelVisibilityOptions {
    Visible = 0,
    Hidden = 1,
    Collapsed = 2
}
export declare function labelVisibilityProtoValueToEnum(value: LabelVisibilityMessageProto.LabelVisibilityOptions | null | undefined): LabelVisibilityOptions;
/**
 * Looks for an IFrame with given className inside given querySet
 */
export declare function findAnIFrameWithClassName(qs: NodeListOf<HTMLIFrameElement> | HTMLCollectionOf<HTMLIFrameElement>, className: string): HTMLIFrameElement | null;
/**
 * Returns True if IFrame can be accessed otherwise returns False
 */
export declare function canAccessIFrame(iframe: HTMLIFrameElement): boolean;
/**
 * Tries to get an IFrame in which Streamlit app is embedded on Cloud deployments.
 * It assumes iframe has title="streamlitApp", iterates over IFrames,
 * and looks which IFrame contains div with stAppId value, otherwise returns first found iFrame or null.
 */
export declare function getIFrameEnclosingApp(embeddingId: string): HTMLIFrameElement | null;
/**
 * Returns UID generated based on current date and Math.random module
 */
export declare function generateUID(): string;
/**
 * Returns stAppEmbeddingId-${this.embeddingId} string,
 * which is used as class to detect iFrame when printing
 */
export declare function getEmbeddingIdClassName(embeddingId: string): string;
