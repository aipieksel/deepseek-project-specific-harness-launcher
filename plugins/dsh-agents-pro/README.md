# Agents Pro for DeepSeek Harness

One local web plugin providing Codex CLI, Grok CLI, voice dictation, file previews,
comments, questions, Tasks, custom instructions and Markdown exports. The
package manifest is the version source (currently 0.4.6).

The server's Codex/Grok adapter is supplied by the sibling
[`deepseek-codex-grok-cli-integration`](https://github.com/aipieksel/deepseek-codex-grok-cli-integration)
package. Dictation, MLX Whisper worker and cleanup are supplied by the sibling
[`deepseek-microphone-cleanup-integration`](https://github.com/aipieksel/deepseek-microphone-cleanup-integration)
package. Clone both beside the launcher and run `script/install-integrations.sh`
from the launcher root before launching or testing this plugin.

## Launch and authentication

The launcher installs this plugin into each project's web profile and supplies
`cordis.patch.yml`. Relaunch an existing project after upgrading the plugin, then
reload its browser page. CLI bridge acceptance was verified at http://127.0.0.1:3097/.

Choose **Codex CLI · ChatGPT login** or **Grok CLI · Grok login** in the model picker.
These invoke the installed, signed-in CLIs; neither route needs an xAI API key or
imports your login credentials into Harness. Existing `xai` / `openai-codex`
sessions are routed to the corresponding CLI. Other DeepSeek/API routes retain
Harness configuration. Authenticate the CLIs normally before using these routes.

Codex and Grok supply structured responses and tool requests. Harness executes
those tools with the session's own permission policy. The nested CLIs do not
execute their own tools. Changing providers does not change Harness permissions.

Grok receives the complete serialized Harness history with `--verbatim`, preventing
long-prompt offloading from hiding completed tool results. Grok's response schema
uses actual native tool schemas and argument objects; the bridge serializes those
objects for Harness. Codex retains its string-argument schema. Complete supported
CLI envelopes are unwrapped; unknown names, malformed JSON, and non-object arguments
reject the whole response before any tool is emitted. One model-only correction retry
is allowed for protocol failures. Process/auth failures and cancellation do not retry.
Persistent protocol errors carry `CLI_PROTOCOL_ERROR`; partial tool batches are never
salvaged. Already completed Harness calls remain in the unchanged conversation.

Grok local built-ins and MCP meta-tools are explicitly excluded; its backend search
is disabled with child-only `GROK_BACKEND_SEARCH=0`. Neither the empty allowlist nor
`--disable-web-search` alone disables all these routes in Grok 1.0.46. Recheck tool
filtering after CLI upgrades. Harness retains native web tools, permission settings,
and the existing CLI login. No global Grok configuration is changed.

Optional environment overrides: `AGENTS_PRO_CODEX`, `AGENTS_PRO_GROK`,
`DSH_RUNTIME` (Harness runtime directory), `AGENTS_PRO_HOME` (plugin state root).
The default runtime is `~/.local/share/deepseek-harness/runtime`.

## Models and skills settings

Settings → Models displays native **Codex CLI · ChatGPT login** and **Grok CLI · Grok login** rows. **Details** shows the resolved executable, existing-login behavior and terminal sign-in command; **Refresh** repeats executable discovery. “CLI available” means the executable exists, not that login validity was checked. No API key fields or delete actions are offered for these CLI connections. Other providers retain native API editing; legacy alias configuration is retained for existing sessions.

Settings → Agents Pro → Skills shows the current workspace/user skill catalog with native preset cards, search, count, Refresh and a read-only View dialog containing the actual skill body and location. Reads use the Harness registry, preserving project precedence. Shared skills are not edited. Loading, incomplete-discovery, empty-search and error states remain visible. The checklist integration kit download remains available below the catalog.

## Web controls

- **Microphone + dropdown:** choose draft or clean-and-send/queue. Only the chosen
  microphone icon appears. Clicking again stops recording. Preferences persist in the server settings file and load in new browser sessions. “Say go to send” detects a trailing go
  after a pause, stops recording, removes that phrase and sends the result.
- **Broom + dropdown:** clean the selected composer text using the chosen cleanup
  prompt. Dropdowns toggle closed on a second click and include Extension settings.
- **Voice safety:** audio is saved before transcription. Once stopped, processing
  survives switching sessions. Text is inserted at the captured cursor/selection
  in the original chat. Changed drafts are protected; use Saved recordings to
  insert the result. Recording works while the agent is busy; send mode queues
  the completed message. Retry Saved Dictation always returns a draft.
- **Files:** opening a file from the Files tree always places its preview beside
  the tree, preserving the original Files Explorer plugin behavior even when the
  sidebar is reopened. There is no Toggle Files button. Files stays 320px wide on desktop.
  **Close editors**, beside the native Collapse right sidebar button, closes preview tabs
  while retaining Files. Chat file links
  reopen a collapsed sidebar. Local Markdown links show a clickable file path
  beside their label. Folder links reveal and expand the folder in Files.
- **Add to Chat:** right-click a file/folder or image preview. Image files attach
  actual bytes. Right-click local images inside HTML to attach those as well.
- **Comments:** image text/voice comments and HTML element text/voice comments
  create an editable draft with file/element context. Voice comments require
  review after cleanup before Add to Chat becomes available. HTML runs inside a
  sandboxed iframe; simple local image/script/style references are bundled.
- **Tasks:** the native `@` suggestions component inside a native DisclosureRow
  accordion, aligned to the composer, capped at 260px with internal scrolling.
  Enter/Space or clicking a row opens native task details. Persistent progress
  survives reload; merge adds or
  updates stable item IDs without dropping others. Completion is agent-reported.
- **Questions:** the agent calls `agents_pro_ask_question` for choices/free text;
  execution waits for a submitted answer. System guidance teaches the agent to
  use the tool; arbitrary question prose is not automatically converted.
- **Activity:** View options → Group by activity (also the clock shortcut).
  Working sessions keep their status and native animation; session rows omit redundant project subtitles.
- **Export:** right-click a session → Save Session as Markdown, or use the header
  download action. Downloads all user/assistant messages, with attachment
  references; internal injected instructions are omitted.
- **Settings → Agents Pro:** native Plugins tabs: General, Cleanup prompts, Agents,
  Instructions and Skills. General uses the actual native PluginCard and ValueField
  controls. Runtime fields use Save/Discard; delivery and display switches save immediately.
- **Cleanup prompts:** actual AgentPresetSection cards and its View modal. The pencil
  action makes the same viewer editable, with Save and Close. Selecting a card chooses
  the cleanup prompt. Edits are atomic user overrides under
  `~/.agents-pro/harness/prompts`; shipped originals remain unchanged. Both composer
  cleanup and recording use the chosen instructions.
- **Agents:** the actual native preset section, controller and roster. Duplicate/create
  here and the same preset appears in the main Agent presets page and new-session picker.
  Native Harness owns preset authoring; the redundant Markdown-agent creation form is gone.
  Existing selected legacy Markdown agents remain effective for compatibility.
- **Instructions:** personal/workspace Markdown instructions retain their existing store
  and injection. Native preset cards/viewer and configuration fields handle creation/editing.
  User files are under `~/.copilot/instructions`; workspace files under `.github/instructions`.
  Shared user instructions remain effective across projects.
- **Global skills:** the native filesystem skill provider scans discovered nested/symlinked
  collections under `~/.agents/skills`, `~/.codex/skills`, `$CODEX_HOME/skills`, and local
  Codex Pro profile skill directories. Native parsing, skill reads, watches and project
  precedence remain in charge. Discovery is cycle-safe; new collection roots require a
  Harness restart. Native `/` suggestions include `ai-development-workflow` without
  copying or modifying it. Packaged skills inside disabled plugin caches are not enabled.
- **Resume pending tasks:** task details submit/queue the current checklist's pending
  and blocked items to that same session using stable IDs. Completed/running items are
  excluded and the unsent composer draft is preserved. The agent still verifies work
  before publishing completion. The portable kit includes an offline resume adapter.

## Speech prerequisites and recovery

Requires `/opt/homebrew/bin/ffmpeg`, Python with MLX Whisper, and a local model.
Configure **Settings → Agents Pro**, or initially set `AGENTS_PRO_MLX_PYTHON`
and `AGENTS_PRO_MLX_MODEL`, or use the existing
`codexPro.mlxPython` and `codexPro.mlxWhisperModelPath` values from the Pro 2 user
settings. The Python worker is included in the plugin package. Cleanup uses the
signed-in Codex CLI (default `gpt-5.6-luna`). Browser microphone permission is
required; localhost is a secure context.

Default state: `~/.agents-pro/harness`. Each recording retains `audio.original`,
`audio.wav`, `raw.txt`, `cleaned.txt` and `recording.json`. Checklists and selected
agents are also stored here. `settings.json` stores shared plugin preferences;
changing the recording directory keeps earlier directories available for recovery.
Changing model settings does not dispose a worker with an existing job. Closing/reloading a page interrupts capture or
browser delivery; already saved audio remains recoverable from Saved recordings.
A server restart requires retrying any interrupted transcription. Session
navigation after stopping a recording is supported without retry.

## Portable skill integration

Download the checklist kit from Agents Pro settings, or copy
`skill-integration/checklists/agents-pro-checklist-kit.zip`. It contains scripts,
protocol examples and integration instructions. The shared workflow skill was
not edited. Call `agents_pro_update_checklist` with a stable `id` and item `id`,
`text`, and `status` (`pending`, `in_progress`, `completed`, `blocked`); default
merge preserves omitted items, explicit replace replaces that list only.

## Packaging and verification

Run `npm pack --dry-run` in this directory to inspect the plugin archive. The
CLI and microphone/cleanup packages must be installed separately from their
sibling checkouts; the plugin archive does not bundle those repositories.
The plugin depends on the launcher's installed Harness runtime/public services;
it is not a standalone web server. Upgrade compatibility should be rechecked,
especially Markdown rendering and native menu integration.

The earlier task record under `documents/tasks/development/2026-10-05-00003-*` records
live Chromium interaction against port 3081, real Codex/Grok responses and tool
round trips, image recognition, questions, Tasks, files/comments, export,
customizations, voice recovery, queueing and go detection. Voice acceptance used
known spoken WAV audio through Chromium's microphone capture pipeline, not a
physical microphone. Long-recording go detection was checked after 125 seconds
of leading silence. Backend regression tests are in `tests/regression.test.mjs`.

Current transport limits: recordings below 100 MB; phrase snapshots below 20 MB;
Grok JSON image requests above 220 KB are rejected with an actionable error
instead of failing at process launch. Image inputs are resized by Harness.
HTML preview is for files, not a replacement for running a full application;
server routes, deep CSS dependencies and cross-origin interactions are not
bundled. Sidebar metadata/menu integration uses native DOM hooks and must be
rechecked after Harness UI updates.

## Native UI ownership (0.4.0)

| Surface | Harness component reused |
| --- | --- |
| Microphone, broom, toolbar, export, preview actions | `dsh-client-ui-primitives.Button` |
| Delivery/cleanup/settings choices and context menus | `dsh-client-ui-primitives.Menu` |
| Saved audio, task details, image/element/text/voice dialogs | `dsh-client-ui-primitives.Modal` |
| Task header and activity headers | `dsh-client-ui-primitives.DisclosureRow` |
| Task rows, viewport, highlight, typography | Actual `MenuView` from the `conversation.input.overlay` `slash-menu` slot |
| Settings tabs | Actual `PluginsSettingsSection` from the native Settings slot |
| Configuration | Actual native `PluginCard` and `ValueField`, with native `Menu` and `Switch` |
| Prompt/instruction cards and viewer | Actual `AgentPresetSection`; data/action adapter changes content and adds edit/save |
| Agents | Native `AgentPresetSection` plus its existing injected controller/store |
| Close editors | Native sidebar button class, icon and Tooltip beside native collapse control |
| Question choices and submission | Native `userQuestions` service and UI |

Multiline fields adapt the native Input frame and input classes to a textarea.
Plugin CSS handles placement, wrapping and dimensions using Harness theme tokens;
there is no separate dark palette. HTML file content retains the file's own styles.
Native slots and exported primitives are compatibility boundaries: recheck these
after upgrading Harness. The task evidence for 0.3.0 is in
`documents/tasks/development/2026-10-06-00001-replace-agents-pro-web-ui-with-native-harness-components-and-ver`.

## 0.4.0 verification

The new task record under `documents/tasks/development/2026-10-06-00002-*` contains
native UI evidence in light/dark mode, prompt edit/save/read, native preset creation
and roster visibility, instruction editing, Files widths and close controls, native
skill discovery/read via a real Codex conversation, and resume-while-busy with draft
preservation. Backend tests cover immutable shipped prompts, overrides, symlink cycles,
checklist resume filtering and session isolation. The launcher's AGENTS.md requires
native component reuse and visual verification for future changes.

## 0.4.4 — Project skill switches and goal progress

Settings → Agents Pro → Skills keeps the native searchable cards and View dialog, with a native switch on every card. All skills start disabled, including new discoveries. Selections apply to every session in that project and persist in `~/.agents-pro/harness/skills/<sha256-of-project-root>.json` (or `AGENTS_PRO_HOME/skills`). Other projects remain independent. Enablement uses the native winning skill name; project/provider precedence remains unchanged.

Disabled skills are excluded from the native catalog, slash suggestions and skill loading. Settings can still inspect them. Disabling does not delete installed files or erase instructions already loaded into an existing conversation. The common registry boundary covers Codex CLI, Grok CLI and native API providers; CLI bridge instructions exclude CLI-local catalogs.

For active goals, `lib/goal-progress.js` detects six inspection-only steps with at least three exact repeats, or ten inspection-only steps. It adds current system guidance to advance the pending task or workflow stage, perform a justified change and verification, or identify a specific missing fact. It does not disable reads, force writes, change permissions, submit answers, or complete a goal automatically. Normal actions reset the run; paused/non-goal sessions are unaffected. Existing session events retain continuity across compaction.

Verification: native-registry tests, goal detection tests, both live projects on3097/3098, native switches with reload and independent selections, View and screenshots in light/dark. See the selected development record for exact live goal results and limitations. Restart running Harness instances and reload browsers after upgrading the plugin.
