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

/**
 * Our default iframe sandbox options.
 * See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#Attributes
 */
export const DEFAULT_IFRAME_SANDBOX_POLICY = [
  // Allows for downloads to occur without a gesture from the user.
  // Experimental; limited browser support.
  // "allow-downloads-without-user-activation",

  // Allows the resource to submit forms. If this keyword is not used, form submission is blocked.
  "allow-forms",

  // Lets the resource open modal windows.
  "allow-modals",

  // Lets the resource lock the screen orientation.
  // "allow-orientation-lock",

  // Lets the resource use the Pointer Lock API.
  // "allow-pointer-lock",

  // Allows popups (such as window.open(), target="_blank", or showModalDialog()). If this keyword is not used, the popup will silently fail to open.
  "allow-popups",

  // Lets the sandboxed document open new windows without those windows inheriting the sandboxing. For example, this can safely sandbox an advertisement without forcing the same restrictions upon the page the ad links to.
  "allow-popups-to-escape-sandbox",

  // Lets the resource start a presentation session.
  // "allow-presentation",

  // If this token is not used, the resource is treated as being from a special origin that always fails the same-origin policy.

  // From MDN:
  // "When the embedded document has the same origin as the embedding page, it is
  // strongly discouraged to use both allow-scripts and allow-same-origin, as
  // that lets the embedded document remove the sandbox attribute — making it no
  // more secure than not using the sandbox attribute at all."
  //
  // As of December 2020, we've turned the allow-same-origin flag *on* despite
  // the fact that it basically un-sandboxes us - this was a product decision
  // after lots of back and forth: ultimately, it un-blocks a number of use-cases
  // without making Streamlit Components any less secure than they actually were,
  // since we don't sandbox a Component's Python code.
  "allow-same-origin",

  // Lets the resource run scripts (but not create popup windows).
  "allow-scripts",

  // Lets the resource request access to the parent's storage capabilities with the Storage Access API.
  // Experimental; limited browser support.
  // "allow-storage-access-by-user-activation",

  // Lets the resource navigate the top-level browsing context (the one named _top).
  // "allow-top-navigation",

  // Lets the resource navigate the top-level browsing context, but only if initiated by a user gesture.
  // "allow-top-navigation-by-user-activation",

  // Lets the resource trigger downloads.
  "allow-downloads",
].join(" ")

/**
 * Our default iframe `allow` policy options.
 * See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#Attributes
 */
export const DEFAULT_IFRAME_FEATURE_POLICY = [
  // Controls whether the current document is allowed to gather information about the acceleration of the device through the Accelerometer interface.
  "accelerometer",

  // Controls whether the current document is allowed to gather information about the amount of light in the environment around the device through the AmbientLightSensor interface.
  "ambient-light-sensor",

  // Controls whether the current document is allowed to autoplay media requested through the HTMLMediaElement interface. When this policy is disabled and there were no user gestures, the Promise returned by HTMLMediaElement.play() will reject with a DOMException. The autoplay attribute on <audio> and <video> elements will be ignored.
  "autoplay",

  // Controls whether the use of the Battery Status API is allowed. When this policy is disabled, the Promise returned by Navigator.getBattery() will reject with a NotAllowedError DOMException.
  "battery",

  // Controls whether the current document is allowed to use video input devices. When this policy is disabled, the Promise returned by getUserMedia() will reject with a NotAllowedError DOMException.
  "camera",

  // Controls whether or not the current document is permitted to use the getDisplayMedia() method to capture screen contents. When this policy is disabled, the promise returned by getDisplayMedia() will reject with a NotAllowedError if permission is not obtained to capture the display's contents.
  // "display-capture",

  // Controls whether the current document is allowed to set document.domain. When this policy is disabled, attempting to set document.domain will fail and cause a SecurityError DOMException to be be thrown.
  "document-domain",

  // Controls whether the current document is allowed to use the Encrypted Media Extensions API (EME). When this policy is disabled, the Promise returned by Navigator.requestMediaKeySystemAccess() will reject with a DOMException.
  "encrypted-media",

  // Controls whether tasks should execute in frames while they're not being rendered (e.g. if an iframe is hidden or display: none).
  // "execution-while-not-rendered",

  // Controls whether tasks should execute in frames while they're outside of the visible viewport.
  // "execution-while-out-of-viewport",

  // Controls whether the current document is allowed to use Element.requestFullScreen(). When this policy is disabled, the returned Promise rejects with a TypeError DOMException.
  "fullscreen",

  // Controls whether the current document is allowed to use the Geolocation Interface. When this policy is disabled, calls to getCurrentPosition() and watchPosition() will cause those functions' callbacks to be invoked with a PositionError code of PERMISSION_DENIED.
  "geolocation",

  // Controls whether the current document is allowed to gather information about the orientation of the device through the Gyroscope interface.
  "gyroscope",

  // Controls whether the current document is allowed to show layout animations.
  "layout-animations",

  // Controls whether the current document is allowed to display images in legacy formats.
  "legacy-image-formats",

  // Controls whether the current document is allowed to gather information about the orientation of the device through the Magnetometer interface.
  "magnetometer",

  // Controls whether the current document is allowed to use audio input devices. When this policy is disabled, the Promise returned by MediaDevices.getUserMedia() will reject with a NotAllowedError.
  "microphone",

  // Controls whether the current document is allowed to use the Web MIDI API. When this policy is disabled, the Promise returned by Navigator.requestMIDIAccess() will reject with a DOMException.
  "midi",

  // Controls the availability of mechanisms that enables the page author to take control over the behavior of spatial navigation, or to cancel it outright.
  // "navigation-override",

  // Controls whether the current document is allowed to download and display large images.
  "oversized-images",

  // Controls whether the current document is allowed to use the Payment Request API. When this policy is enabled, the PaymentRequest() constructor will throw a SecurityError DOMException.
  "payment",

  // Controls whether the current document is allowed to play a video in a Picture-in-Picture mode via the corresponding API.
  "picture-in-picture",

  // Controls whether the current document is allowed to use the Web Authentication API to retreive already stored public-key credentials, i.e. via navigator.credentials.get({publicKey: ..., ...}).
  "publickey-credentials-get",

  // Controls whether the current document is allowed to make synchronous XMLHttpRequest requests.
  "sync-xhr",

  // Controls whether the current document is allowed to use the WebUSB API.
  "usb",

  // Controls whether the current document is allowed to use the WebVR API. When this policy is disabled, the Promise returned by Navigator.getVRDisplays() will reject with a DOMException. Keep in mind that the WebVR standard is in the process of being replaced with WebXR.
  "vr ",

  // Controls whether the current document is allowed to use Wake Lock API to indicate that device should not enter power-saving mode.
  "wake-lock",

  // Controls whether or not the current document is allowed to use the WebXR Device API to interact with a WebXR session.
  "xr-spatial-tracking",
].join("; ")
