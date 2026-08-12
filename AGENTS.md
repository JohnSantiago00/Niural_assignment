# Niural_assignment

This workspace is dedicated to the `Niural_assignment` project.

## Focus
- Work only on this project unless john explicitly asks otherwise.
- Treat this folder as the project root.
- Keep project-specific notes and decisions here.
- Use the global assistant home for cross-project memory, not project implementation details.

## Session conventions
- `Niural_assignment-main` for normal project work


## Single-model session policy
- The selected session model performs the whole task. Do not invoke another model or spawn a subagent unless john explicitly requests it.
- Any explicitly requested subagent must stay under the current agent and use the current session's exact provider/model.

## Output style
- In normal project chat, be concise and clear.
- End useful replies with the next best action when it helps.
- Prefer compact command/status output with icons or checkmarks.
- In debug mode, be structured, technical, and blunt. Lead with the failure, cause, and fix.
- Avoid rambling, vague reassurance, or noisy boilerplate.

## Project notes
- Keep setup steps, architecture notes, and decisions in this folder.

## Git discipline
- If this folder is not a git repo, say so and ask before running `git init`. Never init silently.
- Commit at safe checkpoints: the change is coherent and whatever tests/builds exist pass. Don't hold out for perfect.
- Never commit mid-task. Finish the change, verify it, then commit.
- Push after committing when `origin` exists and verification passed. No remote means commit locally and say so once.
- Never commit secrets (`.env`, keys, tokens) or build artifacts. Fix `.gitignore` instead.
- For long multi-turn work, run `projgit lock` at the start and `projgit unlock` when done, so the automatic sweep can't commit a half-finished change.
- A sweep (`projgit sweep`, every 30 min) commits and pushes anything left behind. It is a safety net, not a replacement for committing your own work with a real message.
