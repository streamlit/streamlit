# CoCo in Snowsight against the agent API: measurements

How Cortex Code (CoCo) in Snowsight handles a Streamlit app's agent endpoint, measured on 2026-10-08 and 2026-10-09 with the prototype wheel from this branch (`fb0b70107e`). The setup is the one that already works today: a SiS container-runtime app, a `CUSTOM MCP SERVER` on the app's service, and a Cortex Agent that uses that server, mentioned from CoCo. No library changes.

## Setup

1. Put the prototype wheel next to `streamlit_app.py` and run `uv lock`. The PR's CI uploads the wheel as the `whl_file` artifact. Deploy with `snowflake.yml`, which passes the account-specific names in as `--env` values. `.streamlit/config.toml` turns on `server.enableAgentApi`.
2. Open the app once. A container-runtime app gets its SPCS service on first open, and `SHOW SERVICES` lists it with `managing_object_name` set to the app.
3. Register the service and attach it to an agent:

   ```sql
   CREATE CUSTOM MCP SERVER <db>.<schema>.<app>_MCP
     SERVICE = <db>.<schema>.<service from step 2>
     ENDPOINT = "streamlit-backend"
     PATH = '/_stcore/agent/v1/mcp';

   CREATE AGENT <db>.<schema>.<agent>
     FROM SPECIFICATION $$
   models:
     orchestration: auto
   tools:
     - tool_spec: {type: code_execution, name: code_execution}
   tool_resources:
     code_execution: {}
   mcp_servers:
     - server_spec: {name: <db>.<schema>.<app>_MCP}
   $$;
   ```

4. In CoCo, mention the agent (`@<agent>`) and ask.

`probe_data.py` builds every value the questions ask about, and `expected_answers.py` prints the answer key. `measure_sizes.py` gives the byte counts of results from a local run.

## The probe app

Four pages, so each result holds one thing being measured:

- **Payload** has a `payload_kb` number input that adds about that many KB of numbered lines. Each line carries an 8-character hash token, and the text ends in a `SENTINEL` line. Asking for the tokens at 0%, 25%, 50%, 75% and 100% of the text shows exactly which part of a result a model saw. The words repeat in a pattern, but the tokens can't be guessed.
- **Table** has a 50,000-row `st.dataframe`. Its inline preview is 100 rows, and the rest is at `data.url`.
- **Charts** has the same 3,000-point series as `st.line_chart` (preview plus `data.url`) and as `st.plotly_chart` (whole spec inline).
- **Media** has `st.image`, `st.pdf` and an `st.download_button` for a PDF.

A result's text is about 1.1 KB plus 1.035 KB per payload KB. The HTTP body is twice that, because `tools/call` returns the snapshot both as `content[0].text` and as `structuredContent`.

## (a) Largest tool result

There are two layers, and they behave differently.

**The Cortex Agent** (orchestration `auto`, which ran Claude with a 1M-token context) reads MCP results whole or not at all:

| payload_kb | result characters | what the model saw |
|---|---|---|
| 16 to 1024 | 17.7K to 1.06M | everything; all five tokens and the sentinel were correct |
| 2048 | 2.12M | one run passed; a second run failed with `399525 … prompt is too long: 1016498 tokens > 1000000 maximum` and returned nothing |
| 2560 to 4096 | 2.65M to 4.24M | only "This tool result was truncated due to token limitations. If you need to refer to this tool result, please reexecute the tool call." |

No result was cut partway. The limit is in tokens, not characters: a real app page of 1.71M characters (mostly chart numbers) got the truncation notice, though one probe run passed at 2.12M. Each run took 45 to 70 s at any size.

**CoCo** calls the agent with `SELECT SNOWFLAKE.CORTEX.DATA_AGENT_RUN(...)` or `cortex agents run …` in its sandbox; it picks one itself, and in Manual mode both need an Allow. The agent's response includes the raw MCP results. CoCo writes a large SQL result to a file under `/output/cortex/cache/tool_outputs/` instead of putting it in context, and greps that file when it needs to:

| payload_kb | result characters | CoCo's answer |
|---|---|---|
| 256 | 266K | correct, from the agent's reply |
| 1024 | 1.06M | correct; CoCo checked the agent's reply against the file |
| 2560 | 2.65M | correct, **from the file**; the agent itself saw only the truncation notice |
| 8192 | 8.5M | correct, from the file; 422 s end to end |

CoCo's context stayed near 90K tokens throughout. In Snowsight the ceiling isn't CoCo, it's the agent: past about 1M tokens the agent can't reason over the result, and CoCo can only grep the raw text.

## (b) `data.url`, images and PDFs

The agent's `code_execution` sandbox has Python 3.12 with pyarrow 20.0.0, pandas 2.3.2, requests, Pillow, pypdf and PyMuPDF, so it could parse Arrow, images and PDFs if it could fetch them. It can't:

- The agent is never told the MCP server's URL, so it can't resolve a relative `data.url` (`../../../media/<id>`).
- Even with the URL, the app's SPCS ingress returns 403 from the sandbox, through its egress proxy. PyPI also returns 403. Only the account's own `snowflakecomputing.com` host answered.

So, in practice:

- **Table:** 0 of 3 questions that needed the full 50,000 rows were answered. The agent refused to estimate from the preview.
- **Charts:** the Plotly peak was answered exactly, because Plotly's whole spec is inline (117 KB for 3,000 points). The same question about `st.line_chart` could not be answered.
- **Media:** no image or PDF was fetched. `st.pdf` is a v2 component whose file URL is `/media/…` and isn't rebased like other media URLs. It is reported with `support: browser_required`.

## (c) Five questions on a large internal metrics app

A copy of a real multi-page internal metrics app ran on the prototype wheel. Each question needs either data that isn't in the inline preview or a page too large to return. SQL on the underlying tables gave the answer key.

| # | question type | Cortex Agent (REST) | CoCo |
|---|---|---|---|
| 1 | count by country + top company, 3,196-row table | correct (both parts, from a complete by-country table and the sorted preview) | correct |
| 2 | count with ≥ 50 apps, same table | no exact answer; bounded it at 458–463 rows from row positions in other tabs (truth: 463 rows) | no exact answer |
| 3 | open issues with one label, 6,156-row table | **correct**, by setting the page's own group-by widget | correct |
| 4 | top issue author, same table | no answer; the page can't group by author, and the rows are past the preview | no answer |
| 5 | three headline numbers on a 2.39M-character page | no answer; the result was replaced by the truncation notice | no answer; CoCo didn't search its saved copy of the raw result, though the numbers were in it |

2 of 5 on both paths, and in the same places. The two correct answers came from something other than the full data: a complete summary table plus the sorted preview, and the page's own aggregation widget. Every miss came from the 100-row preview or the page size. Neither path guessed. CoCo searched its saved copy of a raw result only when the prompt named exact strings to look for.

## Failure modes, roughly by how often they happened

1. **Past the preview, nothing reaches the agent.** `data.url` doesn't work from either the agent or CoCo. The agent only answers if the page exposes the answer some other way: a complete summary table, a whole chart spec, or a widget it can drive.
2. **Real pages are large.** Pages of the internal app returned 6K to 2.39M characters: 172K for the landing page, 318K for a companies page, 821K for one with two 100-row previews of long issue text, 1.71M and 2.39M for pages full of chart data. Of the 19 pages tried, two returned only the truncation notice, one crashed the run, and one timed out.
3. **Results add up within a run.** A run that visited four large pages failed outright (`399525 internal error`) on the fourth, and returned nothing for the three that had worked.
4. **Slow pages time out.** One page returned `run_timed_out` after 60 s, and the agent didn't retry.
5. **Every redeploy breaks the setup.** Redeploying the app replaces its SPCS service and ingress host. The `CUSTOM MCP SERVER` keeps pointing at the old service (`DESC` shows `url: NULL`), and `ALTER CUSTOM MCP SERVER` returns `Unsupported feature`. The fix is `CREATE OR REPLACE` after the app has been opened again.
6. **CoCo doesn't always delegate.** With an app open, a question that only mentioned the agent was answered from the current page instead: "I didn't call the agent you mentioned … I don't have a direct way to call it from here". Adding "Invoke this agent to answer … Do not answer from the page that is open" made it delegate.
7. **One safety refusal.** A prompt that had been pasted twice and asked for "copying exactly … hex token" values got "The AI model refused to process this request due to its content safety policies" before any tool ran.
