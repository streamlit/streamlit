# Deep Dive: `st.agent` Abstractions for Streamlit

## Executive Summary

After analyzing Streamlit's existing patterns and real-world agent UI requirements, **I recommend against a monolithic `st.agent()` component**. Instead, Streamlit should provide **composable building blocks** that work with existing primitives (`st.chat_message`, `st.status`, `st.write_stream`).

The key insight: **Agent UIs are fundamentally about displaying intermediate steps, not orchestrating agents.** Streamlit should stay true to its philosophy of being a **display layer**, not an orchestration framework.

---

## Part 1: What Agent UIs Actually Need

### Real-World Agent Output Patterns

From analyzing LangChain, LangGraph, CrewAI, and OpenAI Assistants, agents produce these output types:

| Output Type | Description | Current Streamlit Support |
|-------------|-------------|---------------------------|
| **Text chunks** | Streaming LLM response | ✅ `st.write_stream` |
| **Tool calls** | Function invocation intent | ❌ No native support |
| **Tool results** | Output from tool execution | ❌ No native support |
| **Thinking/reasoning** | Chain-of-thought steps | ❌ No native support |
| **Artifacts** | Generated code, documents | ❌ No native support |
| **Sources/citations** | RAG retrieval results | ❌ No native support |
| **Errors** | Tool failures, API errors | ⚠️ `st.error` (not agent-specific) |

### Key Design Principle

**Don't orchestrate, visualize.** Streamlit should help developers DISPLAY agent activity, not manage agent logic. The agent framework (LangChain, CrewAI, custom) handles orchestration.

---

## Part 2: Proposed Building Blocks

### Recommended Approach: 4 New Components

Based on the analysis, I recommend **4 focused components** that compose naturally with existing Streamlit primitives:

```
┌─────────────────────────────────────────────────────────────┐
│                    st.chat_message("assistant")             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ st.write_stream(llm_response)  ← existing, works well │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ st.tool_call("search", {...})  ← NEW                  │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ st.thinking("Analyzing results...")  ← NEW            │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ st.artifact(code="...", language="python")  ← NEW     │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ st.sources([...])  ← NEW                              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 3: Detailed Component Specifications

### Component 1: `st.tool_call` ⭐ (Highest Priority)

**Purpose:** Display a tool/function call with its inputs and outputs in a collapsible container.

**Why it's needed:** Every agent framework emits tool calls. Currently, developers hack this with `st.expander` + `st.json`, which looks unprofessional.

**Design principles:**

- Builds on `st.status` pattern (expandable, stateful)
- Automatic serialization of arguments
- Clean, professional appearance

#### API Design

```python
# Basic usage - context manager pattern (like st.status)
with st.tool_call("web_search", args={"query": "Streamlit best practices"}) as tool:
    # Code runs, outputs render inside the collapsed area
    results = search_api.search("Streamlit best practices")
    st.dataframe(results)
    tool.result(results)  # Sets the result and state to "complete"

# Without context manager
tool = st.tool_call("calculate", args={"expression": "2 + 2"})
tool.write("Computing...")
result = eval("2 + 2")
tool.result(result, state="complete")

# Streaming/async pattern
tool = st.tool_call("code_execution", args={"code": code}, state="running")
for line in execute_code(code):
    tool.write(line)
tool.update(state="complete", result=output)

# Error handling
with st.tool_call("api_call", args={"url": url}) as tool:
    try:
        response = requests.get(url)
        tool.result(response.json())
    except Exception as e:
        tool.error(str(e))  # Sets state to "error"
```

#### Full Signature

```python
def tool_call(
    name: str,
    *,
    args: dict[str, Any] | None = None,
    icon: str | None = None,  # Auto-detected from name if None
    expanded: bool = False,
    state: Literal["pending", "running", "complete", "error"] = "running",
) -> ToolCallContainer:
    """Display a tool call with arguments and results.

    Parameters
    ----------
    name : str
        The name of the tool being called (e.g., "web_search", "code_interpreter").
        The name is displayed as the header.

    args : dict or None
        The arguments passed to the tool. Displayed as collapsible JSON.
        If None, no arguments section is shown.

    icon : str or None
        Icon to display next to the tool name. Supports:
        - Material icons: ":material/search:"
        - Emoji: "🔍"
        - None: Auto-detected based on common tool names

    expanded : bool
        Whether the tool call details are initially expanded (default: False).

    state : "pending", "running", "complete", "error"
        Initial state of the tool call:
        - "pending": Tool is queued (gray, no spinner)
        - "running": Tool is executing (spinner)
        - "complete": Tool finished successfully (checkmark)
        - "error": Tool failed (error icon)

    Returns
    -------
    ToolCallContainer
        A container that supports .write(), .result(), .error(), and .update().
    """
```

#### Visual Design

```
┌─────────────────────────────────────────────────────────────┐
│ 🔍 web_search                                    [▼] ✓     │
├─────────────────────────────────────────────────────────────┤
│ Arguments:                                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ {                                                       │ │
│ │   "query": "Streamlit best practices"                   │ │
│ │ }                                                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Result:                                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Found 5 results...                                      │ │
│ │ [dataframe or any Streamlit content]                    │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Why This Design?

1. **Follows `st.status` pattern** - Developers already understand expandable containers with states
2. **Arguments are visible** - Critical for debugging/transparency
3. **Flexible content** - Any Streamlit element can go inside
4. **Stateful** - Shows pending/running/complete/error clearly

---

### Component 2: `st.thinking`

**Purpose:** Display chain-of-thought, reasoning steps, or planning output from the LLM.

**Why it's needed:** Many models (Claude, o1, DeepSeek) produce explicit reasoning. Users want to see this "thinking" but not have it dominate the UI.

**Design principles:**

- Collapsed by default (it's secondary information)
- Streams nicely
- Visually distinct from main response

#### API Design

```python
# Basic usage - like st.expander but styled for thinking
with st.thinking("Analyzing your request..."):
    st.write("First, I need to understand the data structure...")
    st.write("Then, I'll identify the key patterns...")

# Streaming thinking (common with Claude/o1)
thinking = st.thinking("Reasoning...", expanded=False)
for chunk in model.stream_thinking():
    thinking.write(chunk)
thinking.update(label="Thought for 3.2s")

# With explicit content
st.thinking(
    "Planning approach",
    content="1. Parse the query\n2. Identify entities\n3. Generate response"
)

# Auto-collapse after completion
with st.thinking("Working...", collapse_on_complete=True) as t:
    # content streams here
    pass
# Automatically collapses when exiting
```

#### Full Signature

```python
def thinking(
    label: str = "Thinking...",
    *,
    content: str | None = None,
    expanded: bool = False,
    collapse_on_complete: bool = True,
    icon: str = ":material/psychology:",
) -> ThinkingContainer:
    """Display model thinking/reasoning in a collapsible container.

    Parameters
    ----------
    label : str
        The label shown when collapsed (default: "Thinking...").

    content : str or None
        If provided, displays this content immediately.
        If None, use .write() to add content.

    expanded : bool
        Whether thinking is initially expanded (default: False).

    collapse_on_complete : bool
        If True, auto-collapses when context manager exits (default: True).

    icon : str
        Icon to display. Defaults to brain/psychology icon.
    """
```

#### Visual Design

```
┌─────────────────────────────────────────────────────────────┐
│ 🧠 Thinking...                                         [▼]  │
├─────────────────────────────────────────────────────────────┤
│ Let me break down this problem:                             │
│                                                             │
│ 1. First, I need to parse the user's query to understand    │
│    what they're asking for...                               │
│ 2. The data appears to be a time series with...             │
│ 3. Given the constraints, I'll use approach X...            │
└─────────────────────────────────────────────────────────────┘
```

---

### Component 3: `st.artifact`

**Purpose:** Display generated code, documents, or other "artifacts" that the LLM produces, with copy/download/preview functionality.

**Why it's needed:** Claude's artifacts pattern is extremely popular. Agents frequently generate code, configs, documents, etc. that users want to copy/use.

**Design principles:**

- Code gets syntax highlighting
- Copy button is always visible
- Optional preview for HTML/images
- Download for files

#### API Design

```python
# Code artifact (most common)
st.artifact(
    content="import streamlit as st\n\nst.write('Hello!')",
    language="python",
    title="Generated App",
)

# With preview (for HTML)
st.artifact(
    content="<h1>Hello World</h1>",
    language="html",
    title="Preview",
    preview=True,  # Renders HTML in iframe
)

# Document artifact
st.artifact(
    content="# Report\n\nThis analysis shows...",
    language="markdown",
    title="Generated Report",
    downloadable=True,
    filename="report.md",
)

# Multiple artifacts in tabs
with st.artifacts() as arts:
    arts.add(code, language="python", title="main.py")
    arts.add(requirements, language="text", title="requirements.txt")
    arts.add(readme, language="markdown", title="README.md")
```

#### Full Signature

```python
def artifact(
    content: str,
    *,
    language: str = "text",
    title: str | None = None,
    preview: bool = False,
    downloadable: bool = True,
    filename: str | None = None,
    height: int | None = None,
) -> DeltaGenerator:
    """Display a generated artifact (code, document, etc.).

    Parameters
    ----------
    content : str
        The content of the artifact.

    language : str
        Language for syntax highlighting. Common values:
        "python", "javascript", "html", "css", "json", "markdown", "sql", "text"

    title : str or None
        Title displayed above the artifact. If None, uses the language name.

    preview : bool
        If True and language is "html", renders a live preview.
        If True and language is "markdown", renders markdown.

    downloadable : bool
        If True (default), shows a download button.

    filename : str or None
        Filename for download. Auto-generated if None.

    height : int or None
        Fixed height in pixels. If None, auto-sizes up to a max.
    """
```

#### Visual Design

```
┌─────────────────────────────────────────────────────────────┐
│ main.py                                    [📋 Copy] [⬇️]   │
├─────────────────────────────────────────────────────────────┤
│  1 │ import streamlit as st                                 │
│  2 │                                                        │
│  3 │ st.title("My App")                                     │
│  4 │                                                        │
│  5 │ data = st.file_uploader("Upload CSV")                  │
│  6 │ if data:                                               │
│  7 │     df = pd.read_csv(data)                             │
│  8 │     st.dataframe(df)                                   │
└─────────────────────────────────────────────────────────────┘
```

---

### Component 4: `st.sources`

**Purpose:** Display RAG retrieval results, citations, and references in a clean, scannable format.

**Why it's needed:** RAG apps are everywhere. Currently, developers build ugly custom solutions.

**Design principles:**

- Compact but informative
- Clickable to expand/view source
- Supports various source types (documents, URLs, database rows)

#### API Design

```python
# Basic usage with dictionaries
st.sources([
    {"title": "Streamlit Docs", "url": "https://docs.streamlit.io", "snippet": "..."},
    {"title": "GitHub Issue #123", "url": "https://github.com/...", "snippet": "..."},
])

# With Source objects (type-safe)
from streamlit import Source

st.sources([
    Source(title="Document A", content="Full text...", relevance=0.95),
    Source(title="Document B", content="Full text...", relevance=0.87),
])

# Inline citation style
st.markdown("According to the documentation [1], you should use...")
st.sources([...], style="footnotes")

# Expandable source cards
st.sources([...], style="cards", expanded=False)
```

#### Full Signature

```python
def sources(
    items: list[dict | Source],
    *,
    style: Literal["list", "cards", "footnotes"] = "cards",
    max_items: int | None = 5,
    show_relevance: bool = False,
    expanded: bool = False,
) -> DeltaGenerator:
    """Display source citations and references.

    Parameters
    ----------
    items : list of dict or Source
        List of sources. Each source should have at least a "title".
        Optional fields: "url", "snippet", "content", "relevance", "metadata"

    style : "list", "cards", "footnotes"
        - "list": Simple bulleted list
        - "cards": Expandable cards with snippets (default)
        - "footnotes": Numbered footnote style

    max_items : int or None
        Maximum number of sources to show initially. If more exist,
        shows "Show N more" button.

    show_relevance : bool
        If True, shows relevance scores (when provided).

    expanded : bool
        For "cards" style, whether cards are initially expanded.
    """
```

#### Visual Design

```
┌─────────────────────────────────────────────────────────────┐
│ Sources (3)                                                  │
├─────────────────────────────────────────────────────────────┤
│ 📄 Streamlit Documentation                             95%  │
│    "You can use st.cache_data to cache..."                  │
│    docs.streamlit.io/develop/api-reference                  │
├─────────────────────────────────────────────────────────────┤
│ 📄 GitHub Discussion #4521                             87%  │
│    "The recommended approach is to..."                      │
│    github.com/streamlit/streamlit/discussions/4521          │
├─────────────────────────────────────────────────────────────┤
│ 📄 Blog Post: Best Practices                           82%  │
│    "When building production apps..."                       │
│    blog.streamlit.io/best-practices                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 4: Integration Patterns

### Pattern 1: Basic Agent Chat

```python
import streamlit as st
from langchain.agents import create_openai_agent

# Initialize
agent = create_openai_agent(model="gpt-4", tools=[search, calculator])

# Chat loop
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.write(message["content"])

if prompt := st.chat_input("Ask me anything"):
    with st.chat_message("user"):
        st.write(prompt)

    with st.chat_message("assistant"):
        # Stream the agent response
        for event in agent.stream(prompt):
            if event.type == "tool_call":
                with st.tool_call(event.tool, args=event.args) as tool:
                    result = event.execute()
                    tool.result(result)

            elif event.type == "thinking":
                with st.thinking():
                    st.write(event.content)

            elif event.type == "text":
                st.write_stream(event.chunks)

            elif event.type == "artifact":
                st.artifact(event.content, language=event.language)
```

### Pattern 2: RAG with Sources

```python
with st.chat_message("assistant"):
    # Show retrieval
    with st.tool_call("retrieve", args={"query": query}) as retrieval:
        docs = retriever.get_relevant_documents(query)
        retrieval.result(f"Found {len(docs)} documents")

    # Generate response with citations
    response = st.write_stream(rag_chain.stream(query, docs))

    # Show sources
    st.sources([
        {"title": doc.metadata["title"], "snippet": doc.page_content[:200]}
        for doc in docs
    ])
```

### Pattern 3: Code Generation Agent

```python
with st.chat_message("assistant"):
    # Thinking phase
    with st.thinking("Planning the implementation..."):
        plan = st.write_stream(planner.stream(request))

    # Code generation
    with st.tool_call("code_generation") as gen:
        code = ""
        for chunk in coder.stream(plan):
            code += chunk
            gen.write(chunk)
        gen.result("Generated 47 lines of Python")

    # Show artifact
    st.artifact(code, language="python", title="Generated Code")

    # Optional: Execute
    if st.button("Run Code"):
        with st.tool_call("code_execution", args={"code": code[:50] + "..."}) as exec:
            output = execute_safely(code)
            exec.result(output)
```

---

## Part 5: What NOT to Build

### ❌ Don't build: `st.agent()` orchestrator

```python
# DON'T DO THIS - too opinionated, not Streamlit-like
agent = st.agent(
    model="gpt-4",
    tools=[search, calculator],
    system_prompt="You are helpful..."
)
response = agent.run(user_input)
```

**Why not:**

1. Streamlit is a display framework, not an agent framework
2. Everyone uses different agent libraries (LangChain, CrewAI, custom)
3. Model/tool configuration belongs in application code, not UI code
4. Limits flexibility and customization

### ❌ Don't build: Pre-made "chat app"

```python
# DON'T DO THIS - removes developer control
st.ai_chat(model="gpt-4", system="...")  # Magic complete chat app
```

**Why not:**

1. Developers want control over the UX
2. Different apps have different requirements
3. Can't customize appearance, behavior, or logic

### ❌ Don't build: Tool registration system

```python
# DON'T DO THIS - wrong layer of abstraction
@st.tool
def search(query: str):
    return api.search(query)

st.agent.register_tool(search)
```

**Why not:**

1. Tools are domain logic, not UI logic
2. Agent frameworks already handle tool registration
3. Would create vendor lock-in

---

## Part 6: Implementation Priorities

### Phase 1 (Q1 2026): Core Building Blocks

| Component | Effort | Impact | Priority |
|-----------|--------|--------|----------|
| `st.tool_call` | Medium | Very High | P0 |
| `st.thinking` | Low | High | P0 |
| `st.artifact` | Medium | High | P1 |

### Phase 2 (Q2 2026): Enhancements

| Component | Effort | Impact | Priority |
|-----------|--------|--------|----------|
| `st.sources` | Medium | Medium | P1 |
| Tool call auto-icons | Low | Low | P2 |
| Artifact preview modes | Medium | Medium | P2 |

### Implementation Notes

1. **`st.tool_call`** can be built on top of `st.status` - they share 90% of the logic
2. **`st.thinking`** is essentially a styled `st.expander`
3. **`st.artifact`** needs new frontend component (code block + toolbar)
4. **`st.sources`** can reuse `st.expander` internally

---

## Part 7: Open Questions

### Q1: Should `st.tool_call` auto-detect common tools?

```python
# Option A: Explicit icons always
st.tool_call("web_search", icon=":material/search:", ...)

# Option B: Auto-detect for common names
st.tool_call("web_search", ...)  # Auto-adds search icon
st.tool_call("code_interpreter", ...)  # Auto-adds code icon
```

**Recommendation:** Option B with override capability. Less boilerplate, better defaults.

### Q2: Should thinking support streaming?

```python
# Option A: Content only (simpler)
st.thinking("Planning", content="Here's my plan...")

# Option B: Streaming support (more flexible)
with st.thinking("Planning") as t:
    for chunk in stream:
        t.write(chunk)
```

**Recommendation:** Option B. Thinking is often streamed from models.

### Q3: How to handle nested tool calls?

```python
# Agents sometimes call tools that call other tools
with st.tool_call("orchestrator") as outer:
    with st.tool_call("sub_task_1"):  # Nested
        ...
    with st.tool_call("sub_task_2"):  # Nested
        ...
```

**Recommendation:** Support nesting. It's natural for complex agents.

---

## Appendix: Competitive Analysis

### Chainlit

- Has `cl.Step` for tool calls (similar to proposed `st.tool_call`)
- Has `cl.Message.Elements` for attachments
- More opinionated, less flexible

### Gradio

- Uses `gr.ChatInterface` with automatic tool handling
- Less control over individual elements
- Tied to Gradio component ecosystem

### LangServe

- Pure API, no UI components
- Developers must build custom frontends

**Streamlit Advantage:** Composable building blocks that integrate with the full Streamlit ecosystem (charts, dataframes, columns, etc.)

---

## Summary

The recommended approach for Streamlit's AI agent support:

1. **DO build** focused, composable components: `st.tool_call`, `st.thinking`, `st.artifact`, `st.sources`
2. **DON'T build** monolithic agent orchestration
3. **DO follow** existing Streamlit patterns (`st.status`, `st.expander`, `st.chat_message`)
4. **DON'T try** to replace agent frameworks (LangChain, etc.)

This approach:

- Stays true to Streamlit's philosophy (simple, composable, Pythonic)
- Addresses real developer pain points
- Works with ANY agent framework
- Provides differentiation vs. Gradio/Chainlit
