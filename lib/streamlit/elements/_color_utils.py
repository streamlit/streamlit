from typing import Iterable, List, Optional, Union

def _get_theme_value(theme, key: str) -> Optional[str]:
    """Safely fetch a theme value by key or attribute."""
    if theme is None:
        return None
    try:
        val = theme.get(key)
        if val:
            return val
    except Exception:
        pass
    try:
        return getattr(theme, key)
    except Exception:
        pass
    return None


# Mapping of built-in color names to theme keys
BUILTIN_NAME_TO_KEY = {
    "red": "redColor",
    "orange": "orangeColor",
    "yellow": "yellowColor",
    "blue": "blueColor",
    "green": "greenColor",
    "violet": "violetColor",
    "gray": "grayColor",
    "grey": "grayColor",
    "primary": "primaryColor",
}


def _theme_color_lookup(theme, name: str) -> Optional[str]:
    """Return the theme hex value for a built-in color name, or None if not found."""
    if not name or not isinstance(name, str):
        return None
    key = BUILTIN_NAME_TO_KEY.get(name.lower())
    if not key:
        return None
    return _get_theme_value(theme, key)


def normalize_chart_colors(
    color: Union[str, Iterable[str], None], theme
) -> Union[str, List[str], None]:
    """Normalize built-in color names into theme color hex values.

    - Accepts a single string or a list of strings.
    - Keeps hex/rgb strings unchanged.
    - Returns None if color is None.
    """
    if color is None:
        return None

    if isinstance(color, str):
        mapped = _theme_color_lookup(theme, color)
        return mapped if mapped is not None else color

    try:
        return [_theme_color_lookup(theme, c) or c for c in color]
    except TypeError:
        return color
