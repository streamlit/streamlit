# Test Coverage Extension Plan

This document outlines the top 20 tests that should be added to improve Python unit test coverage in the Streamlit codebase. Tests are prioritized based on:

1. **Impact** - Number of uncovered lines
2. **Importance** - Criticality of the functionality
3. **Testability** - Feasibility of adding unit tests

**Current overall coverage: 92.5%** (21,064 covered / 22,782 total statements)

---

## Priority 1: High Impact Tests

### 1. LangChain Callback Handler (41.8% coverage, 82 uncovered lines)

**File:** `lib/streamlit/external/langchain/streamlit_callback_handler.py`

**Uncovered functions:**
- `LLMThought.complete()` - 0% (11 lines)
- `LLMThoughtLabeler.get_tool_label()` - 0% (10 lines)
- `LLMThought.__init__()` - 0% (7 lines)
- `LLMThought.on_tool_start()` - 0% (6 lines)
- `LLMThought.on_llm_new_token()` - 0% (4 lines)
- `StreamlitCallbackHandler._complete_current_thought()` - 0% (4 lines)

**Recommended tests:**
```python
# lib/tests/streamlit/external/langchain/streamlit_callback_handler_test.py

class LLMThoughtTest(DeltaGeneratorTestCase):
    """Test LLMThought lifecycle and UI state management."""

    def test_llm_thought_initialization(self):
        """Test LLMThought creates status container with initial label."""

    def test_on_tool_start_updates_state_and_label(self):
        """Test tool start changes state to RUNNING_TOOL and updates label."""

    def test_complete_with_tool_state(self):
        """Test complete() when state is RUNNING_TOOL uses tool label."""

    def test_complete_with_exception_tool(self):
        """Test complete() sets ERROR state when tool name is _Exception."""

    def test_on_llm_new_token_streaming(self):
        """Test streaming token accumulation and placeholder updates."""

class LLMThoughtLabelerTest(unittest.TestCase):
    """Test label generation logic."""

    def test_get_tool_label_truncates_long_input(self):
        """Test input strings > 60 chars are truncated with ellipsis."""

    def test_get_tool_label_exception_renamed(self):
        """Test _Exception tool name is displayed as 'Parsing error'."""
```

**Why important:** This is the lowest coverage file (41.8%). LangChain integration is a public API that must remain stable.

---

### 2. Starlette Routes (75.1% coverage, 86 uncovered lines)

**File:** `lib/streamlit/web/server/starlette/starlette_routes.py`

**Uncovered functions:**
- `create_app_static_serving_routes._app_static_endpoint` - 0% (20 lines)
- `create_bidi_component_routes._bidi_component_endpoint` - 65.6% (11 lines)
- `create_app_static_serving_routes` - 0% (8 lines)
- `create_metrics_routes._metrics_options` - 0% (5 lines)

**Recommended tests:**
```python
# lib/tests/streamlit/web/server/starlette/starlette_routes_test.py

class AppStaticServingRoutesTest(unittest.TestCase):
    """Test static file serving for app assets."""

    def test_app_static_endpoint_serves_file(self):
        """Test serving static files from app directory."""

    def test_app_static_endpoint_handles_missing_file(self):
        """Test 404 response for non-existent files."""

    def test_app_static_options_returns_cors_headers(self):
        """Test OPTIONS preflight returns correct CORS headers."""

class MetricsRoutesTest(unittest.TestCase):
    """Test Prometheus metrics endpoint."""

    def test_metrics_options_returns_cors_headers(self):
        """Test OPTIONS request for metrics endpoint."""
```

**Why important:** Web server routes are critical infrastructure that handle all HTTP requests.

---

### 3. Browser WebSocket Handler (75.5% coverage, 36 uncovered lines)

**File:** `lib/streamlit/web/server/browser_websocket_handler.py`

**Uncovered functions:**
- `BrowserWebSocketHandler.open()` - 56.7% (13 lines)
- `BrowserWebSocketHandler._parse_user_cookie()` - 8.3% (11 lines)
- `BrowserWebSocketHandler._validate_xsrf_token()` - 0% (7 lines)

**Recommended tests:**
```python
# lib/tests/streamlit/web/server/browser_websocket_handler_test.py

class BrowserWebSocketHandlerTest(tornado.testing.AsyncHTTPTestCase):
    """Test WebSocket connection handling."""

    def test_open_with_valid_auth_cookie_extracts_user_info(self):
        """Test user info extraction from valid signed auth cookie."""

    def test_open_with_xsrf_validates_token(self):
        """Test XSRF token validation during WebSocket open."""

    def test_parse_user_cookie_validates_origin(self):
        """Test origin validation in cookie parsing."""

    def test_parse_user_cookie_rejects_mismatched_origin(self):
        """Test origin mismatch is logged and user_info is empty."""

    def test_validate_xsrf_token_returns_false_for_empty_token(self):
        """Test XSRF validation rejects empty tokens."""

    def test_open_with_existing_session_id_reconnects(self):
        """Test session reconnection via Sec-WebSocket-Protocol header."""
```

**Why important:** WebSocket handler manages all browser connections - critical for security (XSRF, auth).

---

### 4. App Session (81.4% coverage, 85 uncovered lines)

**File:** `lib/streamlit/runtime/app_session.py`

**Uncovered functions:**
- `_populate_theme_msg()` - 59.4% (28 lines)
- `AppSession._handle_git_information_request()` - 0% (23 lines)
- `_parse_and_populate_chart_colors()` - 43.8% (9 lines)

**Recommended tests:**
```python
# lib/tests/streamlit/runtime/app_session_test.py (extend existing)

class AppSessionThemeTest(unittest.TestCase):
    """Test theme population logic."""

    def test_populate_theme_msg_with_custom_theme(self):
        """Test custom theme config is properly serialized to protobuf."""

    def test_parse_chart_colors_with_diverging_colors(self):
        """Test diverging color palette parsing."""

    def test_parse_chart_colors_handles_invalid_config(self):
        """Test graceful handling of invalid color config."""

class AppSessionGitInfoTest(unittest.TestCase):
    """Test git information request handling."""

    def test_handle_git_information_request_returns_git_info(self):
        """Test git info is returned when in git repo."""

    def test_handle_git_information_request_handles_no_git(self):
        """Test graceful handling when not in git repo."""
```

**Why important:** AppSession is the core session management class - handles all user sessions.

---

### 5. Chat Widgets (75.5% coverage, 58 uncovered lines)

**File:** `lib/streamlit/elements/widgets/chat.py`

**Uncovered functions:**
- `_pop_upload_files()` - 0% (19 lines)
- `_pop_audio_file()` - 0% (17 lines)
- `ChatInputValue.__delitem__()` - 0% (6 lines)
- `ChatInputSerde.deserialize()` - 40% (6 lines)

**Recommended tests:**
```python
# lib/tests/streamlit/elements/widgets/chat_test.py (new file)

class ChatInputSerdeTest(unittest.TestCase):
    """Test chat input serialization/deserialization."""

    def test_deserialize_with_file_uploads(self):
        """Test deserialization handles file upload data."""

    def test_deserialize_with_audio_file(self):
        """Test deserialization handles audio file data."""

    def test_serialize_returns_empty_string(self):
        """Test serialize returns expected format."""

class ChatInputValueTest(unittest.TestCase):
    """Test ChatInputValue dict-like interface."""

    def test_delitem_removes_key(self):
        """Test __delitem__ removes key from underlying dict."""

    def test_setitem_sets_value(self):
        """Test __setitem__ sets value in underlying dict."""

    def test_pop_upload_files_extracts_files(self):
        """Test _pop_upload_files correctly extracts uploaded files."""

    def test_pop_audio_file_extracts_audio(self):
        """Test _pop_audio_file correctly extracts audio data."""
```

**Why important:** Chat widgets are heavily used features, especially with AI/LLM applications.

---

## Priority 2: Medium Impact Tests

### 6. Write Element (80.7% coverage, 32 uncovered lines)

**File:** `lib/streamlit/elements/write.py`

**Uncovered functions:**
- `WriteMixin.write()` - 74.7% (22 lines)
- `WriteMixin.write_stream()` - 79.6% (10 lines)

**Recommended tests:**
```python
# lib/tests/streamlit/elements/write_test.py (extend existing)

class WriteElementTest(DeltaGeneratorTestCase):
    """Test st.write with various input types."""

    def test_write_with_generator(self):
        """Test st.write handles generator objects."""

    def test_write_with_async_generator(self):
        """Test st.write handles async generators."""

    def test_write_stream_with_empty_stream(self):
        """Test write_stream handles empty streams gracefully."""

    def test_write_stream_concatenates_chunks(self):
        """Test write_stream properly concatenates stream chunks."""
```

**Why important:** `st.write` is one of the most commonly used Streamlit functions.

---

### 7. Auth Utilities (82.6% coverage, 35 uncovered lines)

**File:** `lib/streamlit/auth_util.py`

**Uncovered functions:**
- `generate_default_provider_section()` - 0% (12 lines)
- `validate_auth_credentials()` - 76.9% (6 lines)
- `is_authlib_installed()` - 66.7% (3 lines)

**Recommended tests:**
```python
# lib/tests/streamlit/auth_util_test.py (extend existing)

class AuthUtilTest(unittest.TestCase):
    """Test authentication utilities."""

    def test_generate_default_provider_section(self):
        """Test default OAuth provider section generation."""

    def test_validate_auth_credentials_with_missing_fields(self):
        """Test validation catches missing required fields."""

    def test_is_authlib_installed_when_missing(self):
        """Test detection when authlib is not installed."""

    def test_set_split_cookie_handles_large_values(self):
        """Test cookie splitting for large values."""
```

**Why important:** Authentication is critical for security and access control.

---

### 8. OAuth Authlib Routes (79.3% coverage, 38 uncovered lines)

**File:** `lib/streamlit/web/server/oauth_authlib_routes.py`

**Uncovered functions:**
- `AuthLogoutHandler._get_provider_logout_url()` - 72.7% (9 lines)
- `AuthHandlerMixin._set_single_cookie()` - 0% (4 lines)
- `AuthHandlerMixin._create_signed_value()` - 0% (4 lines)

**Recommended tests:**
```python
# lib/tests/streamlit/web/server/oauth_authlib_routes_test.py (extend existing)

class AuthLogoutHandlerTest(tornado.testing.AsyncHTTPTestCase):
    """Test OAuth logout flow."""

    def test_get_provider_logout_url_for_google(self):
        """Test Google logout URL generation."""

    def test_get_provider_logout_url_for_azure(self):
        """Test Azure AD logout URL generation."""

    def test_get_redirect_uri_with_custom_config(self):
        """Test custom redirect URI from config."""

class AuthHandlerMixinTest(unittest.TestCase):
    """Test auth handler cookie utilities."""

    def test_set_single_cookie(self):
        """Test setting a single signed cookie."""

    def test_create_signed_value(self):
        """Test signed value creation."""
```

**Why important:** OAuth routes handle third-party authentication flows.

---

### 9. Starlette Auth Routes (77.6% coverage, 45 uncovered lines)

**File:** `lib/streamlit/web/server/starlette/starlette_auth_routes.py`

**Uncovered functions:**
- `_create_oauth_client()` - 0% (20 lines)
- `_AuthlibConfig.get()` - 0% (11 lines)
- `_normalize_nested_config()` - 0% (5 lines)

**Recommended tests:**
```python
# lib/tests/streamlit/web/server/starlette/starlette_auth_routes_test.py (new file)

class StarletteOAuthClientTest(unittest.TestCase):
    """Test Starlette OAuth client creation."""

    def test_create_oauth_client_with_google(self):
        """Test OAuth client creation for Google provider."""

    def test_create_oauth_client_with_custom_provider(self):
        """Test OAuth client creation for custom provider."""

class AuthlibConfigTest(unittest.TestCase):
    """Test Authlib configuration wrapper."""

    def test_get_returns_config_value(self):
        """Test get() returns correct config value."""

    def test_normalize_nested_config(self):
        """Test nested config normalization."""
```

**Why important:** Starlette auth routes are the modern async implementation of OAuth.

---

### 10. File Uploader Widget (83.3% coverage, 18 uncovered lines)

**File:** `lib/streamlit/elements/widgets/file_uploader.py`

**Uncovered functions:**
- `_get_upload_files()` - 11.1% (16 lines)
- `FileUploaderSerde.serialize()` - 85.7% (2 lines)

**Recommended tests:**
```python
# lib/tests/streamlit/elements/widgets/file_uploader_test.py (extend existing)

class FileUploaderTest(DeltaGeneratorTestCase):
    """Test file uploader widget."""

    def test_get_upload_files_returns_uploaded_files(self):
        """Test _get_upload_files retrieves files from upload manager."""

    def test_get_upload_files_handles_missing_files(self):
        """Test graceful handling when files are not found."""

    def test_serialize_returns_file_ids(self):
        """Test serialization returns correct file ID list."""
```

**Why important:** File uploads are a common user interaction pattern.

---

### 11. Upload File Request Handler (76.3% coverage, 14 uncovered lines)

**File:** `lib/streamlit/web/server/upload_file_request_handler.py`

**Uncovered functions:**
- `UploadFileRequestHandler.delete()` - 0% (7 lines)
- `UploadFileRequestHandler.put()` - 78.3% (5 lines)
- `UploadFileRequestHandler.options()` - 0% (2 lines)

**Recommended tests:**
```python
# lib/tests/streamlit/web/server/upload_file_request_handler_test.py (extend existing)

class UploadFileRequestHandlerTest(tornado.testing.AsyncHTTPTestCase):
    """Test file upload HTTP handlers."""

    def test_delete_removes_uploaded_file(self):
        """Test DELETE request removes file from storage."""

    def test_delete_handles_nonexistent_file(self):
        """Test DELETE returns 404 for missing files."""

    def test_options_returns_cors_headers(self):
        """Test OPTIONS preflight request."""

    def test_put_handles_invalid_session(self):
        """Test PUT with invalid session ID."""
```

**Why important:** File upload handler processes all uploaded file data.

---

### 12. Echo Command (79.6% coverage, 11 uncovered lines)

**File:** `lib/streamlit/commands/echo.py`

**Uncovered functions:**
- `_get_initial_indent()` - 0% (5 lines)
- `_get_indent()` - 0% (4 lines)

**Recommended tests:**
```python
# lib/tests/streamlit/commands/echo_test.py (new file)

class EchoTest(DeltaGeneratorTestCase):
    """Test st.echo functionality."""

    def test_get_initial_indent_with_spaces(self):
        """Test initial indent detection with space indentation."""

    def test_get_initial_indent_with_tabs(self):
        """Test initial indent detection with tab indentation."""

    def test_get_indent_returns_correct_level(self):
        """Test indent level calculation."""

    def test_echo_displays_code_block(self):
        """Test echo context manager displays source code."""
```

**Why important:** `st.echo` is used for documentation and teaching examples.

---

### 13. Camera Input Widget (83.9% coverage, 10 uncovered lines)

**File:** `lib/streamlit/elements/widgets/camera_input.py`

**Uncovered functions:**
- `CameraInputSerde.serialize()` - 0% (9 lines)

**Recommended tests:**
```python
# lib/tests/streamlit/elements/widgets/camera_input_test.py (extend existing)

class CameraInputSerdeTest(unittest.TestCase):
    """Test camera input serialization."""

    def test_serialize_with_captured_image(self):
        """Test serialization of captured camera image."""

    def test_serialize_with_no_image(self):
        """Test serialization when no image captured."""
```

**Why important:** Camera input is used for ML/computer vision applications.

---

### 14. Audio Input Widget (85.3% coverage, 10 uncovered lines)

**File:** `lib/streamlit/elements/widgets/audio_input.py`

**Uncovered functions:**
- `AudioInputSerde.serialize()` - 0% (9 lines)

**Recommended tests:**
```python
# lib/tests/streamlit/elements/widgets/audio_input_test.py (extend existing)

class AudioInputSerdeTest(unittest.TestCase):
    """Test audio input serialization."""

    def test_serialize_with_recorded_audio(self):
        """Test serialization of recorded audio."""

    def test_serialize_with_no_audio(self):
        """Test serialization when no audio recorded."""
```

**Why important:** Audio input is used for speech/audio ML applications.

---

### 15. Subtitle Utilities (82.9% coverage, 13 uncovered lines)

**File:** `lib/streamlit/elements/lib/subtitle_utils.py`

**Uncovered functions:**
- `_srt_to_vtt()` - 70% (3 lines)
- `_handle_stream_data()` - 0% (3 lines)
- `process_subtitle_data()` - 76.9% (3 lines)

**Recommended tests:**
```python
# lib/tests/streamlit/elements/lib/subtitle_utils_test.py (new file)

class SubtitleUtilsTest(unittest.TestCase):
    """Test subtitle processing utilities."""

    def test_srt_to_vtt_conversion(self):
        """Test SRT to VTT format conversion."""

    def test_handle_stream_data(self):
        """Test processing subtitle data from stream."""

    def test_process_subtitle_data_with_srt(self):
        """Test processing SRT subtitle file."""

    def test_is_srt_detection(self):
        """Test SRT format detection."""
```

**Why important:** Subtitle support enables video accessibility features.

---

### 16. Logo Command (85.4% coverage, 6 uncovered lines)

**File:** `lib/streamlit/commands/logo.py`

**Uncovered functions:**
- `logo()` - 77.3% (5 lines)
- `_invalid_logo_text()` - 0% (1 line)

**Recommended tests:**
```python
# lib/tests/streamlit/commands/logo_test.py (extend existing)

class LogoTest(DeltaGeneratorTestCase):
    """Test st.logo functionality."""

    def test_logo_with_invalid_image_path(self):
        """Test error handling for invalid image path."""

    def test_invalid_logo_text_returns_error_message(self):
        """Test error message generation."""

    def test_logo_with_link(self):
        """Test logo with clickable link."""
```

**Why important:** Logo is commonly used for branding in Streamlit apps.

---

### 17. Component V2 Presentation (77.4% coverage, 19 uncovered lines)

**File:** `lib/streamlit/components/v2/presentation.py`

**Uncovered functions:**
- `_WriteThrough.__delitem__()` - 12.5% (7 lines)
- `_WriteThrough.__setattr__()` - 0% (4 lines)

**Recommended tests:**
```python
# lib/tests/streamlit/components/v2/presentation_test.py (new file)

class WriteThroughTest(unittest.TestCase):
    """Test WriteThrough proxy object."""

    def test_delitem_removes_attribute(self):
        """Test __delitem__ removes attribute from target."""

    def test_setattr_sets_attribute(self):
        """Test __setattr__ sets attribute on target."""

    def test_setitem_with_nested_object(self):
        """Test __setitem__ with nested object assignment."""
```

**Why important:** Component V2 is the modern component architecture.

---

### 18. Component V1 Arrow (75.8% coverage, 8 uncovered lines)

**File:** `lib/streamlit/components/v1/component_arrow.py`

**Uncovered functions:**
- `arrow_proto_to_dataframe()` - 0% (7 lines)

**Recommended tests:**
```python
# lib/tests/streamlit/components/v1/component_arrow_test.py (new file)

class ComponentArrowTest(unittest.TestCase):
    """Test Arrow data conversion for components."""

    def test_arrow_proto_to_dataframe(self):
        """Test converting Arrow proto to pandas DataFrame."""

    def test_arrow_proto_to_dataframe_with_empty_data(self):
        """Test handling empty Arrow data."""
```

**Why important:** Arrow conversion is used by many custom components.

---

### 19. Snowflake Connection (81.4% coverage, 18 uncovered lines)

**File:** `lib/streamlit/connections/snowflake_connection.py`

**Uncovered functions:**
- `BaseSnowflakeConnection.session` - 0% (5 lines)
- `BaseSnowflakeConnection.write_pandas()` - 0% (3 lines)
- `BaseSnowflakeConnection.close()` - 0% (2 lines)

**Recommended tests:**
```python
# lib/tests/streamlit/connections/snowflake_connection_test.py (extend existing)

class SnowflakeConnectionTest(unittest.TestCase):
    """Test Snowflake connection interface."""

    @patch('snowflake.connector.connect')
    def test_session_returns_snowpark_session(self, mock_connect):
        """Test session property returns Snowpark session."""

    @patch('snowflake.connector.connect')
    def test_write_pandas_uploads_dataframe(self, mock_connect):
        """Test write_pandas uploads DataFrame to Snowflake."""

    @patch('snowflake.connector.connect')
    def test_close_closes_connection(self, mock_connect):
        """Test close() properly closes connection."""
```

**Why important:** Snowflake integration is key for enterprise data apps.

---

### 20. Testing Element Tree (93.6% coverage, 87 uncovered lines)

**File:** `lib/streamlit/testing/v1/element_tree.py`

**Uncovered functions:**
- `ButtonGroup.unselect()` - 0% (8 lines)
- `ButtonGroup.select()` - 0% (7 lines)
- `UnknownElement.__init__()` - 0% (6 lines)
- `UnknownElement.value` - 0% (6 lines)

**Recommended tests:**
```python
# lib/tests/streamlit/testing/v1/element_tree_test.py (extend existing)

class ButtonGroupTest(unittest.TestCase):
    """Test ButtonGroup testing interface."""

    def test_select_button_by_index(self):
        """Test selecting button by index."""

    def test_unselect_button(self):
        """Test unselecting a button."""

    def test_value_returns_selected_state(self):
        """Test value property returns selection state."""

class UnknownElementTest(unittest.TestCase):
    """Test UnknownElement fallback handling."""

    def test_unknown_element_initialization(self):
        """Test UnknownElement stores proto data."""

    def test_unknown_element_value(self):
        """Test value property for unknown elements."""
```

**Why important:** Testing framework quality affects all Streamlit app testing.

---

## Summary

| Priority | File | Current Coverage | Lines to Cover | Test Category |
|----------|------|------------------|----------------|---------------|
| 1 | langchain/streamlit_callback_handler.py | 41.8% | 82 | Integration |
| 2 | starlette/starlette_routes.py | 75.1% | 86 | Web Server |
| 3 | browser_websocket_handler.py | 75.5% | 36 | Web Server |
| 4 | runtime/app_session.py | 81.4% | 85 | Runtime |
| 5 | widgets/chat.py | 75.5% | 58 | Elements |
| 6 | elements/write.py | 80.7% | 32 | Elements |
| 7 | auth_util.py | 82.6% | 35 | Auth |
| 8 | oauth_authlib_routes.py | 79.3% | 38 | Auth |
| 9 | starlette/starlette_auth_routes.py | 77.6% | 45 | Auth |
| 10 | widgets/file_uploader.py | 83.3% | 18 | Elements |
| 11 | upload_file_request_handler.py | 76.3% | 14 | Web Server |
| 12 | commands/echo.py | 79.6% | 11 | Commands |
| 13 | widgets/camera_input.py | 83.9% | 10 | Elements |
| 14 | widgets/audio_input.py | 85.3% | 10 | Elements |
| 15 | lib/subtitle_utils.py | 82.9% | 13 | Utilities |
| 16 | commands/logo.py | 85.4% | 6 | Commands |
| 17 | components/v2/presentation.py | 77.4% | 19 | Components |
| 18 | components/v1/component_arrow.py | 75.8% | 8 | Components |
| 19 | connections/snowflake_connection.py | 81.4% | 18 | Connections |
| 20 | testing/v1/element_tree.py | 93.6% | 87 | Testing |

**Total lines that would be covered by implementing all 20 test areas: ~726 lines**

**Projected coverage improvement: ~3.2% (from 92.5% to ~95.7%)**

---

## Implementation Notes

### Testing Patterns to Follow

1. **Widget tests** should extend `DeltaGeneratorTestCase` to access the mock runtime and forward message queue
2. **Server tests** should use `tornado.testing.AsyncHTTPTestCase` for async HTTP testing
3. **Use `@patch_config_options`** decorator for tests that depend on config values
4. **Mock external dependencies** (Snowflake, LangChain) to avoid integration test requirements
5. **Use parameterized tests** (`@parameterized.expand`) to reduce code duplication

### Running Tests

```bash
# Run specific test file
pytest lib/tests/streamlit/external/langchain/streamlit_callback_handler_test.py -v

# Run with coverage
pytest lib/tests/streamlit/external/langchain/ --cov=lib/streamlit/external/langchain --cov-report=term-missing
```
