import { IS_DEV_ENV } from './baseconsts';

/**
 * Whether we should log usage remotely, for stats.
 * Defaults to true. See also lib/streamlit/config.py.
 */
let trackUsage = true;

export function initRemoteLogger({remotelyTrackUsage}) {
  if (remotelyTrackUsage != null) trackUsage = remotelyTrackUsage;
  console.log('Log stats remotely: ', trackUsage);
}

/**
 * Params:
 *   action: a string with the name of the event that should be logged.
 *   category: one of ['newInteraction', 'newMessage']
 */
export function remoteLog(action, category) {
  if (!trackUsage) return;
  if (!window.gtag) return;

  // Print to console, for transparency.
  console.log('Logging stat datapoint: ', action);

  window.gtag('event', action, {
    event_category: category,
    event_label: IS_DEV_ENV ? 'dev' : 'prod',
    //value: value,  // Optional
  });
}
