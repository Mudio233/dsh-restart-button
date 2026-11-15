# Restart Harness

A sidebar-foot control that restarts DeepSeek Harness from the running page, without opening a terminal.

## What it does

- **Sidebar foot action.** The control sits beside Settings in the sidebar footer (`sidebar.footer.action`), in both the wide column and the collapsed rail. The wide row shows the instruction label and the running version; the rail shows the same glyph with the version in its native tooltip.
- **Version.** The Host answers `GET /dsh-restart/info` with the running version, its process id, the platform, and the base origin. The version is read from the installed application manifest, so it reports what is actually running.
- **Confirmation first.** A click opens a small panel above the control: what will happen, the version and process id, and a **Restart** / **Cancel** pair. Escape or a click outside dismisses it. The restart request is a separate, explicit press.
- **Restart through a detached launcher.** `POST /dsh-restart/restart` starts a launcher that outlives the host: on Windows it runs PowerShell through one `cmd` hop with the script as base64 of UTF-16, which keeps a non-ASCII install path intact (a `.cmd` file is read through a console codepage that mangles such a path). The launcher waits (`delayMs`, 2500 ms by default), ends every process whose executable path is the running executable, waits again, starts that executable, and starts it once more if the first attempt is not alive eight seconds later. The host never terminates itself inline, so the request answers before the process disappears.
- **Reconnect.** After the accepted restart, the page polls the identity route and reloads itself as soon as a host with a **different process id** answers. If nothing answers within two minutes, the panel says so and offers a manual reload.

## Usage

1. Click the control in the sidebar footer.
2. Read the version line, then press **Restart**. The panel switches to "Restarting the host…".
3. The page comes back by itself. In the desktop application the window is recreated by the relaunched executable instead.

## Limits worth knowing

- **Everything in the host process ends.** Running turns, tool calls, terminals, and background jobs are interrupted. Session logs are persisted before this point, so sessions can be reopened afterwards, but work that was still running is lost.
- **The restart matches one executable path.** The launcher ends the processes whose image path equals the path the host was started from, including Chromium helpers, but nothing else. A second window started from a different executable (another install) is left alone.
- **The port is not forced.** A restarted host binds whatever port its configuration selects. When the port is the same the page reloads itself; when it changed, the old address serves nothing, so the desktop window (or a newly opened Web GUI address) is the way back. The two-minute timeout exists for exactly that case.
- **The launcher needs PowerShell.** Windows uses `powershell.exe` from PATH; a machine that removed it reports a failed request instead of a silent no-op.
- **Node mode must be cleared.** The plugin runs in a Host process that is the same executable in Electron's Node mode, so `ELECTRON_RUN_AS_NODE` is set in its environment. The launcher removes it before starting the shell; without that, the new process is a windowless Node that exits immediately.
- **Diagnostics.** The launcher is `launcher.windows.ps1` in the package, read on every restart, and every step is appended to `%TEMP%\dsh-restart.log`. The panel shows the log path when the page does not reconnect. Keep the script small: it travels inside one `cmd` command line (8191 characters, and UTF-16 base64 costs 2.67 characters per source character).
- **Not implemented:** scheduled restarts, restarting into a different profile or configuration, and any in-page progress beyond the reconnect poll.
