# Tech Spec: Improve Element State Preservation During Reruns

The current implementation can cause unnecessary unmounting of React components when a Streamlit script rerun adds new elements. This happens because elements are often replaced based on their position in the script, rather than being identified as the same element that has just moved.

The goal of this change is to improve the rerendering logic to keep existing elements mounted if they are still present in the new script run, even if new elements are inserted before them. This will preserve the React component state of these elements.

This will be achieved by modifying the way Deltas are applied to the frontend's element tree.

## Implementation Plan

1.  **Modify `BlockNode.setIn` to handle reordering, updates, and insertions:**
    The core of the change will be in `BlockNode.setIn` in `frontend/lib/src/AppNode.ts`. When a new delta arrives for a specific `deltaPath`, the logic will be as follows:
    *   **Handle Reordering:** Before any insertion or replacement, if the new node has an ID, search the `children` array from the `childIndex` onwards. If a node with the same ID is found at a later position, remove it. This handles cases where an element is moved to an earlier position in the script.
    *   **Handle Updates vs. Insertions:** After the reordering check, inspect the **existing** node at the `childIndex`.
        *   If the existing node has an ID and the new node has the **same ID**, perform a direct **replace**.
        *   If the existing node has an ID, but the new node has a **different ID**, perform an **insert**.
        *   If the existing node has **no ID**, perform a **replace**.

2.  **Leverage existing rendering logic for visual correctness:**
    *   In `Block.tsx`, the `ChildRenderer` iterates through children and uses an `elementKeySet` to prevent rendering elements with the same key more than once. The *first* one encountered is rendered. This logic remains unchanged.

3.  **Rely on existing cleanup mechanism:**
    *   At the end of a script run, `App.tsx` calls `clearStaleNodes`.
    *   This function removes all nodes that don't have the current `scriptRunId`. Old element nodes that were preserved via insertion will have a stale `scriptRunId` and will be correctly removed.

This refined approach correctly handles in-place updates, insertions, and reordering, ensuring state is preserved where possible with minimal changes.
