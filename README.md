<div align="center">

# claude-peers

**Lets your Claude Code instances find each other and exchange messages instantly.**

[![CI](https://github.com/sudohakan/claude-peers-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/sudohakan/claude-peers-mcp/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/sudohakan/claude-peers-mcp?style=flat-square)](https://github.com/sudohakan/claude-peers-mcp/releases)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Bun](https://img.shields.io/badge/runtime-Bun-f9f1e1?style=flat-square&logo=bun)](https://bun.sh)

</div>

Fork of [louislva/claude-peers-mcp](https://github.com/louislva/claude-peers-mcp). It adds pinned peer ids, a file inbox for sessions without development channels, and broker hardening. See the [changelog](CHANGELOG.md).

## Features

- **Peer discovery**: any session lists the others, scoped to `machine`, `directory` or `repo`, with working directory, git repo and a summary of what each is doing.
- **Instant messages**: delivered into the receiving session through the [claude/channel](https://code.claude.com/docs/en/channels-reference) protocol.
- **Local broker**: one daemon on `localhost:7899` with SQLite, auto-launched by the first session, cleans up dead peers.
- **Pinned peer ids** (fork): `POST /register` accepts an optional `id` matching `[A-Za-z0-9._:-]{1,64}`, so a long-lived client keeps its address across restarts.
- **File inbox** (fork): every delivered message is also appended as one JSON line to `$CLAUDE_PEERS_INBOX_DIR/<peer-id>.jsonl` (directory `0700`, files `0600`, files over 256 KB drop their oldest half), so a `UserPromptSubmit` hook can deliver messages to sessions started without the channel flag.
- **Session names from a tty map** (fork): `CLAUDE_PEERS_TTY_NAMES` points to a JSON object like `{"/dev/pts/3": {"name": "Alice", "ts": "<ISO time>"}}`; entries older than 12 hours are ignored.
- **Broker hardening** (fork): answers only `Host: 127.0.0.1:<port>` or `localhost:<port>`, rejects any request carrying `Origin`, requires `application/json` on POST, so a web page cannot reach it through DNS rebinding or a form post.

## Installation

Requirements: [Bun](https://bun.sh), Claude Code v2.1.80+, a claude.ai login (channels do not work with API key auth).

```bash
git clone https://github.com/sudohakan/claude-peers-mcp.git ~/claude-peers-mcp
cd ~/claude-peers-mcp
bun install
claude mcp add --scope user --transport stdio claude-peers -- bun ~/claude-peers-mcp/server.ts
```

Replace `~/claude-peers-mcp` with wherever you cloned it. Start each session with the channel enabled:

```bash
claude --dangerously-skip-permissions --dangerously-load-development-channels server:claude-peers
```

The broker daemon starts automatically the first time. An alias saves typing:

```bash
alias claudepeers='claude --dangerously-load-development-channels server:claude-peers'
```

### Configuration

| Environment variable | Default | Description |
|---|---|---|
| `CLAUDE_PEERS_PORT` | `7899` | Broker port |
| `CLAUDE_PEERS_DB` | `~/.claude-peers.db` | SQLite database path |
| `OPENAI_API_KEY` | none | Enables auto-summary via `gpt-5.4-nano` |
| `CLAUDE_PEERS_INBOX_DIR` | `/tmp/claude-peers-inbox` | File inbox directory |
| `CLAUDE_PEERS_NO_INBOX` | unset | Set to `1` to disable the file inbox |
| `CLAUDE_PEERS_TTY_NAMES` | `~/.claude/cache/peer-tty-names.json` | tty to name map |

Without `OPENAI_API_KEY`, Claude sets its own summary through the `set_summary` tool.

## Usage

Open a second session the same way, then ask either one: "List all peers on this machine", and then: "Send a message to peer [id]: what are you working on?". The other Claude receives it immediately and responds.

| Tool | What it does |
|---|---|
| `list_peers` | Find other Claude Code instances, scoped to `machine`, `directory` or `repo` |
| `send_message` | Send a message to another instance by ID (arrives instantly via channel push) |
| `set_summary` | Describe what you are working on (visible to other peers) |
| `check_messages` | Manually check for messages (fallback outside channel mode) |

### CLI

```bash
bun cli.ts status            # broker status + all peers
bun cli.ts peers             # list peers
bun cli.ts send <id> <msg>   # send a message into a Claude session
bun cli.ts kill-broker       # stop the broker listener
```

## Project structure

```
broker.ts       broker daemon: HTTP on localhost, SQLite peer registry, message queue
server.ts       MCP server (stdio) spawned per session: registers, polls, pushes channel messages
cli.ts          command-line client for the broker
index.ts        entry point
shared/         types and helpers used by broker, server and CLI
broker.test.ts  broker tests
```

```
  broker daemon (localhost:7899 + SQLite)
        |                    |
   MCP server A         MCP server B      (one per session, stdio)
        |                    |
    Claude A             Claude B
```

Each MCP server registers with the broker and polls for messages every second. Everything is localhost-only.

## License

MIT, see [LICENSE](LICENSE). Original work by Louis Arge; fork changes by Hakan Topcu.
