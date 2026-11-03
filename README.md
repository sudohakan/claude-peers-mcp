# claude-peers

[![CI](https://github.com/sudohakan/claude-peers-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/sudohakan/claude-peers-mcp/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/sudohakan/claude-peers-mcp)](https://github.com/sudohakan/claude-peers-mcp/releases)

> Fork of [louislva/claude-peers-mcp](https://github.com/louislva/claude-peers-mcp). It adds pinned peer ids, a file inbox for sessions without development channels, and broker hardening. See [What this fork adds](#what-this-fork-adds) and the [changelog](CHANGELOG.md).

Let your Claude Code instances find each other and talk. When you're running 5 sessions across different projects, any Claude can discover the others and send messages that arrive instantly.

```
  Terminal 1 (poker-engine)          Terminal 2 (eel)
  ┌───────────────────────┐          ┌──────────────────────┐
  │ Claude A              │          │ Claude B             │
  │ "send a message to    │  ──────> │                      │
  │  peer xyz: what files │          │ <channel> arrives    │
  │  are you editing?"    │  <────── │  instantly, Claude B │
  │                       │          │  responds            │
  └───────────────────────┘          └──────────────────────┘
```

## Quick start

### 1. Install

```bash
git clone https://github.com/sudohakan/claude-peers-mcp.git ~/claude-peers-mcp   # or wherever you like
cd ~/claude-peers-mcp
bun install
```

### 2. Register the MCP server

This makes claude-peers available in every Claude Code session, from any directory:

```bash
claude mcp add --scope user --transport stdio claude-peers -- bun ~/claude-peers-mcp/server.ts
```

Replace `~/claude-peers-mcp` with wherever you cloned it.

### 3. Run Claude Code with the channel

```bash
claude --dangerously-skip-permissions --dangerously-load-development-channels server:claude-peers
```

That's it. The broker daemon starts automatically the first time.

> **Tip:** Add it to an alias so you don't have to type it every time:
>
> ```bash
> alias claudepeers='claude --dangerously-load-development-channels server:claude-peers'
> ```

### 4. Open a second session and try it

In another terminal, start Claude Code the same way. Then ask either one:

> List all peers on this machine

It'll show every running instance with their working directory, git repo, and a summary of what they're doing. Then:

> Send a message to peer [id]: "what are you working on?"

The other Claude receives it immediately and responds.

## What Claude can do

| Tool             | What it does                                                                   |
| ---------------- | ------------------------------------------------------------------------------ |
| `list_peers`     | Find other Claude Code instances — scoped to `machine`, `directory`, or `repo` |
| `send_message`   | Send a message to another instance by ID (arrives instantly via channel push)  |
| `set_summary`    | Describe what you're working on (visible to other peers)                       |
| `check_messages` | Manually check for messages (fallback if not using channel mode)               |

## How it works

A **broker daemon** runs on `localhost:7899` with a SQLite database. Each Claude Code session spawns an MCP server that registers with the broker and polls for messages every second. Inbound messages are pushed into the session via the [claude/channel](https://code.claude.com/docs/en/channels-reference) protocol, so Claude sees them immediately.

```
                    ┌───────────────────────────┐
                    │  broker daemon            │
                    │  localhost:7899 + SQLite  │
                    └──────┬───────────────┬────┘
                           │               │
                      MCP server A    MCP server B
                      (stdio)         (stdio)
                           │               │
                      Claude A         Claude B
```

The broker auto-launches when the first session starts. It cleans up dead peers automatically. Everything is localhost-only.

## Auto-summary

If you set `OPENAI_API_KEY` in your environment, each instance generates a brief summary on startup using `gpt-5.4-nano` (costs fractions of a cent). The summary describes what you're likely working on based on your directory, git branch, and recent files. Other instances see this when they call `list_peers`.

Without the API key, Claude sets its own summary via the `set_summary` tool.

## CLI

You can also inspect and interact from the command line:

```bash
cd ~/claude-peers-mcp

bun cli.ts status            # broker status + all peers
bun cli.ts peers             # list peers
bun cli.ts send <id> <msg>   # send a message into a Claude session
bun cli.ts kill-broker       # stop the broker
```

## What this fork adds

**Pinned peer ids.** `POST /register` accepts an optional `id` matching `[A-Za-z0-9._:-]{1,64}`. A dashboard backend or another long-lived client can keep the same address across restarts; re-registering it replaces the old row without touching other peers in the same process.

**File inbox.** Channel push only reaches a session started with `--dangerously-load-development-channels`. Every delivered message is also appended as one JSON line to `$CLAUDE_PEERS_INBOX_DIR/<peer-id>.jsonl`:

```json
{"from_id":"a1b2c3d4","from_summary":"refactoring auth","from_cwd":"/home/me/app","text":"done?","sent_at":"2026-11-03T12:00:00.000Z"}
```

A `UserPromptSubmit` hook can read and truncate that file to deliver messages without the flag. The directory is created `0700`, files `0600`; files over 256 KB drop their oldest half.

**Session names from a tty map.** If `CLAUDE_PEERS_TTY_NAMES` points to a JSON object like `{"/dev/pts/3": {"name": "Alice", "ts": "<ISO time>"}}` (entries older than 12 hours are ignored), the peer gets that name from its first heartbeat.

**Broker hardening.** The broker answers only `Host: 127.0.0.1:<port>` or `localhost:<port>`, rejects any request carrying `Origin`, and requires `application/json` on POST, so a web page cannot reach it through DNS rebinding or a simple form post. A peer owned by another user is no longer mistaken for dead, the MCP server exits when its session goes away, and `kill-broker` stops only the listener.

## Configuration

| Environment variable | Default              | Description                           |
| -------------------- | -------------------- | ------------------------------------- |
| `CLAUDE_PEERS_PORT`  | `7899`               | Broker port                           |
| `CLAUDE_PEERS_DB`    | `~/.claude-peers.db` | SQLite database path                  |
| `OPENAI_API_KEY`     | —                    | Enables auto-summary via gpt-5.4-nano |
| `CLAUDE_PEERS_INBOX_DIR` | `/tmp/claude-peers-inbox` | File inbox directory (fork)      |
| `CLAUDE_PEERS_NO_INBOX`  | unset                | Set to `1` to disable the file inbox (fork) |
| `CLAUDE_PEERS_TTY_NAMES` | `~/.claude/cache/peer-tty-names.json` | tty→name map (fork) |

## Requirements

- [Bun](https://bun.sh)
- Claude Code v2.1.80+
- claude.ai login (channels require it — API key auth won't work)

## License

MIT, see [LICENSE](LICENSE). Original work by Louis Arge; fork changes by Hakan Topçu.
