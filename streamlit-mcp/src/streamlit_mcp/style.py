"""Streamlit design tokens for the PDF report.

Values mirror the library's own theme so the report looks like Streamlit
output rather than default matplotlib. Sources:

- ``frontend/lib/src/theme/primitives/colors.ts``
- ``frontend/lib/src/theme/primitives/typography.ts``
- ``frontend/lib/src/theme/primitives/spacing.ts`` and ``radii.ts``
- ``frontend/lib/src/theme/emotionBaseTheme/themeColors.ts`` (light theme)
"""

from __future__ import annotations

from pathlib import Path


def _find_font_dir() -> Path:
    """Locate Streamlit's bundled fonts when this adapter lives in the repo."""
    here = Path(__file__).resolve()
    for parent in [here, *here.parents]:
        candidate = parent / "frontend/app/src/assets/fonts"
        if candidate.is_dir():
            return candidate
    return Path()


FONT_DIR = _find_font_dir()

# primitives/colors.ts
GRAY_10 = "#fafafa"
GRAY_20 = "#f0f2f6"
GRAY_30 = "#e6eaf1"
GRAY_60 = "#a3a8b8"
GRAY_70 = "#808495"
GRAY_85 = "#31333F"
WHITE = "#ffffff"
RED_70 = "#ff4b4b"
GREEN_80 = "#09ab3b"
BLUE_80 = "#0068c9"
BLUE_40 = "#83c9ff"

# emotionBaseTheme/themeColors.ts -- the light theme Streamlit ships by default.
BG_COLOR = WHITE
SECONDARY_BG = GRAY_20
BODY_TEXT = GRAY_85
PRIMARY = RED_70

# createEmotionColors derives these by fading bodyText over the background.
# Flattened against white here because a PDF has no alpha compositing model
# as forgiving as the browser's.
FADED_TEXT_60 = "#84858c"  # transparentize(bodyText, 0.4) -- secondary text
BORDER_COLOR = "#d6d7db"  # transparentize(bodyText, 0.8) -- 1px lines

# getColors.ts defaultCategoricalColorsArray, light background branch.
CATEGORICAL = [BLUE_80, BLUE_40, "#ff2b2b", "#ffabab", "#29b09d"]

# typography.ts, converted from rem at baseFontSize 16 to points for matplotlib.
BASE_PT = 9.5
_SCALE = BASE_PT / 16


def pt(rem: float) -> float:
    """Convert a rem value from the theme to a matplotlib point size."""
    return rem * 16 * _SCALE


FS_H1 = pt(2.75)
FS_H2 = pt(2.25)
FS_H3 = pt(1.75)
FS_H5 = pt(1.25)
FS_METRIC_VALUE = pt(2.25)
FS_MD = pt(1.0)
FS_SM = pt(0.875)
FS_TWO_SM = pt(0.75)

# fontWeights: h1 700, h2/h3 600, metric value 400, body 400.
FW_NORMAL = 400
FW_SEMI_BOLD = 500
FW_BOLD = 600
FW_EXTRA_BOLD = 700
FW_METRIC_VALUE = 400

LH_HEADINGS = 1.2
LH_BASE = 1.6

# radii.ts -- `default` is what most Streamlit containers use.
RADIUS_DEFAULT_REM = 0.5


def _instance_family(woff2: Path, stem: str, weights: tuple[int, ...]) -> str | None:
    """Instance a variable woff2 into static TTFs and register them.

    The repo ships fonts as variable woff2, which matplotlib cannot read, so
    weights are baked out into a cache directory next to this file.
    """
    from matplotlib import font_manager

    if not woff2.exists():
        return None

    cache = Path(__file__).resolve().parent / ".fonts"
    cache.mkdir(exist_ok=True)
    family = None
    try:
        import logging

        logging.getLogger("fontTools").setLevel(logging.ERROR)
        from fontTools.ttLib import TTFont
        from fontTools.varLib import instancer

        for weight in weights:
            target = cache / f"{stem}-{weight}.ttf"
            if not target.exists():
                font = TTFont(woff2)
                instancer.instantiateVariableFont(font, {"wght": weight}, inplace=True)
                font.flavor = None
                font.save(target)
            font_manager.fontManager.addfont(str(target))
            # matplotlib matches on the family name the font itself declares.
            family = font_manager.FontProperties(fname=str(target)).get_name()
    except Exception:
        return None
    return family


def register_fonts() -> tuple[str, str]:
    """Return the (body, code) font families, falling back to DejaVu."""
    body = _instance_family(
        FONT_DIR / "Source_Sans/SourceSansVF-Upright.ttf.woff2",
        "SourceSans",
        (FW_NORMAL, FW_SEMI_BOLD, FW_BOLD, FW_EXTRA_BOLD),
    )
    code = _instance_family(
        FONT_DIR / "Source_Code/SourceCodeVF-Upright.ttf.woff2",
        "SourceCode",
        (FW_NORMAL, FW_BOLD),
    )
    return body or "DejaVu Sans", code or "DejaVu Sans Mono"


def apply_rcparams(family: str, code_family: str) -> None:
    """Apply the theme's typography and axis styling to matplotlib globals."""
    from matplotlib import rcParams

    rcParams["font.family"] = [family, "DejaVu Sans"]
    rcParams["font.monospace"] = [code_family, "DejaVu Sans Mono"]
    rcParams["font.size"] = FS_MD
    rcParams["text.color"] = BODY_TEXT
    rcParams["axes.labelcolor"] = BODY_TEXT
    rcParams["axes.edgecolor"] = BORDER_COLOR
    rcParams["xtick.color"] = FADED_TEXT_60
    rcParams["ytick.color"] = FADED_TEXT_60
    rcParams["axes.facecolor"] = BG_COLOR
    rcParams["figure.facecolor"] = BG_COLOR
    rcParams["axes.grid"] = True
    rcParams["grid.color"] = BORDER_COLOR
    rcParams["grid.linewidth"] = 0.6
    rcParams["pdf.fonttype"] = 42
