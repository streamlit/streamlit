## Background Queries with Starlette Integration: New Patterns

The Starlette integration in Streamlit opens up several **new architectural patterns** for running long-running queries in the background while showing progress in the UI. Here's a breakdown:

### 1. FastAPI Mount + Background Tasks Pattern

The most powerful new pattern: mount Streamlit on FastAPI and use FastAPI's background task infrastructure.

```python
# app.py
from contextlib import asynccontextmanager
from fastapi import FastAPI, BackgroundTasks
from streamlit.starlette import App
import asyncio

# Shared task state (in production, use Redis)
task_registry: dict[str, dict] = {}

async def run_snowflake_query(task_id: str, query: str):
    """Background task that runs on FastAPI's event loop"""
    task_registry[task_id]["status"] = "running"
    # Simulate chunked query execution with progress
    for i in range(10):
        await asyncio.sleep(1)  # Replace with actual async query chunks
        task_registry[task_id]["progress"] = (i + 1) * 10
    task_registry[task_id]["status"] = "completed"
    task_registry[task_id]["result"] = {"rows": 1000}

streamlit_app = App("dashboard.py")

@asynccontextmanager
async def lifespan(app):
    # Startup: Initialize connection pools, Celery, etc.
    async with streamlit_app.lifespan()(app):
        yield

fastapi_app = FastAPI(lifespan=lifespan)

@fastapi_app.post("/api/query")
async def start_query(query: str, background_tasks: BackgroundTasks):
    import uuid
    task_id = str(uuid.uuid4())
    task_registry[task_id] = {"status": "pending", "progress": 0}
    background_tasks.add_task(run_snowflake_query, task_id, query)
    return {"task_id": task_id}

@fastapi_app.get("/api/query/{task_id}")
async def get_status(task_id: str):
    return task_registry.get(task_id, {"status": "not_found"})

fastapi_app.mount("/", streamlit_app)
```

**Streamlit dashboard.py:**
```python
import streamlit as st
import requests

@st.fragment(run_every=1.0)  # Poll every second
def query_status_fragment():
    if "task_id" not in st.session_state:
        return
    
    resp = requests.get(f"http://localhost:8000/api/query/{st.session_state.task_id}")
    data = resp.json()
    
    st.progress(data.get("progress", 0) / 100)
    st.write(f"Status: {data['status']}")
    
    if data["status"] == "completed":
        st.success(f"Query completed! Result: {data['result']}")
        del st.session_state.task_id  # Stop polling

if st.button("Run Snowflake Query"):
    resp = requests.post("http://localhost:8000/api/query", 
                         json={"query": "SELECT * FROM large_table"})
    st.session_state.task_id = resp.json()["task_id"]

query_status_fragment()
```

### 2. Lifespan + Celery/Redis Pattern

Use Starlette's lifespan hooks to initialize a proper task queue:

```python
# app.py
from contextlib import asynccontextmanager
from celery import Celery
from streamlit.starlette import App

celery_app = Celery('tasks', broker='redis://localhost:6379/0')

@celery_app.task(bind=True)
def run_snowflake_query(self, query: str):
    """Celery task with progress updates"""
    for i in range(10):
        time.sleep(1)  # Actual query work
        self.update_state(state='PROGRESS', meta={'progress': (i+1)*10})
    return {'result': 'data'}

@asynccontextmanager
async def lifespan(app):
    # Initialize Celery connection on startup
    celery_app.conf.update(result_backend='redis://localhost:6379/0')
    yield {"celery": celery_app}

streamlit_app = App("dashboard.py", lifespan=lifespan)
```

**dashboard.py:**
```python
import streamlit as st
from celery.result import AsyncResult
from app import celery_app, run_snowflake_query

@st.fragment(run_every=1.0)
def task_monitor():
    if "celery_task_id" not in st.session_state:
        return
    
    result = AsyncResult(st.session_state.celery_task_id, app=celery_app)
    
    if result.state == 'PROGRESS':
        st.progress(result.info['progress'] / 100)
    elif result.state == 'SUCCESS':
        st.success(f"Done! {result.result}")
        del st.session_state.celery_task_id
    elif result.state == 'FAILURE':
        st.error(f"Failed: {result.traceback}")

if st.button("Start Query"):
    task = run_snowflake_query.delay("SELECT * FROM table")
    st.session_state.celery_task_id = task.id

task_monitor()
```

### 3. Pure Async Pattern (No External Queue)

For simpler use cases, use asyncio directly with shared state:

```python
# app.py
from contextlib import asynccontextmanager
from streamlit.starlette import App
import asyncio

class TaskManager:
    def __init__(self):
        self.tasks: dict[str, asyncio.Task] = {}
        self.results: dict[str, dict] = {}
    
    async def run_query(self, task_id: str, query: str):
        self.results[task_id] = {"status": "running", "progress": 0}
        # Simulate async Snowflake query (use snowflake-connector-python async)
        for i in range(10):
            await asyncio.sleep(0.5)
            self.results[task_id]["progress"] = (i + 1) * 10
        self.results[task_id] = {"status": "done", "data": [...]}
    
    def start_task(self, task_id: str, query: str):
        loop = asyncio.get_event_loop()
        self.tasks[task_id] = loop.create_task(self.run_query(task_id, query))

task_manager = TaskManager()

@asynccontextmanager  
async def lifespan(app):
    yield {"task_manager": task_manager}
    # Cleanup: cancel pending tasks
    for task in task_manager.tasks.values():
        task.cancel()

app = App("dashboard.py", lifespan=lifespan)
```

### 4. Server-Sent Events (SSE) for Real-Time Progress

Add a custom SSE route for streaming progress updates:

```python
from starlette.routing import Route
from starlette.responses import StreamingResponse
from streamlit.starlette import App
import asyncio

async def query_progress_stream(request):
    task_id = request.path_params["task_id"]
    
    async def event_generator():
        while True:
            progress = get_task_progress(task_id)  # Your progress lookup
            yield f"data: {json.dumps(progress)}\n\n"
            if progress.get("status") == "completed":
                break
            await asyncio.sleep(0.5)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )

routes = [
    Route("/api/stream/{task_id}", query_progress_stream)
]

app = App("dashboard.py", routes=routes)
```

Then use a custom Streamlit component to subscribe to the SSE stream.

---

## Key Enablers from Starlette Integration

| Feature | Before Starlette | After Starlette |
|---------|-----------------|-----------------|
| **Custom API endpoints** | Not possible | Add `/api/*` routes for task management |
| **Lifespan hooks** | Limited | Initialize Celery, Redis, connection pools on startup |
| **Mount on FastAPI** | Hack required | First-class support via `app.lifespan()` |
| **Async routes** | Tornado callbacks | Native async/await in route handlers |
| **Middleware** | Limited | Add auth, rate limiting, request logging |
| **ASGI ecosystem** | Isolated | Use any ASGI middleware (starlette-auth, slowapi, etc.) |

## Recommended Architecture for Snowflake Queries

For production Snowflake query execution with progress:

```
┌─────────────────────────────────────────────────────────┐
│                    FastAPI + Streamlit                   │
├─────────────────────────────────────────────────────────┤
│  Streamlit UI (/)           │  REST API (/api/*)        │
│  - Query builder UI         │  - POST /api/query        │
│  - @st.fragment(run_every)  │  - GET /api/query/{id}    │
│  - Progress display         │  - Celery task dispatch   │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│              Celery Workers + Redis                      │
│  - Execute Snowflake queries                            │
│  - Report progress via task.update_state()              │
│  - Store results in Redis (TTL expiry)                  │
└─────────────────────────────────────────────────────────┘
```

**Benefits:**
1. **Non-blocking UI**: Query runs in worker, not in Streamlit script
2. **Scalable**: Add more Celery workers for parallel queries
3. **Resumable**: Query state persists across page refreshes
4. **Progress visibility**: Celery's built-in progress tracking + st.fragment polling

---

## What's NOT Yet Possible

The Starlette integration doesn't directly add:
- **WebSocket push from background tasks to UI** (still need to poll or use SSE)
- **Native async in Streamlit script code** (scripts still run synchronously)
- **Built-in task queue** (you need to bring your own Celery/Redis/etc.)

The fragment's `run_every` is the bridge - it lets you poll external task state and update the UI incrementally.
