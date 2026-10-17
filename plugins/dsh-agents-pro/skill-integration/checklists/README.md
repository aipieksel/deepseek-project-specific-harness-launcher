# Agents Pro checklist integration kit

Give this folder or `agents-pro-checklist-kit.zip` to your skill creator. This is a portable handoff, not an installer. It does not modify any skill or contact a server. The extension supplies the Tasks UI and tool; the skill creator decides how to integrate publication with your skill's existing planning and verification rules.

The original kit code is MIT licensed; keep its included `LICENSE` with any copy or redistributed archive.

In VS Code run **VS Code Agents Pro: Open Checklist Integration Kit** to read this document, or **Save Checklist Integration Kit…** to copy the bundled ZIP. The folder is `skill-integration/checklists` inside the installed extension.

## Skill creator instructions

1. Copy `scripts/checklist_payload.py` into the target skill or reference the bundled copy. It requires Python 3.10+ and only the standard library.
2. Keep the skill's durable checklist and source/verification rules authoritative. Add publication at initial planning, task additions, progress changes and final handoff. Never mark work completed merely because a command or converter ran.
3. Generate arguments using one of the commands below. Then call the **available** `agents_pro_update_checklist` tool (its name can have an MCP prefix) in the current chat with that JSON. The Python helper only prints JSON; it does not publish. No endpoint, token or target chat argument is needed.
4. Require a successful reply with `status: published` before treating the Tasks panel as updated. Once acknowledged, use the panel rather than repeating the checklist in chat. On unavailable/failed publication, explicitly say the panel was not updated and show the Markdown checklist. Do not claim success from converter output alone.
5. Reuse the same checklist ID and item IDs for updates. Merge adds items and updates existing IDs, retaining omitted ones. Use replace only to intentionally reconcile the complete named checklist; it does not clear other lists. Renaming text must retain its item ID.
6. Test initial publish, an appended item, a status change, collapsed updates, navigation/reload, failure fallback and multiple lists. The user should see real completion counts, selectable accordion expansion and agent-owned status indicators (not editable checkboxes).

The extension provides this tool for local Codex, Grok and DeepSeek Agent Host chats. Provider credentials and model compliance are separate prerequisites. It does not inspect prose for implicit tasks.

## Convert an existing development record

```sh
python3 scripts/checklist_payload.py --record /absolute/path/to/selected-record
```

Reads `record.json` and `checklist.md`; the record folder supplies the default stable list ID. This adapter can be reused without rewriting the whole workflow. Keep the same explicit `--id` if moving/renaming a record.

## Convert any Markdown checklist

```sh
python3 scripts/checklist_payload.py --checklist examples/checklist.md --id feature-report --title "Report implementation"
```

Optional: `--mode merge|replace` (default merge), `--output /path/to/payload.json`. Markers: `[ ]` pending, `[~]` in progress, `[x]` completed, `[!]` blocked. R IDs are retained; anonymous IDs derive from label text, so use explicit R IDs for tasks you may rename. Wrapped/nested items are supported, fenced examples ignored, duplicate IDs rejected.

## Tool contract

See `protocol.json` for the input schema and `examples/` for initial and incremental payloads. All items must include `id`, `text` and `status`, even when updating just status. There is no chat/channel field: the extension derives the destination from the calling tool's chat.

- Status: `pending`, `in_progress`, `completed`, `blocked`.
- Limits: 200 characters per ID, 300 per title, 4000 per text, 1000 items per list, 30 lists per chat. Nonempty strings required. Grok/DeepSeek's MCP bridge has a 64 KiB request limit; use smaller merge batches for large lists.
- Reply example: `{"status":"published","id":"feature-report","completed":1,"total":3,"revision":2}`.
- Persistence: local per-chat extension storage survives navigation/reload. The helper does not write that storage directly.

## Scope of this handoff

The previous agent-added publication sections and helper were removed from the shared `ai-development-workflow` skill at the user's request. This package is the proposed integration material for the user's skill creator to review and apply. It includes no auto-installation, live-skill edit, or change to that skill's execution gates.

## Resume pending tasks (Harness)

Task details include **Resume pending tasks**. This submits (or queues while busy)
a request to the originating chat for pending and blocked items in that checklist.
It reads the latest stored list, carries its stable ID and existing item IDs,
leaves completed/in-progress items alone, and preserves the composer draft.
The button does not mark any item complete or rewrite the skill's task record.

Skill authors should add this handling to their own workflow:

1. Recognize a resume request naming an existing checklist. Resolve its existing
   durable record; do not allocate a new record or new checklist ID.
2. Reconcile current pending/blocked tasks against that record. Preserve all
   verified completed tasks; resolve blockers or ask a required question.
3. Update status with `agents_pro_update_checklist`, the same IDs, and `mode: merge`.
   Include `text` and `status` for every updated item. Append new tasks with new
   stable IDs only when requested or necessary under the skill's scope rules.
4. Continue the skill's normal authorization, review and verification gates.
   A resume request is not proof that a blocker disappeared or a test passed.

`scripts/resume_payload.py --payload published-checklist.json` prints a resume
request for an existing payload (or `--record /path/to/record`). It is an offline
adapter; it neither submits a chat message nor updates Tasks. Skill creators can
reuse it without adopting a new workflow or editing the original skill here.
