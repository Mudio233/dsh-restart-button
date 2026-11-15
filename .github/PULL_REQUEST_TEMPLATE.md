## What changed

<!-- One or two sentences. -->

## Why

<!-- The behaviour this fixes or adds; link an issue when there is one. -->

## Checks

- [ ] `node --check index.js` and `node --check client.js` pass
- [ ] `launcher.windows.ps1` still fits the payload budget (`cmd` allows 8191 characters; UTF-16 base64 costs 2.67 per character)
- [ ] The panel still stays inside the sidebar and the viewport
- [ ] README `## Limits` still matches what the code does

## Limits worth stating

<!-- A restart ends running turns and tool calls; the page keeps the old address. -->
