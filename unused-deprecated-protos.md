# Proto Fields and Messages - Cleanup Status

Generated: 2026-01-29
Updated: 2026-01-30

---

## Summary

| Category | Count | Status |
|----------|-------|--------|
| Deleted proto files | 4 | ✅ Done |
| Removed unused messages | 2 | ✅ Done |
| Removed unused fields | 24 | ✅ Done |
| Deprecated fields still in use | ~8 | ⏳ Remaining |

---

## Completed Cleanup

### Deleted Proto Files

| File | Replacement | Status |
|------|-------------|--------|
| `DataFrame.proto` | `Arrow.proto` | ✅ Deleted |
| `VegaLiteChart.proto` | `ArrowVegaLiteChart.proto` | ✅ Deleted |
| `NamedDataSet.proto` | `ArrowNamedDataSet.proto` | ✅ Deleted |
| `PagesChanged.proto` | Removed from protocol | ✅ Deleted |

### Removed Messages

| Message | File | Status |
|---------|------|--------|
| `Figure` | PlotlyChart.proto | ✅ Removed |
| `ElementDimensionSpec` | ForwardMsg.proto | ✅ Removed |

### Removed Fields

| Proto File | Removed Fields | Reserved Numbers |
|------------|----------------|------------------|
| Element.proto | `data_frame`, `table`, `vega_lite_chart` | 3, 9, 10, 11 |
| ForwardMsg.proto | `pages_changed` | 16 |
| ForwardMsgMetadata | `element_dimension_spec` | 3 |
| Delta.proto | `add_rows` (NamedDataSet) | 5 |
| PlotlyChart.proto | `use_container_width`, `url`, `figure` | 1, 2, 5 |
| Code.proto | `height` | 5 |
| IFrame.proto | `width`, `has_width`, `height` | 3, 4, 5 |
| Button.proto | `use_container_width` | 9 |
| Block.Vertical | `height` | 2 |
| Block.Column | `gap` | 2 |
| Block.Popover | `use_container_width` | 2 |
| TextArea.proto | `height` | 4 |
| GraphVizChart.proto | `use_container_width` | 4 |
| DeckGlJsonChart.proto | `use_container_width`, `width`, `height` | 4, 7, 8 |
| ChatInput.proto | `position` + `Position` enum | 8 |
| Common.UploadedFileInfo | `id` | 1 |
| Common.FileUploaderState | `max_file_id` | 1 |
| Selectbox.proto | `value` (int32) | 7 |
| MultiSelect.proto | `value` (int32[]) | 7 |
| Radio.proto | `value` (int32) | 7 |
| Arrow.proto | `width`, `height`, `use_container_width` | 3, 4, 5 |
| Image.proto (ImageList) | `width` | 2 |

### Widget Value Fields Migration (Completed)

Migrated from deprecated int32 index fields to string-based `raw_value`/`raw_values`:

| Field Removed | File | Replacement |
|---------------|------|-------------|
| `Selectbox.value` | Selectbox.proto | `raw_value` (string) |
| `MultiSelect.value` | MultiSelect.proto | `raw_values` (string[]) |
| `Radio.value` | Radio.proto | `raw_value` (string) |

### Arrow/Image Dimension Fields Migration (Completed)

Migrated from deprecated element-level dimension fields to `Element.width_config`/`Element.height_config`:

| Field Removed | File | Replacement |
|---------------|------|-------------|
| `Arrow.width` | Arrow.proto | `Element.width_config.pixel_width` |
| `Arrow.height` | Arrow.proto | `Element.height_config.pixel_height` |
| `Arrow.use_container_width` | Arrow.proto | `Element.width_config.use_stretch` |
| `ImageList.width` | Image.proto | `Element.width_config` |

Frontend fallback code removed from:
- `dimensionUtils.ts` - Removed element parameter from width/height utility functions
- `ImageList.tsx` - Removed `WidthBehavior` enum and legacy width handling
- `useTableSizer.ts` - Updated to use only widthConfig/heightConfig
- `useColumnLoader.ts` - Updated to use only widthConfig

---

## Remaining: Deprecated But Still In Use

These fields are marked deprecated but are **still actively used** and cannot be removed yet.

### 1. StringTriggerValue (widget state)

**Status:** Still actively used in session state handling.

| Field | File | Usage |
|-------|------|-------|
| `StringTriggerValue` | WidgetStates.proto:55 | `session_state.py`, `common.py`, `element_tree.py` |

**Next Steps:**
- Migrate to `ChatInputValue` as noted in the deprecation comment
- Update session state handling code
- Remove deprecated message

### 2. Theme Configuration Fields (backward compatibility)

**Status:** Tested in `proto_compatibility_test.py` - must be kept for external API stability.

| Field | File | Notes |
|-------|------|-------|
| `CustomThemeConfig.font` | NewSession.proto:149 | Use `body_font` instead |
| `CustomThemeConfig.radii` | NewSession.proto:167 | Use `base_radius` instead |
| `CustomThemeConfig.font_sizes` | NewSession.proto:174 | Use `base_font_size` instead |
| `CustomThemeConfig.widget_background_color` | NewSession.proto:163 | No longer applied |
| `CustomThemeConfig.widget_border_color` | NewSession.proto:165 | Use `border_color` instead |
| `CustomThemeConfig.skeleton_background_color` | NewSession.proto:176 | No longer applied |
| `FontFace.weight` | NewSession.proto:239 | Use `weight_range` instead |
| `Radii` message | NewSession.proto:255 | Use `base_radius` instead |
| `FontSizes` message | NewSession.proto:262 | Use `base_font_size` instead |

**Next Steps:**
- These are kept for backward compatibility with external consumers
- Consider deprecation timeline for major version bump
- Update `proto_compatibility_test.py` when ready to remove

### 3. Config Fields (still in codebase)

**Status:** Deprecated but still present in code for compatibility.

| Field | File | Notes |
|-------|------|-------|
| `Initialize.command_line` | NewSession.proto:83 | Deprecated for security reasons |
| `Config.mapbox_token` | NewSession.proto:105 | Moved to `DeckGlJsonChart.mapbox_token` |

**Next Steps:**
- `command_line`: Can be removed when all clients are updated
- `mapbox_token`: Keep for backward compatibility or migrate consumers

---

## Reserved Fields Reference

All reserved field numbers for backward protocol compatibility:

| File | Reserved Numbers | Reserved Names |
|------|------------------|----------------|
| Element.proto | 3, 9, 10, 11 | `data_frame`, `vega_lite_chart`, `table` |
| ForwardMsg.proto | 7, 8, 16 | `pages_changed` |
| ForwardMsgMetadata | 3 | `element_dimension_spec` |
| Delta.proto | 5 | `add_rows` |
| PlotlyChart.proto | 1, 2, 3, 4, 5 | `url`, `figure`, `use_container_width` |
| Code.proto | 5 | `height` |
| IFrame.proto | 3, 4, 5 | `width`, `has_width`, `height` |
| Button.proto | 9 | `use_container_width` |
| Block.Vertical | 2 | `height` |
| Block.Column | 2 | `gap` |
| Block.Popover | 2 | `use_container_width` |
| TextArea.proto | 4 | `height` |
| GraphVizChart.proto | 2, 3, 4 | `use_container_width` |
| DeckGlJsonChart.proto | 4, 7, 8 | `use_container_width`, `width`, `height` |
| ChatInput.proto | 8 | `position` |
| Common.UploadedFileInfo | 1 | `id` |
| Common.FileUploaderState | 1 | `max_file_id` |
| ArrowVegaLiteChart.proto | 3 | - |
| Audio.proto | 1, 2, 4 | `data`, `format` |
| Video.proto | 1, 2, 4 | `format`, `data` |
| BackMsg.proto | 1, 2, 3, 4, 8, 9, 10 | - |
| DocString.proto | 1, 2, 5 | - |
| Balloons.proto | 1, 2 | - |
| NumberInput.proto | 4, 5, 6, 7, 9, 10 | - |
| FileUploader.proto | 5 | - |
| NewSession.proto | 5 | - |
| NewSession.Config | 1 | - |
| NewSession.UserInfo | 2 | - |
| Image.proto (Image) | 1 | `data` |
| Image.proto (ImageList) | 2 | `width` |
| Selectbox.proto | 7 | `value` |
| MultiSelect.proto | 7 | `value` |
| Radio.proto | 7 | `value` |
| Arrow.proto | 3, 4, 5 | `width`, `height`, `use_container_width` |

---

## Next Steps

1. **StringTriggerValue migration** - Migrate to `ChatInputValue` for chat input widget state
2. **Theme config deprecation** - Plan timeline for removing deprecated theme fields in next major version
3. **Config field cleanup** - Remove `command_line` and evaluate `mapbox_token` migration
