# Changelog

This fork tracks [louislva/claude-peers-mcp](https://github.com/louislva/claude-peers-mcp). Entries list what the fork changes on top of upstream.

## [0.2.0] - 2026-11-03

### Added
- Pinned peer ids: `/register` accepts an `id` (`[A-Za-z0-9._:-]{1,64}`) so long-lived clients keep a stable address across restarts.
- File inbox: each delivered message is also appended to `$CLAUDE_PEERS_INBOX_DIR/<peer-id>.jsonl`, so a hook can deliver it when development channels are not loaded. Disable with `CLAUDE_PEERS_NO_INBOX=1`.
- Optional tty→name map (`CLAUDE_PEERS_TTY_NAMES`) gives a peer its name from the first heartbeat.
- Broker tests (`bun test`) and CI (typecheck, tests, version check).

### Fixed
- The broker refuses a foreign `Host`, any browser `Origin` and non-JSON POST bodies, closing DNS-rebinding and browser CSRF paths to `127.0.0.1:7899`.
- The MCP server exits when stdin closes or the parent session dies, instead of lingering with a live heartbeat.
- A peer owned by another user (`EPERM` on signal 0) is no longer treated as dead and unregistered.
- Re-registering a pinned id no longer removes other peers held by the same process.
- `kill-broker` stops only the listening broker, not every client connected to the port.
- The inbox directory is created `0700` and inbox files `0600`.
