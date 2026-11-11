# Scope: Milestone 4 - Functional & SM-2 Alignment

## Architecture
- Study session page (`src/app/decks/[id]/study/page.tsx`) communicates with:
  - `/api/decks/[id]/study` to fetch only due cards for spaced repetition study
  - `/api/cards/[id]/review` to submit SM-2 quality ratings (0-5)
- Component hygiene:
  - `src/components/UserAvatar.tsx`: Fix `@next/next/no-img-element` cleanly using Next.js `Image` with fallback and unoptimized flag
  - `src/lib/studyAudio.ts`: Fix `import/no-anonymous-default-export` by assigning object to named const `studyAudio`

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 17 | Spaced Repetition Study Flow | Update `src/app/decks/[id]/study/page.tsx` to fetch due cards from `/api/decks/[id]/study`, handle empty due cards gracefully, ensure rating submission to `/api/cards/[id]/review` | M4 | Project Inventory #17 |
| 18 | UI & Audio Cleanliness | Fix next/image in `UserAvatar.tsx` and named export in `studyAudio.ts` | M4 | Project Inventory #18 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M4.1 | SM-2 Study Flow & Component Hygiene | Implement study session due-card fetching, empty state, review submission, UserAvatar fix, studyAudio named export | M1, M3 | **DONE** (Gate: PASS, Clean Audit, Reviewers & Challengers Approved) |

## Interface Contracts
### Client Study Page ↔ `/api/decks/[id]/study`
- GET `/api/decks/${deckId}/study`
- Response: JSON array of due `Card` objects (where `nextReview <= new Date()`).
- Empty array: Render user-friendly empty/completion state ("All caught up! No cards due for review right now.").

### Client Study Page ↔ `/api/cards/[id]/review`
- POST `/api/cards/${cardId}/review`
- Body: `{ quality: number }` (0 to 5)
- Response: JSON with updated card SM-2 state and review record.

## Code Layout (Owned Files)
- `src/app/decks/[id]/study/page.tsx`
- `src/components/UserAvatar.tsx`
- `src/lib/studyAudio.ts`
