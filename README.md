# Restart Harness

A DeepSeek Harness (DSH) plugin: a **Restart DSH** control in the sidebar footer. It shows the running version, asks for confirmation, restarts the host through a launcher that outlives the process it kills, and reloads the page when the new host answers.

![icon](icon.svg)

DeepSeek Harness 插件：在侧边栏底部加一个「重启 DSH」按钮。显示当前版本，二次确认后重启宿主，新进程应答后页面自动重新加载。

---

## Why

Restarting DSH normally means finding the window tray icon, quitting, and starting the app again — or hunting for the process. This plugin puts that action where you already are, next to Settings, and makes the page come back by itself.

It also does the part that a naive implementation gets wrong: a process cannot reliably kill and restart itself. The restart is handed to a detached launcher that waits, ends the application, and starts it again, with a second attempt if the first one did not survive.

## Features

- **Sidebar footer action** — registered in `sidebar.footer.action`, so it sits beside Settings in both the wide column and the collapsed rail. No DOM surgery, no replacement of shipped UI.
- **Live version** — read from the installed application manifest, shown on the row (and in the rail's tooltip).
- **Confirmation first** — a small panel explains what will happen, shows the version and process id, and offers **Restart** / **Cancel**. Escape or an outside click dismisses it.
- **Survives the restart** — the launcher is started outside the host process, waits 2.5 s (configurable), ends the processes whose executable path equals the running executable, waits again, and starts it. It starts a second time if nothing is alive eight seconds later.
- **Reconnect** — the page polls the identity route and reloads itself once a host with a **different process id** answers; after two minutes it says so and offers a manual reload.

## Install

The bundle is a plain package with no dependencies or build step.

1. Clone this repository somewhere.
2. In DSH, open **Plugins** → **Add plugin** → choose the local directory, or call the Plugin Manager with
   `install_bundle` and the absolute package directory as the target.
3. The row appears immediately; the button shows up in the sidebar footer (a page refresh may be needed to pick up the client half).

Compatibility: developed and verified against DSH `0.2.2-rc.3` on Windows. The Host half uses `webServer` and (when present) `connection`; the Client half uses `slots` and `locale`.

## Usage

1. Click **Restart DSH** in the sidebar footer.
2. Check the version line, then press **Restart**.
3. The page returns on its own.

Options in `cordis.patch.yml`:

```yaml
- insert:
    - id: restart-button
      name: '@local/dsh-restart-button'
      config:
        delayMs: 2500   # ms between launcher start and the kill; 500..30000
```

## How it works

Two Host routes, both behind `connection.requestRejection` when that service exists:

| Route | Purpose |
| --- | --- |
| `GET /dsh-restart/info` | version, pid, platform, start time |
| `POST /dsh-restart/restart` | confirmed restart, body `{"confirm":true}` |

The restart is not performed inline. The Host builds a launcher and starts it without waiting:

- **Windows** — PowerShell behind one `cmd` hop, with the script as base64 of UTF-16 (`-EncodedCommand`). A `.cmd` file is read through a console codepage, which mangles an install path containing non-ASCII characters; an argument does not go through that path. The hop also survives the termination that follows, where a directly spawned PowerShell child did not in testing.
- **POSIX** — a `/bin/sh` script started detached.

The launcher waits, then `Get-Process | Where-Object { $_.Path -eq '<exe>' } | Stop-Process -Force`, waits, `Start-Process` the same executable, and retries once after eight seconds.

Nothing here kills by image name, so a second install of a different executable is left alone.

## Limits

- Running turns, tool calls, terminals, and background jobs end with the host. Session logs are persisted and can be reopened afterwards.
- The port is not forced. If the restarted host binds a different port, the old page cannot follow: return to the desktop window or reopen the Web GUI address.
- Windows needs `powershell.exe` on `PATH`.
- Not implemented: scheduled restarts, restarting into a different profile or configuration.

## Development

- No build step. `client.js` is loaded by the browser module table as-is; `index.js` is the Host half.
- After editing `client.js`, refresh the page. After editing `index.js`, restart DSH: the Host imports a fresh JavaScript module generation only on start (`ESM` module cache).
- The launcher can be tested without touching DSH: build it with a stand-in executable path, replace `Stop-Process`/`Start-Process` with marker writes, and confirm the launcher survives a hard kill of its parent.

## License

MIT — see [LICENSE](LICENSE).
