// Note: Cached themes before version 1 were simply stored with key equal to
// CACHED_THEME_BASE_KEY (with no version number).
const CACHED_THEME_VERSION = 1
const CACHED_THEME_BASE_KEY = `stActiveTheme-${window.location.pathname}`

export const LocalStore = {
  CACHED_THEME_VERSION,
  CACHED_THEME_BASE_KEY,

  ACTIVE_THEME: `${CACHED_THEME_BASE_KEY}-v${CACHED_THEME_VERSION}`,
}
