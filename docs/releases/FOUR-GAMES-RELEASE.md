# Four-game enrichment · 2026-10-19

Persona keeps its six questions, eight results and public IDs. A completed local quiz can preview a changed answer, cancel it, or adopt the recomputed result. Shared results do not invent an answer history.

Parallel Life adds four three-scene adventures with visible time/goodwill changes, 32 paths and 12 reachable endings. Players can reconsider the final scene or restart. The original twelve versioned archives remain available. New adventure state stays in page memory and is not encoded in links.

Let Fate Decide keeps quick draws and adds exclusion plus a 2–16 candidate comparison round: keep one, put both down, undo, restore and confirm. Custom options stay local, escaped and untranslated when switching language.

Daily missions add two specific approaches for all thirty tasks and a local booklet counting unique task IDs. Two daily swaps, UTC+8 rotation and existing storage remain compatible. Shared tasks lead to claiming the visitor's own daily mission.

All new content supports English, Simplified Chinese, Japanese and Spanish. Existing illustration styling is extended with story progress, answer comparisons, candidate cards and a folded booklet. Dispatch rules/assets are unchanged by this release; the preceding animation commit is retained.

Validation: `npm test`, Sites build/archive validation, and production-configured Pages build/verification passed. Local browser interaction covered persona preview/cancel/adopt, four adventure worlds, old versioned links, custom/escaped multilingual candidates, comparison undo/restore/zero candidates, quick exclusion, mission stamps/swaps/shared claims, 320px layouts and `/oddlab/` routes. Sampled live local tracking requests contained only action/kind/locale/source_path/target_url; synthetic private candidate text was absent. Admin authorization regressions passed; Pages continues to omit the backend and stats UI.

Limits: local browser evidence and deployment status do not establish player enjoyment, replay intent or session length. Production browser sessions, blocked-storage operation and native OS share dialogs were not exercised in this release. Next acceptance is 3–5 independent playtests focused on whether decisions have understandable consequences and invite another attempt.
