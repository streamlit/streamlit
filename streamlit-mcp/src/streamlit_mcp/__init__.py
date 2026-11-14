"""MCP adapter for Streamlit's agent JSON endpoint."""

from streamlit_mcp.client import AgentClient, AgentClientError, interact_url

__all__ = ["AgentClient", "AgentClientError", "interact_url"]
