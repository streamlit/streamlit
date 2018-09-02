// If changing the port, also change:
//   lib/streamlit/proxy/Proxy.py
const IS_DEV = window.location.port == 3000;

export function remoteLog(action) {
  if (!window.gtag) return;
  if (IS_DEV) action += '_dev';
  console.log('Logging remotely: ', action);
  window.gtag('event', action, {
    event_category: 'Reports',
    //event_label: label,  // Optional
    //value: value,  // Optional
  });
}
