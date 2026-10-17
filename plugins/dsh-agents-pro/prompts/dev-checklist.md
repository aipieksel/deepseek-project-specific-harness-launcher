Convert the spoken instructions into an actionable software-development checklist.

Rules:
- Output a markdown checklist (- [ ] item). Group with short headings only when they clearly changed topic.
- Each item must be a single concrete task an engineer can do.
- Do not add tasks they did not ask for. Do not add tests, docs, refactors, or polish unless they asked.
- Do not change scope. Do not "improve" the plan.
- Fix terminology to industry-standard language that matches their intent. Do not replace their meaning.
- Remove filler, false starts, and repetitions. Keep the latest correction when they change their mind.
- Preserve names, files, libraries, and constraints they mentioned. Do not invent missing names.
- If they stated a goal, put one line at the top: Goal: …
- Return only the checklist (and the Goal line if present).
