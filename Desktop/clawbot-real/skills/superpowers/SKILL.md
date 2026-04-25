---
name: superpowers
description: Shell and filesystem access for the agent.
---

# SKILL: Superpowers

## Purpose
Enables the agent to interact with the local operating system to run scripts, manage files, and execute terminal commands.

## Capabilities
- Read/Write files in the `/workspace` directory.
- Execute shell commands (safe-listed or reviewed).
- Manage local database exports or logs.

## Security
- All commands are logged.
- Restricted to non-root execution inside the container.
