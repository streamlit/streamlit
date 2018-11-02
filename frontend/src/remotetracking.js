/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 *
 */

import { IS_DEV_ENV } from './baseconsts';

/**
 * Whether we should track usage remotely, for stats.
 * Defaults to true. See also lib/streamlit/config.py.
 */
let trackUsage = true;

/**
 * Params:
 *   remotelyTrackUsage: a boolean. If true, we'll track usage remotely.
 */
export function initRemoteTracker({remotelyTrackUsage}) {
  if (remotelyTrackUsage != null) trackUsage = remotelyTrackUsage;
  console.log('Track stats remotely: ', trackUsage);
}

/**
 * Params:
 *   event: a string with the name of the event that should be tracked.
 *   category: one of ['newInteraction', 'newMessage']
 */
export function trackEventRemotely(event, category) {
  if (!trackUsage) return;
  if (!window.gtag) return;

  // Print to console, for transparency.
  console.log('Tracking stat datapoint: ', event);

  window.gtag('event', event, {
    event_category: category,
    event_label: IS_DEV_ENV ? 'dev' : 'prod',
    //value: value,  // Optional
  });
}
