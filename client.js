window.__ModuleLoader__.load({
  id: 'dsh-restart-button',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'dshRestartButton'
    const INFO_PATH = '/dsh-restart/info'
    const RESTART_PATH = '/dsh-restart/restart'
    /** How often the page asks whether a new host answered. */
    const POLL_MS = 2000
    /** How long the page waits before it admits the reconnect failed. */
    const POLL_LIMIT_MS = 20000
    /** A hung POST must not leave the panel spinning forever. */
    const REQUEST_TIMEOUT_MS = 8000

    const CSS = `
.drsb-layer { position: relative; flex: none; display: flex; align-items: center; width: auto; height: 40px; margin: 0 0 0 auto; }
.drsb-button { display: inline-flex; align-items: center; gap: 8px; width: auto; height: 34px; margin: 0; padding: 0 12px 0 9px; border: none; border-radius: 12px; background: transparent; color: var(--dsw-alias-label-primary); font-family: inherit; font-size: 14px; line-height: 20px; cursor: pointer; overflow: hidden; text-align: left; }
@media (hover: hover) { .drsb-button:hover { background: var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2)); } }
.drsb-button:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.drsb-button[data-open] { background: var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2)); }
.drsb-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.drsb-version { flex: none; margin-left: 2px; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 16px; font-variant-numeric: tabular-nums; }
.drsb-icon { flex: none; display: block; }
.drsb-layer.drsb-rail { width: 36px; height: 36px; margin: 0; }
.drsb-rail .drsb-button { justify-content: center; gap: 0; width: 36px; height: 36px; margin: 0; padding: 0; border-radius: 50%; }
.drsb-panel { position: fixed; z-index: 40; box-sizing: border-box; width: 288px; max-width: calc(100vw - 16px); padding: 14px; border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 12px; background: var(--dsw-alias-bg-overlay); color: var(--dsw-alias-label-primary); box-shadow: 0 12px 32px rgba(0, 0, 0, .24); font-family: inherit; }
.drsb-title { margin: 0 0 6px; font-size: 13px; font-weight: 600; line-height: 20px; }
.drsb-body { margin: 0 0 10px; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 1.6; }
.drsb-facts { display: flex; align-items: baseline; gap: 6px; margin: 0 0 12px; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 16px; font-variant-numeric: tabular-nums; }
.drsb-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.drsb-primary, .drsb-secondary { appearance: none; border: 1px solid transparent; border-radius: 8px; padding: 5px 12px; font: inherit; font-size: 12px; line-height: 18px; cursor: pointer; }
.drsb-primary { background: var(--dsw-alias-state-error-primary, var(--dsw-alias-brand-primary)); color: var(--dsw-alias-bg-base); font-weight: 600; }
.drsb-secondary { background: transparent; border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); }
.drsb-secondary:hover { background: var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2)); }
.drsb-status { display: flex; align-items: center; gap: 8px; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 1.6; }
.drsb-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--dsw-alias-state-warn-primary); animation: drsb-pulse 1.2s ease-in-out infinite; }
@keyframes drsb-pulse { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
.drsb-error { color: var(--dsw-alias-state-error-primary); font-size: 12px; line-height: 1.6; }
.drsb-log { margin: 8px 0 0; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 1.5; word-break: break-all; }
`

    /** Chinese dictionaries; the English half mirrors every key. */
    const ZH = {
      label: '重启 DSH',
      aria: '重启 DeepSeek Harness',
      title: '重启 DeepSeek Harness？',
      body: '宿主进程会立即结束，正在运行的任务和工具调用会中断。会话日志已经持久化，重启后可以从列表重新打开。',
      confirm: '重启',
      cancel: '取消',
      running: '正在重启宿主…',
      runningHint: '窗口会在几秒内重新打开，会话不会丢。',
      timeout: '没能自动重连。桌面版重启会换端口，旧页面不会再连上；新窗口没出现，就看下面的日志。',
      reload: '重新加载页面',
      error: '重启请求失败：{message}',
      logHint: '诊断日志：{path}',
      versionFact: '当前版本 v{version}',
      versionUnknown: '版本未知',
      pidFact: '进程 {pid}',
    }
    const EN = {
      label: 'Restart DSH',
      aria: 'Restart DeepSeek Harness',
      title: 'Restart DeepSeek Harness?',
      body: 'The host process ends immediately, so running turns and tool calls are interrupted. Session logs are already persisted and can be reopened from the list afterwards.',
      confirm: 'Restart',
      cancel: 'Cancel',
      running: 'Restarting the host…',
      runningHint: 'The window reopens within a few seconds; sessions are kept.',
      timeout: 'Automatic reconnect failed: a desktop restart picks a new port, so this page never comes back. If no new window appeared, the log below says why.',
      reload: 'Reload the page',
      error: 'The restart request failed: {message}',
      logHint: 'Diagnostic log: {path}',
      versionFact: 'Version v{version}',
      versionUnknown: 'Version unknown',
      pidFact: 'Process {pid}',
    }

    /** Interpolate `{name}` placeholders the way the Client locale service does. */
    function fill(text, params) {
      if (params === undefined) return text
      return text.replace(/\{(\w+)\}/g, (whole, key) => (key in params ? String(params[key]) : whole))
    }

    /** Translate through the slot props, falling back to the Chinese source text. */
    function translator(props) {
      const bound = typeof props.t === 'function' ? props.t : undefined
      return (key, params) => {
        const text = bound !== undefined ? bound(key, params) : fill(ZH[key] ?? key, params)
        return typeof text === 'string' ? text : key
      }
    }

    /** Browser-relative form of a Host route path. */
    function route(path) {
      const relative = path.replace(/^\/+/, '')
      if (typeof document === 'undefined') return `/${relative}`
      return new URL(relative, document.baseURI).pathname
    }

    /** Restart glyph: a circular arrow, drawn for this control. */
    function RestartIcon(props) {
      return h('svg', {
        className: 'drsb-icon',
        width: props.size,
        height: props.size,
        viewBox: '0 0 20 20',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
      },
        h('path', { d: 'M16.2 8.4a6.4 6.4 0 1 0 .1 3.3' }),
        h('path', { d: 'M16.4 4.2v4.4H12' }),
      )
    }

    /** The sidebar-foot control: version read on mount, confirm, then reload. */
    function RestartButton(props) {
      const t = translator(props)
      const wide = props.wide !== false
      const [info, setInfo] = React.useState(undefined)
      const [phase, setPhase] = React.useState('idle')
      const [failure, setFailure] = React.useState('')
      const [anchor, setAnchor] = React.useState(undefined)
      const rootRef = React.useRef(null)
      const seenPid = React.useRef(undefined)

      // One identity read per mount; a failure leaves the version out.
      React.useEffect(() => {
        let cancelled = false
        fetch(route(INFO_PATH), { cache: 'no-store', headers: { accept: 'application/json' } })
          .then((response) => (response.ok ? response.json() : undefined))
          .then((body) => {
            if (cancelled || body === null || typeof body !== 'object') return
            seenPid.current = body.pid
            setInfo(body)
          })
          .catch(() => {})
        return () => { cancelled = true }
      }, [])

      // Place the panel above the button, clamped into the viewport. The slot
      // wraps every entry in a `display: contents` element, so a parent box is
      // not measurable; measure this layer, whose box is the button itself.
      const open = phase !== 'idle'
      React.useLayoutEffect(() => {
        if (!open) return undefined
        const place = () => {
          const root = rootRef.current
          if (root === null) return
          const rect = root.getBoundingClientRect()
          const viewportWidth = window.innerWidth
          const width = Math.max(220, Math.min(268, viewportWidth - 24))
          const left = Math.max(8, Math.min(rect.right - width, viewportWidth - width - 8))
          setAnchor({ left, width, bottom: window.innerHeight - rect.top + 8 })
        }
        place()
        window.addEventListener('resize', place)
        return () => { window.removeEventListener('resize', place) }
      }, [open])

      // Dismiss on an outside pointer or Escape, never while the restart runs.
      React.useEffect(() => {
        // Closing the panel never cancels an accepted restart; it only hides it.
        if (!open) return undefined
        const onPointer = (event) => {
          const root = rootRef.current
          if (root !== null && event.target instanceof Node && root.contains(event.target)) return
          setPhase('idle')
        }
        const onKey = (event) => { if (event.key === 'Escape') setPhase('idle') }
        document.addEventListener('pointerdown', onPointer, true)
        document.addEventListener('keydown', onKey)
        return () => {
          document.removeEventListener('pointerdown', onPointer, true)
          document.removeEventListener('keydown', onKey)
        }
      }, [open])

      // Poll until a host with a different pid answers, then reload.
      React.useEffect(() => {
        if (phase !== 'restarting') return undefined
        let stopped = false
        let timer = 0
        const startedAt = Date.now()
        const baseline = seenPid.current
        const tick = async () => {
          if (stopped) return
          try {
            const response = await fetch(route(INFO_PATH), { cache: 'no-store' })
            if (response.ok) {
              const body = await response.json()
              if (body !== null && typeof body === 'object' && typeof body.pid === 'number'
                && (typeof baseline !== 'number' || body.pid !== baseline)) {
                stopped = true
                window.location.reload()
                return
              }
            }
          } catch {
            // The old host is down; that is the expected state mid-restart.
          }
          if (Date.now() - startedAt > POLL_LIMIT_MS) {
            stopped = true
            setPhase('timeout')
            return
          }
          timer = window.setTimeout(tick, POLL_MS)
        }
        timer = window.setTimeout(tick, 1200)
        return () => {
          stopped = true
          window.clearTimeout(timer)
        }
      }, [phase])

      const request = async () => {
        setFailure('')
        setPhase('restarting')
        const controller = new AbortController()
        const deadline = window.setTimeout(() => { controller.abort() }, REQUEST_TIMEOUT_MS)
        try {
          const response = await fetch(route(RESTART_PATH), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ confirm: true }),
            signal: controller.signal,
          })
          const body = await response.json().catch(() => undefined)
          if (!response.ok || body === undefined || body.ok !== true) {
            throw new Error(body !== undefined && typeof body.message === 'string'
              ? body.message
              : `HTTP ${String(response.status)}`)
          }
          if (typeof body.pid === 'number') seenPid.current = body.pid
        } catch (error) {
          setFailure(error instanceof Error && error.name === 'AbortError'
            ? 'no response within 8s'
            : error instanceof Error ? error.message : String(error))
          setPhase('error')
        } finally {
          window.clearTimeout(deadline)
        }
      }

      const versionText = info !== undefined && typeof info.version === 'string' && info.version !== ''
        ? `v${info.version}`
        : undefined

      const panel = () => {
        if (phase === 'restarting') {
          return [
            h('h2', { key: 'title', className: 'drsb-title' }, t('title')),
            h('p', { key: 'running', className: 'drsb-status' },
              h('span', { className: 'drsb-dot', 'aria-hidden': true }),
              t('running')),
            h('p', { key: 'hint', className: 'drsb-body', style: { margin: '8px 0 0' } }, t('runningHint')),
            h('div', { key: 'actions', className: 'drsb-actions', style: { marginTop: '10px' } },
              h('button', {
                type: 'button', className: 'drsb-secondary',
                onClick: () => { setPhase('idle') },
              }, t('cancel'))),
          ]
        }
        if (phase === 'timeout') {
          return [
            h('h2', { key: 'title', className: 'drsb-title' }, t('title')),
            h('p', { key: 'body', className: 'drsb-body' }, t('timeout')),
            info !== undefined && typeof info.log === 'string'
              ? h('p', { key: 'log', className: 'drsb-log' }, t('logHint', { path: info.log }))
              : null,
            h('div', { key: 'actions', className: 'drsb-actions' },
              h('button', {
                type: 'button', className: 'drsb-secondary',
                onClick: () => { window.location.reload() },
              }, t('reload'))),
          ]
        }
        if (phase === 'error') {
          return [
            h('h2', { key: 'title', className: 'drsb-title' }, t('title')),
            h('p', { key: 'error', className: 'drsb-error' }, t('error', { message: failure })),
            info !== undefined && typeof info.log === 'string'
              ? h('p', { key: 'log', className: 'drsb-log' }, t('logHint', { path: info.log }))
              : null,
            h('div', { key: 'actions', className: 'drsb-actions', style: { marginTop: '12px' } },
              h('button', {
                type: 'button', className: 'drsb-secondary',
                onClick: () => { setPhase('confirm') },
              }, t('confirm'))),
          ]
        }
        return [
          h('h2', { key: 'title', className: 'drsb-title' }, t('title')),
          h('p', { key: 'body', className: 'drsb-body' }, t('body')),
          h('p', { key: 'facts', className: 'drsb-facts' },
            versionText !== undefined ? t('versionFact', { version: versionText.slice(1) }) : t('versionUnknown'),
            info !== undefined && typeof info.pid === 'number'
              ? `· ${t('pidFact', { pid: info.pid })}`
              : null),
          h('div', { key: 'actions', className: 'drsb-actions' },
            h('button', {
              type: 'button', className: 'drsb-secondary',
              onClick: () => { setPhase('idle') },
            }, t('cancel')),
            h('button', {
              type: 'button', className: 'drsb-primary',
              onClick: () => { void request() },
            }, t('confirm'))),
        ]
      }

      return h(React.Fragment, null,
        h('style', { key: 'css' }, CSS),
        h('div', {
          key: 'root',
          ref: rootRef,
          className: wide ? 'drsb-layer' : 'drsb-layer drsb-rail',
        },
        open && anchor !== undefined
          ? h('section', {
            key: 'panel',
            className: 'drsb-panel',
            style: { left: anchor.left, width: anchor.width, bottom: anchor.bottom },
            role: 'dialog',
            'aria-label': t('title'),
          }, ...panel().filter(Boolean))
          : null,
        h('button', {
          key: 'button',
          type: 'button',
          className: 'drsb-button',
          'aria-label': t('aria'),
          title: wide ? undefined : `${t('aria')}${versionText !== undefined ? ` · ${versionText}` : ''}`,
          'aria-expanded': open,
          'data-open': open || undefined,
          onClick: () => {
            setPhase((current) => {
              if (current === 'idle') return 'confirm'
              if (current === 'confirm') return 'idle'
              return current
            })
          },
        },
        h(RestartIcon, { size: wide ? 16 : 18 }),
        wide ? h('span', { className: 'drsb-label' }, t('label')) : null,
        wide && versionText !== undefined ? h('span', { className: 'drsb-version' }, versionText) : null),
        ),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(
          () => ctx.locale.register(NS, { en: EN, zh: ZH }),
          'dsh-restart-button: dictionaries',
        )
        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'dsh-restart-button',
          order: 120,
          locale: NS,
        }, RestartButton))
      },
    }
  },
})
