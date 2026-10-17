# DeepSeek project-specific Harness launcher

Local macOS Dock app for editing and launching project-specific DeepSeek
Harness browser instances. This repository contains the native Swift launcher,
the `dsh-project` entrypoint, and two Harness plugin source trees.

## Plugin capabilities

- **Agents Pro** is the plugin loaded by `dsh-project`. It adds signed-in Codex
  CLI and Grok CLI model routes, microphone dictation, cleanup and saved
  recording recovery, Files previews and comments, blocking questions, Tasks,
  custom instructions, skill controls, and Markdown export. Its CLI adapter
  and voice pipeline live in the separate
  [Codex/Grok CLI](https://github.com/aipieksel/deepseek-codex-grok-cli-integration)
  and [microphone/cleanup](https://github.com/aipieksel/deepseek-microphone-cleanup-integration)
  repositories. See [the Agents Pro guide](plugins/dsh-agents-pro/README.md).
- **Files Explorer** is retained as a separate local plugin source. Its Files
  tree extension keeps the tree visible beside an opened file and provides
  Open, Open in New Tab, copy path/name, Reveal in Finder, and default-app
  actions. See [the Files Explorer guide](plugins/dsh-files-explorer/README.md).
  The launcher currently loads Agents Pro's integrated Files behavior; it does
  not register both plugin patches at once.

The browser UI must use Harness's native components. The plugin source does
not include the Harness runtime or the signed-in CLIs.

This checkout expects DeepSeek Harness installed at
`~/.local/share/deepseek-harness/runtime` (or `DSH_RUNTIME`). The optional
**Disable token auth** switch additionally depends on the local runtime patch
described in [runtime patches](runtime-patches/README.md); this repository does
not install or distribute that modified Harness runtime. Leave token auth on
when using an unpatched runtime.

It reads and writes:

```text
~/.local/share/deepseek-harness/projects/projects.tsv
```

Clone this repository and the two sibling integration repositories above into
one directory, then install the plugin dependencies:

```bash
./script/install-integrations.sh
```

Build and launch on macOS with Swift and an installed DeepSeek Harness runtime:

```bash
./script/build_and_run.sh
```

The staged app bundle is:

```text
dist/DeepSeek Harness Launcher.app
```

Launch behavior:

- `Launch` saves the registry first, then starts `~/.local/bin/dsh-project <name> --open`.
- `script/install-launcher.sh` installs that entrypoint as a symlink to this checkout's
  maintained `script/dsh-project`, preserving any previous copy under
  `~/.local/share/deepseek-harness/launcher-backups`. The app build runs this installer.
  Run it directly to repair an older installation without rebuilding/restarting the app.
  Existing project shortcuts follow the same entrypoint. Restart an already-running
  project through Stop → Launch to load changed plugins; a browser reload alone
  cannot change the server's startup patch.
- `dsh-project` seeds the project folder as the default Harness workspace before
  the browser UI starts.
- `dsh-project` resolves this checkout from the installed entrypoint symlink,
  then loads the local `dsh-agents-pro` plugin. It checks that the two sibling
  integrations are installed before starting Harness.
- Each project keeps its own Harness state under
  `~/.local/share/deepseek-harness/projects/<name>/state`.
- Output tokens are redacted in the app display.
- `Disable token auth` writes a `no-token` column in the registry, launches with
  `--no-token`, and sets `DSH_DISABLE_BROWSER_TOKEN=1` so
  `http://127.0.0.1:<port>/` works without a launch token. Relaunch the project
  after changing that option; a process already running keeps its original auth.
- Launch PATH includes Homebrew and `/usr/local/bin` so GUI launches can find
  `node` even though Dock apps get a stripped default PATH.

Run `npm test` in `plugins/dsh-agents-pro`, and `swift build` from this
directory for source checks. `build_and_run.sh` installs the entrypoint and
opens the app, so use `swift build` when you only need a build check.

The plugin and its portable checklist integration kit ship together. Relaunch
the project and reload the browser after updating the plugin. Existing API-backed
DeepSeek models keep their native Harness configuration and credentials.

The local runtime state, recordings and project registry remain in the user's
home directory. The source repository excludes those files and local build and
task artifacts. Original code in this repository is licensed under the
[MIT License](LICENSE). DeepSeek Harness, the CLI products, and other
third-party components retain their owners' separate rights; their runtimes
and credentials are not included here.
