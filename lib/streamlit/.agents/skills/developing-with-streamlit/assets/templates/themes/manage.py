#!/usr/bin/env python3
# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Manage theme template directories (fully generated from _configs/).

Usage:
    python manage.py sync   # Regenerate all theme directories
    python manage.py check  # Verify generated files haven't drifted
    python manage.py new NAME       # Scaffold a new theme config
"""

import ast
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).parent
SHARED = ROOT / "_shared"
TEMPLATES = ROOT / "_templates"
CONFIGS = ROOT / "_configs"
MANAGED_HEADER_PY = (
    "# DO NOT EDIT — managed by manage.py, edit _shared/streamlit_app.py instead\n"
)
MANAGED_HEADER_TOML = (
    "# DO NOT EDIT — managed by manage.py, edit _configs/{slug}.toml instead\n"
)

GITATTR_START = "# BEGIN managed by manage.py"
GITATTR_END = "# END managed by manage.py"


# ---------------------------------------------------------------------------
# Theme discovery
# ---------------------------------------------------------------------------

TITLE_OVERRIDES = {"github": "GitHub"}


def slug_to_title(slug):
    """Derive a display title from a directory slug: 'solarized-light' -> 'Solarized Light'."""
    if slug in TITLE_OVERRIDES:
        return TITLE_OVERRIDES[slug]
    return " ".join(w.capitalize() for w in slug.split("-"))


def discover_themes():
    """Find themes by scanning _configs/*.toml."""
    return [
        {"slug": c.stem, "title": slug_to_title(c.stem)}
        for c in sorted(CONFIGS.glob("*.toml"))
    ]


# ---------------------------------------------------------------------------
# Content builders
# ---------------------------------------------------------------------------


def expected_app(title):
    """Build expected streamlit_app.py content for a theme."""
    source = (SHARED / "streamlit_app.py").read_text()
    body = source.replace("{{title}}", title)
    # Insert managed header after the module docstring
    tree = ast.parse(body)
    if ast.get_docstring(tree) is not None:
        # The docstring is the first statement; find end of its line
        docstring_node = tree.body[0]
        end_line = docstring_node.end_lineno  # 1-indexed
        lines = body.split("\n")
        insert_pos = end_line
        return (
            "\n".join(lines[:insert_pos])
            + "\n"
            + MANAGED_HEADER_PY
            + "\n".join(lines[insert_pos:])
        )
    return MANAGED_HEADER_PY + body


def expected_config(slug):
    """Build expected .streamlit/config.toml content for a theme."""
    source = (CONFIGS / f"{slug}.toml").read_text()
    header = MANAGED_HEADER_TOML.replace("{slug}", slug)
    return header + source


def expected_from_template(tmpl_path, replacements):
    """Build expected file content from a .tmpl template."""
    text = tmpl_path.read_text()
    for key, value in replacements.items():
        text = text.replace("{{" + key + "}}", value)
    return text


# ---------------------------------------------------------------------------
# Sync
# ---------------------------------------------------------------------------


def sync_theme(theme):
    """Regenerate all files for a single theme directory."""
    slug = theme["slug"]
    title = theme["title"]
    theme_dir = ROOT / slug

    # Create directories
    theme_dir.mkdir(exist_ok=True)
    (theme_dir / ".streamlit").mkdir(exist_ok=True)

    # .streamlit/config.toml — from _configs/
    (theme_dir / ".streamlit" / "config.toml").write_text(expected_config(slug))

    # streamlit_app.py
    (theme_dir / "streamlit_app.py").write_text(expected_app(title))

    # pyproject.toml
    (theme_dir / "pyproject.toml").write_text(
        expected_from_template(
            TEMPLATES / "pyproject.toml.tmpl",
            {"slug": slug, "title": title},
        )
    )


def update_gitattributes():
    """Update .gitattributes with entries for generated theme files."""
    gitattr_path = ROOT / ".gitattributes"

    new_section = "\n".join(
        [
            GITATTR_START,
            "*/.streamlit/config.toml linguist-generated",
            "*/streamlit_app.py linguist-generated",
            "*/pyproject.toml linguist-generated",
            GITATTR_END,
        ]
    )

    if gitattr_path.exists():
        content = gitattr_path.read_text()
        if GITATTR_START in content:
            start = content.index(GITATTR_START)
            end = content.index(GITATTR_END) + len(GITATTR_END)
            content = content[:start] + new_section + content[end:]
        else:
            content = content.rstrip() + "\n\n" + new_section + "\n"
    else:
        content = new_section + "\n"

    gitattr_path.write_text(content)


def cmd_sync():
    themes = discover_themes()
    for t in themes:
        sync_theme(t)
        print(f"  Synced {t['slug']}/")

    # Remove orphaned theme directories (directories not matching any config)
    config_slugs = {t["slug"] for t in themes}
    orphans = [
        d
        for d in sorted(ROOT.iterdir())
        if d.is_dir() and not d.name.startswith("_") and d.name not in config_slugs
    ]
    if orphans:
        print("\nOrphaned directories (no matching config):")
        for d in orphans:
            print(f"  {d.name}/")
        answer = input("Remove these directories? [y/N] ").strip().lower()
        if answer == "y":
            for d in orphans:
                shutil.rmtree(d)
                print(f"  Removed {d.name}/")
        else:
            print("  Skipped orphan removal.")

    update_gitattributes()
    print(f"\nSynced {len(themes)} theme directories.")


# ---------------------------------------------------------------------------
# Check
# ---------------------------------------------------------------------------


def cmd_check():
    themes = discover_themes()
    drifted = []
    missing = []

    for theme in themes:
        slug = theme["slug"]
        title = theme["title"]
        theme_dir = ROOT / slug

        # .streamlit/config.toml
        target = theme_dir / ".streamlit" / "config.toml"
        expected = expected_config(slug)
        if not target.exists():
            missing.append(f"{slug}/.streamlit/config.toml")
        elif target.read_text() != expected:
            drifted.append(f"{slug}/.streamlit/config.toml")

        # streamlit_app.py
        target = theme_dir / "streamlit_app.py"
        if not target.exists():
            missing.append(f"{slug}/streamlit_app.py")
        elif target.read_text() != expected_app(title):
            drifted.append(f"{slug}/streamlit_app.py")

        # pyproject.toml
        target = theme_dir / "pyproject.toml"
        expected = expected_from_template(
            TEMPLATES / "pyproject.toml.tmpl",
            {"slug": slug, "title": title},
        )
        if not target.exists():
            missing.append(f"{slug}/pyproject.toml")
        elif target.read_text() != expected:
            drifted.append(f"{slug}/pyproject.toml")

    ok = True
    if missing:
        print("Missing files (run 'python manage.py sync' to fix):")
        for f in missing:
            print(f"  {f}")
        ok = False
    if drifted:
        print("Drifted files (run 'python manage.py sync' to fix):")
        for f in drifted:
            print(f"  {f}")
        ok = False
    if ok:
        print(f"All generated files in sync across {len(themes)} theme directories.")
    else:
        sys.exit(1)


# ---------------------------------------------------------------------------
# New
# ---------------------------------------------------------------------------


def cmd_new(name):
    config_path = CONFIGS / f"{name}.toml"
    if config_path.exists():
        print(f"Error: _configs/{name}.toml already exists", file=sys.stderr)
        sys.exit(1)

    config_path.write_text(f'# {name} theme\n[theme]\nbase = "dark"\n')

    print(f"Created _configs/{name}.toml — edit it, then run 'python manage.py sync'")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print((__doc__ or "").strip())
        sys.exit(0 if len(sys.argv) > 1 else 1)

    if not SHARED.is_dir():
        print(f"Error: {SHARED} not found", file=sys.stderr)
        sys.exit(1)

    if not CONFIGS.is_dir():
        print(f"Error: {CONFIGS} not found", file=sys.stderr)
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "sync":
        cmd_sync()
    elif cmd == "new":
        if len(sys.argv) < 3:
            print("Usage: python manage.py new NAME", file=sys.stderr)
            sys.exit(1)
        cmd_new(sys.argv[2])
    elif cmd == "check":
        cmd_check()
    else:
        print(f"Unknown command: {cmd}", file=sys.stderr)
        sys.exit(1)
