# Neo4j Status Display - UI Mockups

## Current UI (Qdrant Only)

```
┌────────────────────────────────────────────────────────────┐
│  Code Index Settings                                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Status                                                    │
│  ● Indexing                                                │
│                                                            │
│  ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  45 / 100 blocks                                           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Proposed UI - State 1: Both Indexing

```
┌────────────────────────────────────────────────────────────┐
│  Code Index Settings                                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Status                                                    │
│  ● Indexing - Building code index...                      │
│                                                            │
│  Vector Index (Qdrant)                                     │
│  ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  45 / 100 blocks                                           │
│                                                            │
│  Graph Index (Neo4j)                                       │
│  ● ▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  30 / 100 files                                            │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Legend:**

- `●` = Yellow pulsing dot (indexing in progress)
- `▓` = Filled progress bar
- `░` = Empty progress bar

---

## Proposed UI - State 2: Qdrant Complete, Neo4j Still Indexing

```
┌────────────────────────────────────────────────────────────┐
│  Code Index Settings                                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Status                                                    │
│  ● Indexing - Finalizing graph relationships...           │
│                                                            │
│  Vector Index (Qdrant)                                     │
│  ● ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│  100 / 100 blocks - Complete                               │
│                                                            │
│  Graph Index (Neo4j)                                       │
│  ● ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░  │
│  75 / 100 files                                            │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Legend:**

- `●` = Green dot for Qdrant (complete), Yellow pulsing for Neo4j (indexing)

---

## Proposed UI - State 3: Both Complete

```
┌────────────────────────────────────────────────────────────┐
│  Code Index Settings                                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Status                                                    │
│  ● Indexed - Index up-to-date                             │
│                                                            │
│  Vector Index (Qdrant)                                     │
│  ● 100 blocks indexed                                      │
│                                                            │
│  Graph Index (Neo4j)                                       │
│  ● 100 files indexed, 1,234 nodes, 2,456 relationships    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Legend:**

- `●` = Green dot (both complete)
- No progress bars shown when complete

---

## Proposed UI - State 4: Neo4j Error

```
┌────────────────────────────────────────────────────────────┐
│  Code Index Settings                                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Status                                                    │
│  ● Indexed - Vector index complete                        │
│                                                            │
│  Vector Index (Qdrant)                                     │
│  ● 100 blocks indexed                                      │
│                                                            │
│  Graph Index (Neo4j)                                       │
│  ● Connection failed: Could not connect to bolt://local... │
│  ⚠ Check your Neo4j settings and ensure the server is     │
│     running. Vector search will continue to work.          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Legend:**

- `●` = Green dot for Qdrant (complete), Red dot for Neo4j (error)
- `⚠` = Warning icon

---

## Proposed UI - State 5: Neo4j Disabled

```
┌────────────────────────────────────────────────────────────┐
│  Code Index Settings                                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Status                                                    │
│  ● Indexing                                                │
│                                                            │
│  Vector Index                                              │
│  ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  45 / 100 blocks                                           │
│                                                            │
│  (No Neo4j section shown)                                  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Note:** When Neo4j is disabled, the UI looks identical to the current implementation.

---

## Color Coding Reference

### Status Dots

- **Gray** (`bg-gray-400`): Standby / Idle
- **Yellow** (`bg-yellow-500 animate-pulse`): Indexing in progress
- **Green** (`bg-green-500`): Indexed / Complete
- **Red** (`bg-red-500`): Error

### Progress Bars

- **Qdrant**: Blue/Primary color (`bg-primary`)
- **Neo4j**: Green color (`bg-green-600`) to distinguish from Qdrant

---

## Responsive Behavior

### Desktop (Wide Screen)

- Both progress bars shown side-by-side if space allows
- Full error messages displayed

### Mobile / Narrow Screen

- Progress bars stack vertically (already the case)
- Error messages may wrap or truncate with tooltip

---

## Accessibility Considerations

1. **Color Blind Users:**

    - Don't rely solely on color for status
    - Use icons (●, ⚠) and text labels
    - Different progress bar colors are supplementary

2. **Screen Readers:**

    - Status dots have aria-labels
    - Progress bars have aria-valuenow, aria-valuemin, aria-valuemax
    - Error messages are announced

3. **Keyboard Navigation:**
    - All interactive elements are keyboard accessible
    - Focus indicators are visible

---

## Animation & Transitions

1. **Progress Bar Updates:**

    - Smooth transition: `transition-transform duration-300 ease-in-out`
    - Updates every 100-500ms (debounced to avoid jank)

2. **Status Dot Pulsing:**

    - Yellow dot pulses during indexing: `animate-pulse`
    - Stops pulsing when complete or error

3. **Section Appearance:**
    - Neo4j section fades in when enabled
    - Fades out when disabled (optional, could be instant)

---

## Implementation Notes

### CSS Classes Needed

```css
/* Already exist in codebase */
.bg-gray-400
.bg-yellow-500
.bg-green-500
.bg-red-500
.animate-pulse

/* May need to add */
.bg-green-600  /* For Neo4j progress bar */
```

### Component Structure

```tsx
<StatusSection>
	<OverallStatus />
	<VectorIndexProgress />
	{neo4jEnabled && <GraphIndexProgress />}
</StatusSection>
```

### State Management

- Single `indexingStatus` object with both Qdrant and Neo4j fields
- Updates come from backend via `indexingStatusUpdate` messages
- UI reactively updates based on status changes
