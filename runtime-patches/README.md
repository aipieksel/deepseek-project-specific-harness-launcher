# Local DeepSeek Harness runtime patches

These edits live in the installed runtime:

```text
~/.local/share/deepseek-harness/runtime/node_modules
```

They are not upstream. `npm install` in that runtime directory will overwrite them.

## Disable browser token auth

`@deepseek-ai/dsh-client-connection/lib/index.js` honors:

```text
DSH_DISABLE_BROWSER_TOKEN=1
```

When set, index and `/api` skip the launch-token cookie exchange. The launcher
`Disable token auth` toggle and `dsh-project --no-token` set this variable.

A process that is already running keeps its original auth until you relaunch it
from the launcher.

## Agents Pro plugin

The local Harness customizations live in one plugin:

```text
<launcher checkout>/plugins/dsh-agents-pro
```

`dsh-project` loads it with `--patch` on that plugin's `cordis.patch.yml` and
links the package into the web profile `node_modules` so the loader can resolve
`dsh-agents-pro`.

The installed entrypoint resolves the checkout from its own symlink and loads
`dsh-agents-pro` from that checkout. The plugin registers Codex and Grok CLI
adapters with Harness; the signed-in CLIs handle authentication. Its current
Files, voice, tasks and native UI behavior is documented in the plugin README.
The separate `dsh-files-explorer` source is retained for its original Files
tree extension; this entrypoint currently loads Agents Pro's integrated Files
behavior rather than registering both patches together.
