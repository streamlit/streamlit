"""Build a PDF briefing from any Streamlit app's agent JSON endpoint.

Walks a snapshot from ``POST /_stcore/agent/v1/interact`` and lays out title,
metrics, widgets, charts, and dataframes using Streamlit light-theme tokens.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.patches import FancyBboxPatch, Rectangle

from streamlit_mcp import style as sl
from streamlit_mcp.client import AgentClient, AgentClientError, interact_url

DEFAULT_URL = "http://127.0.0.1:8501/_stcore/agent/v1/interact"
PAGE_W, PAGE_H = 8.27, 11.69
MARGIN = 0.085
CONTENT_W = 1 - 2 * MARGIN
MAX_TABLE_ROWS = 14
MAX_CHART_POINTS = 24


def walk(node: dict[str, Any], trail: tuple[str, ...] = ()):
    """Yield (node, trail) for every node, with tab/expander labels in trail."""
    yield node, trail
    label = (node.get("props") or {}).get("label")
    child_trail = trail
    if node.get("type") in {"tab", "expander"} and label:
        child_trail = (*trail, str(label))
    for child in node.get("children") or []:
        yield from walk(child, child_trail)


def interact(url: str, body: dict[str, Any]) -> dict[str, Any]:
    """POST to the agent interact endpoint (CLI and MCP share this helper)."""
    return AgentClient(url).interact(body)


def collect(snapshot: dict[str, Any]) -> dict[str, Any]:
    """Pull reportable facts from a snapshot without assuming element keys."""
    title = caption = None
    metrics: list[dict[str, Any]] = []
    widgets: list[dict[str, Any]] = []
    charts: list[dict[str, Any]] = []
    tables: list[dict[str, Any]] = []
    notes: list[str] = []
    counts: dict[str, int] = {}

    for node, trail in walk(snapshot.get("tree") or {}):
        kind = node.get("type") or "unknown"
        counts[kind] = counts.get(kind, 0) + 1
        props = node.get("props") or {}
        data = node.get("data") or {}
        location = " / ".join(trail)

        if kind == "title" and title is None:
            title = props.get("body")
        elif kind == "caption" and caption is None:
            caption = props.get("body")
        elif kind == "metric":
            metrics.append(
                {
                    "label": props.get("label") or "",
                    "value": props.get("value") or "",
                    "delta": props.get("delta"),
                    "location": location,
                }
            )
        elif kind in {"markdown", "text"} and props.get("body"):
            notes.append(str(props["body"]).replace("**", ""))
        elif node.get("key") and kind not in {"download_button"}:
            widgets.append(
                {
                    "key": node["key"],
                    "type": kind,
                    "label": props.get("label") or node["key"],
                    "value": node.get("value"),
                    "options": props.get("options"),
                    "location": location,
                }
            )
        if kind in {
            "vega_lite_chart",
            "plotly_chart",
            "graphviz_chart",
            "echarts_chart",
        }:
            charts.append(
                {
                    "type": kind,
                    "location": location,
                    "spec": data.get("spec"),
                    "values": data.get("values") or [],
                    "columns": data.get("columns") or [],
                    "alt": props.get("alt") or props.get("label"),
                }
            )
        if kind in {"dataframe", "table"} and data.get("rows") is not None:
            tables.append(
                {
                    "type": kind,
                    "location": location,
                    "columns": data.get("columns") or [],
                    "rows": data.get("rows") or [],
                    "row_count": data.get("row_count", len(data.get("rows") or [])),
                }
            )

    return {
        "session_id": snapshot.get("session_id"),
        "status": snapshot.get("status"),
        "observed_at": snapshot.get("observed_at"),
        "schema_version": snapshot.get("schema_version"),
        "title": title,
        "caption": caption,
        "metrics": metrics,
        "widgets": widgets,
        "charts": charts,
        "tables": tables,
        "notes": notes,
        "counts": counts,
        "actions": snapshot.get("actions") or [],
        "page": snapshot.get("page") or {},
    }


def new_page() -> tuple[plt.Figure, plt.Axes]:
    fig = plt.figure(figsize=(PAGE_W, PAGE_H))
    ax = fig.add_axes((0, 0, 1, 1))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")
    ax.set_facecolor(sl.BG_COLOR)
    ax.grid(False)
    ax.add_patch(Rectangle((0, 0.975), 1, 0.025, facecolor=sl.PRIMARY))
    return fig, ax


def rounded(ax, x, y, w, h, *, face, edge=None) -> None:
    radius = sl.RADIUS_DEFAULT_REM / 16 * 0.55
    ax.add_patch(
        FancyBboxPatch(
            (x + radius, y + radius),
            w - 2 * radius,
            h - 2 * radius,
            boxstyle=f"round,pad={radius},rounding_size={radius}",
            facecolor=face,
            edgecolor=edge or face,
            linewidth=0.8,
            mutation_aspect=PAGE_W / PAGE_H,
        )
    )


def heading(ax, text: str, y: float, *, size=None) -> None:
    ax.text(
        MARGIN,
        y,
        text,
        fontsize=size or sl.FS_H3,
        fontweight=sl.FW_BOLD,
        color=sl.BODY_TEXT,
        va="baseline",
    )


def muted(ax, text: str, y: float, *, size=None) -> None:
    ax.text(
        MARGIN,
        y,
        text,
        fontsize=size or sl.FS_SM,
        color=sl.FADED_TEXT_60,
        va="top",
        linespacing=sl.LH_BASE,
    )


def divider(ax, y: float) -> None:
    ax.plot([MARGIN, 1 - MARGIN], [y, y], color=sl.BORDER_COLOR, linewidth=0.8)


def footer(ax, page: int, total: int) -> None:
    divider(ax, 0.045)
    ax.text(
        MARGIN,
        0.03,
        "Generated from POST /_stcore/agent/v1/interact",
        fontsize=sl.FS_TWO_SM,
        color=sl.FADED_TEXT_60,
        va="top",
    )
    ax.text(
        1 - MARGIN,
        0.03,
        f"{page} / {total}",
        fontsize=sl.FS_TWO_SM,
        color=sl.FADED_TEXT_60,
        va="top",
        ha="right",
    )


def style_axes(axes) -> None:
    for side in ("top", "right"):
        axes.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        axes.spines[side].set_color(sl.BORDER_COLOR)
    axes.set_axisbelow(True)
    axes.tick_params(labelsize=sl.FS_TWO_SM, length=0)
    axes.grid(axis="y", color=sl.BORDER_COLOR, linewidth=0.6)
    axes.grid(axis="x", visible=False)


def metric_card(ax, x, y, w, h, item: dict[str, Any]) -> None:
    rounded(ax, x, y, w, h, face=sl.BG_COLOR, edge=sl.BORDER_COLOR)
    ax.text(
        x + 0.016,
        y + h - 0.014,
        item["label"] or "Metric",
        fontsize=sl.FS_SM,
        color=sl.FADED_TEXT_60,
        va="top",
    )
    ax.text(
        x + 0.016,
        y + h - 0.038,
        str(item["value"]),
        fontsize=sl.FS_METRIC_VALUE * 0.85,
        fontweight=sl.FW_METRIC_VALUE,
        color=sl.BODY_TEXT,
        va="top",
    )
    if item.get("delta"):
        color = sl.GREEN_80 if str(item["delta"]).startswith("+") else sl.PRIMARY
        ax.text(
            x + 0.016,
            y + 0.010,
            str(item["delta"]),
            fontsize=sl.FS_TWO_SM,
            color=color,
            va="bottom",
        )


_SUBSPEC_KEYS = ("layer", "concat", "hconcat", "vconcat")


def plottable_view(spec: Any) -> dict[str, Any] | None:
    """Find the sub-spec carrying the x/y encoding.

    Composite charts such as ``st.line_chart`` wrap the real encoding in a
    ``layer`` list (line, invisible hover points, selected point), so the top
    level has neither ``mark`` nor ``encoding``.
    """
    if not isinstance(spec, dict):
        return None
    encoding = spec.get("encoding")
    if isinstance(encoding, dict) and encoding.get("x") and encoding.get("y"):
        return spec
    for key in _SUBSPEC_KEYS:
        for child in spec.get(key) or []:
            found = plottable_view(child)
            if found is not None:
                return found
    return plottable_view(spec.get("spec"))


def encoding_fields(spec: Any) -> tuple[str | None, str | None]:
    view = plottable_view(spec)
    if view is None:
        return None, None
    encoding = view["encoding"]
    x = encoding.get("x")
    y = encoding.get("y")
    x_field = x.get("field") if isinstance(x, dict) else None
    y_field = y.get("field") if isinstance(y, dict) else None
    return x_field, y_field


def mark_name(spec: Any) -> str:
    view = plottable_view(spec)
    mark = view.get("mark") if view is not None else None
    if isinstance(mark, str):
        return mark
    if isinstance(mark, dict):
        return str(mark.get("type") or "chart")
    return "chart"


def series_field(spec: Any) -> str | None:
    """Field that splits the rows into separate series, if the spec has one."""
    view = plottable_view(spec)
    if view is None:
        return None
    for channel in ("color", "detail"):
        item = view["encoding"].get(channel)
        if isinstance(item, dict) and item.get("field"):
            return str(item["field"])
    return None


def _encoding_channel(spec: Any, channel: str) -> dict[str, Any] | None:
    view = plottable_view(spec)
    if view is None:
        return None
    item = view["encoding"].get(channel)
    return item if isinstance(item, dict) else None


def _vega_sort_key(value: Any) -> tuple[int, Any]:
    """Ascending key close to Vega-Lite's default discrete compare."""
    if value is None:
        return (2, "")
    if isinstance(value, bool):
        return (1, int(value))
    if isinstance(value, (int, float)):
        return (0, value)
    return (1, str(value))


def discrete_axis_order(
    spec: Any,
    values: list[Any],
    x_field: str,
    y_field: str | None,
) -> list[Any]:
    """Return the discrete x-axis domain using Vega-Lite sort rules.

    Agent JSON keeps ``values`` in data order and often omits ``sort``. Vega-Lite
    then defaults to ascending for discrete fields, which is what the Streamlit
    app shows. ``sort: null`` keeps data order.
    """
    data_order: list[Any] = []
    y_by_x: dict[Any, float] = {}
    first_row: dict[Any, dict[str, Any]] = {}
    for row in values:
        if not isinstance(row, dict) or x_field not in row:
            continue
        x_value = row[x_field]
        if x_value not in data_order:
            data_order.append(x_value)
            first_row[x_value] = row
            if y_field is not None and y_field in row:
                try:
                    y_by_x[x_value] = float(row[y_field])
                except (TypeError, ValueError):
                    pass
    if not data_order:
        return []

    x_enc = _encoding_channel(spec, "x") or {}
    if "sort" not in x_enc:
        return sorted(data_order, key=_vega_sort_key)

    sort = x_enc["sort"]
    if sort is None:
        return data_order
    if sort is True or sort == "ascending":
        return sorted(data_order, key=_vega_sort_key)
    if sort is False or sort == "descending":
        return sorted(data_order, key=_vega_sort_key, reverse=True)
    if isinstance(sort, list):
        seen: set[Any] = set()
        ordered: list[Any] = []
        for item in sort:
            if item in data_order and item not in seen:
                ordered.append(item)
                seen.add(item)
        ordered.extend(item for item in data_order if item not in seen)
        return ordered
    if isinstance(sort, dict):
        reverse = str(sort.get("order") or "ascending") == "descending"
        field = sort.get("field")
        encoding = sort.get("encoding")
        if encoding == "y" or (y_field is not None and field == y_field):
            return sorted(
                data_order,
                key=lambda x: (0, y_by_x[x]) if x in y_by_x else (1, 0.0),
                reverse=reverse,
            )
        if isinstance(field, str):
            return sorted(
                data_order,
                key=lambda x: _vega_sort_key(first_row.get(x, {}).get(field)),
                reverse=reverse,
            )
    return data_order


def plot_chart(fig, left, bottom, width, height, chart: dict[str, Any]) -> bool:
    """Draw a simple x/y Vega-Lite chart. Return False when the spec is too rich."""
    spec = chart.get("spec")
    values = chart.get("values") or []
    x_field, y_field = encoding_fields(spec)
    if not values or not x_field or not y_field:
        return False
    color_field = series_field(spec)

    # Long-form data repeats each x once per series, so collect the x order and
    # the per-series points separately instead of plotting rows in file order.
    series: dict[Any, dict[Any, float]] = {}
    for row in values:
        if not isinstance(row, dict) or x_field not in row or y_field not in row:
            continue
        try:
            y_value = float(row[y_field])
        except (TypeError, ValueError):
            return False
        x_value = row[x_field]
        name = row.get(color_field) if color_field else None
        series.setdefault(name, {})[x_value] = y_value
    x_order = discrete_axis_order(spec, values, x_field, y_field)[:MAX_CHART_POINTS]
    if not x_order:
        return False

    axes = fig.add_axes((left, bottom, width, height))
    kind = mark_name(spec)
    positions = range(len(x_order))
    bar_width = 0.7 / len(series)
    for i, (name, points) in enumerate(series.items()):
        color = sl.CATEGORICAL[i % len(sl.CATEGORICAL)]
        ys = [points.get(x, float("nan")) for x in x_order]
        label = None if name is None else str(name)
        if kind in {"bar", "arc"}:
            offset = (i - (len(series) - 1) / 2) * bar_width
            axes.bar(
                [p + offset for p in positions],
                ys,
                color=color,
                width=bar_width,
                label=label,
            )
        else:
            axes.plot(
                positions,
                ys,
                color=color,
                linewidth=1.8,
                marker="o",
                markersize=3,
                label=label,
            )
    # Thin the ticks so dense x axes stay legible at report width.
    step = max(1, len(x_order) // 12)
    ticks = list(positions)[::step]
    axes.set_xticks(ticks, [str(x_order[i]) for i in ticks], rotation=30, ha="right")
    axes.set_ylabel(str(y_field), fontsize=sl.FS_TWO_SM, color=sl.FADED_TEXT_60)
    if color_field and len(series) > 1:
        legend = axes.legend(
            frameon=False,
            fontsize=sl.FS_TWO_SM,
            loc="best",
            labelcolor=sl.FADED_TEXT_60,
        )
        legend.set_title(None)
    style_axes(axes)
    return True


class Pager:
    def __init__(self, pdf: PdfPages) -> None:
        self.pdf = pdf
        self.pages: list[plt.Figure] = []
        self.fig: plt.Figure | None = None
        self.ax: plt.Axes | None = None
        self.y = 0.92
        self._start()

    def _start(self) -> None:
        self.fig, self.ax = new_page()
        self.y = 0.92
        self.pages.append(self.fig)

    def need(self, height: float) -> None:
        if self.y - height < 0.07:
            self._start()

    def break_page(self) -> None:
        if self.y < 0.92:
            self._start()

    def canvas(self) -> plt.Axes:
        assert self.ax is not None
        return self.ax

    def figure(self) -> plt.Figure:
        assert self.fig is not None
        return self.fig

    def close(self) -> None:
        total = len(self.pages)
        for i, fig in enumerate(self.pages, start=1):
            footer(fig.axes[0], i, total)
            self.pdf.savefig(fig)
            plt.close(fig)


def render_snapshot(
    pager: Pager, facts: dict[str, Any], *, heading_text: str | None
) -> None:
    ax = pager.ax
    assert ax is not None
    assert pager.fig is not None

    if heading_text:
        # Each follow-up interaction starts its own page so the reader can tell
        # the states apart.
        pager.break_page()
        ax = pager.canvas()
        heading(ax, heading_text, pager.y, size=sl.FS_H2)
        pager.y -= 0.04

    title = facts["title"] or "Untitled app"
    heading(ax, title, pager.y, size=sl.FS_H1)
    pager.y -= 0.045
    if facts["caption"]:
        muted(ax, str(facts["caption"]), pager.y)
        pager.y -= 0.028

    rounded(ax, MARGIN, pager.y - 0.048, CONTENT_W, 0.048, face=sl.SECONDARY_BG)
    ax.text(
        MARGIN + 0.016,
        pager.y - 0.010,
        f"schema_version {facts['schema_version']}    status {facts['status']}    "
        f"observed {facts['observed_at']}\nsession {facts['session_id']}",
        fontsize=sl.FS_TWO_SM,
        color=sl.FADED_TEXT_60,
        va="top",
        family="monospace",
        linespacing=1.6,
    )
    pager.y -= 0.07

    if facts["metrics"]:
        heading(ax, "Metrics", pager.y)
        pager.y -= 0.02
        cols = min(4, len(facts["metrics"]))
        gap = 0.014
        card_w = (CONTENT_W - (cols - 1) * gap) / cols
        card_h = 0.088
        for i, item in enumerate(facts["metrics"]):
            if i and i % cols == 0:
                pager.y -= card_h + 0.012
                pager.need(card_h + 0.02)
                ax = pager.ax
                assert ax is not None
            col = i % cols
            metric_card(
                ax,
                MARGIN + col * (card_w + gap),
                pager.y - card_h,
                card_w,
                card_h,
                item,
            )
        pager.y -= card_h + 0.03

    if facts["widgets"]:
        pager.need(0.08 + 0.024 * len(facts["widgets"]))
        ax = pager.ax
        assert ax is not None
        heading(ax, "Widgets", pager.y)
        pager.y -= 0.028
        for widget in facts["widgets"]:
            pager.need(0.026)
            ax = pager.ax
            assert ax is not None
            ax.text(
                MARGIN,
                pager.y,
                widget["label"],
                fontsize=sl.FS_MD,
                color=sl.FADED_TEXT_60,
                va="top",
            )
            ax.text(
                MARGIN + 0.28,
                pager.y,
                _fmt(widget["value"]),
                fontsize=sl.FS_MD,
                color=sl.BODY_TEXT,
                va="top",
            )
            ax.text(
                MARGIN + 0.62,
                pager.y,
                widget["key"],
                fontsize=sl.FS_TWO_SM,
                color=sl.FADED_TEXT_60,
                va="top",
                family="monospace",
            )
            pager.y -= 0.024
        pager.y -= 0.016

    if facts["actions"]:
        pager.need(0.06 + 0.022 * len(facts["actions"]))
        ax = pager.ax
        assert ax is not None
        heading(ax, "Actions", pager.y)
        pager.y -= 0.026
        for action in facts["actions"]:
            color = sl.PRIMARY if action.get("kind") == "trigger" else sl.BLUE_80
            ax.text(MARGIN, pager.y, "●", fontsize=sl.FS_TWO_SM, color=color, va="top")
            ax.text(
                MARGIN + 0.022,
                pager.y,
                str(action.get("key")),
                fontsize=sl.FS_MD,
                color=sl.BODY_TEXT,
                va="top",
                family="monospace",
            )
            ax.text(
                MARGIN + 0.32,
                pager.y,
                str(action.get("kind")),
                fontsize=sl.FS_SM,
                color=sl.FADED_TEXT_60,
                va="top",
            )
            pager.y -= 0.022
        pager.y -= 0.016

    for i, chart in enumerate(facts["charts"], start=1):
        pager.need(0.31)
        ax = pager.ax
        assert ax is not None
        assert pager.fig is not None
        label = chart["alt"] or chart["location"] or f"Chart {i}"
        heading(ax, label, pager.y, size=sl.FS_H5)
        pager.y -= 0.018
        kind = mark_name(chart.get("spec"))
        muted(
            ax,
            f"{chart['type']} · mark={kind} · {len(chart['values'])} values",
            pager.y,
        )
        pager.y -= 0.012
        # Rotated tick labels are drawn below the axes box and matplotlib does
        # not reserve room for them in fixed-position axes, so leave a gap.
        drawn = plot_chart(pager.fig, MARGIN, pager.y - 0.23, CONTENT_W, 0.165, chart)
        if drawn:
            pager.y -= 0.30
        else:
            muted(
                ax,
                "Spec is present but has no simple x/y encoding to plot.",
                pager.y,
            )
            pager.y -= 0.04

    for i, table in enumerate(facts["tables"], start=1):
        columns = [str(c) for c in table["columns"]]
        rows = table["rows"]
        shown = rows[:MAX_TABLE_ROWS]
        row_h = 0.026
        needed = 0.06 + row_h * (len(shown) + 1)
        pager.need(needed)
        ax = pager.ax
        assert ax is not None
        where = table["location"] or f"Table {i}"
        heading(ax, f"{table['type']} · {where}", pager.y, size=sl.FS_H5)
        pager.y -= 0.018
        muted(ax, f"{table['row_count']} rows", pager.y)
        pager.y -= 0.016
        if not columns:
            continue
        col_w = CONTENT_W / max(len(columns), 1)
        # header
        rounded(
            ax,
            MARGIN,
            pager.y - row_h + 0.004,
            CONTENT_W,
            row_h,
            face=sl.SECONDARY_BG,
        )
        for c, name in enumerate(columns):
            ax.text(
                MARGIN + 0.01 + c * col_w,
                pager.y - row_h / 2 + 0.004,
                name,
                fontsize=sl.FS_TWO_SM,
                fontweight=sl.FW_BOLD,
                color=sl.BODY_TEXT,
                va="center",
            )
        pager.y -= row_h
        for record in shown:
            pager.need(row_h)
            ax = pager.ax
            assert ax is not None
            for c, name in enumerate(columns):
                cell = record.get(name, "") if isinstance(record, dict) else record
                ax.text(
                    MARGIN + 0.01 + c * col_w,
                    pager.y - row_h / 2 + 0.004,
                    _fmt(cell),
                    fontsize=sl.FS_TWO_SM,
                    color=sl.BODY_TEXT,
                    va="center",
                )
            divider(ax, pager.y - row_h + 0.004)
            pager.y -= row_h
        if table["row_count"] > len(shown):
            muted(ax, f"{table['row_count'] - len(shown)} more rows omitted", pager.y)
            pager.y -= 0.02
        pager.y -= 0.02


def _fmt(value: Any) -> str:
    if value is None:
        return "—"
    if isinstance(value, float):
        return f"{value:g}"
    if isinstance(value, list):
        return ", ".join(_fmt(item) for item in value)
    text = str(value)
    return text if len(text) <= 40 else text[:37] + "…"


def write_report(
    url: str,
    out: Path,
    *,
    widget_patches: list[dict[str, Any]] | None = None,
) -> Path:
    """Create a session, optionally apply widget patches, and write a PDF."""
    family, code_family = sl.register_fonts()
    sl.apply_rcparams(family, code_family)

    snapshots = [("Initial run", interact(url, {}))]
    session_id = snapshots[0][1].get("session_id")
    for patch in widget_patches or []:
        label = ", ".join(f"{k}={v}" for k, v in patch.items())
        snapshots.append(
            (
                f"After {label}",
                interact(url, {"session_id": session_id, "widget_state": patch}),
            )
        )

    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with PdfPages(out) as pdf:
        pager = Pager(pdf)
        for i, (label, snapshot) in enumerate(snapshots):
            heading_text = label if i else None
            render_snapshot(pager, collect(snapshot), heading_text=heading_text)
        pager.close()
    return out


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--url", default=DEFAULT_URL, help="Agent interact URL")
    parser.add_argument(
        "--out",
        default=str(Path.cwd() / "report.pdf"),
        help="PDF output path",
    )
    parser.add_argument(
        "--set",
        dest="sets",
        action="append",
        default=[],
        metavar="JSON",
        help="widget_state object to apply after create; repeatable",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    patches: list[dict[str, Any]] = []
    for raw in args.sets:
        try:
            patch = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise SystemExit(f"Invalid --set JSON: {raw}") from exc
        if not isinstance(patch, dict):
            raise SystemExit("--set must be a JSON object of widget_state")
        patches.append(patch)
    try:
        out = write_report(
            interact_url(args.url), Path(args.out), widget_patches=patches
        )
    except AgentClientError as exc:
        raise SystemExit(str(exc)) from exc
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
