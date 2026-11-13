import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

import { DeckZoneTable } from "../src/pages/decks/deck-zone-table"

afterEach(cleanup)

function renderTable({
  canEdit = true,
  shareMode = false,
}: {
  canEdit?: boolean
  shareMode?: boolean
} = {}) {
  const onBulkEdit = vi.fn()
  const onBulkMove = vi.fn()
  const onBulkDelete = vi.fn()

  render(
    <DeckZoneTable
      canEdit={canEdit}
      cards={
        [
          {
            id: "considering-1",
            quantity: 1,
            zone: "considering",
            card: { name: "Counterspell", typeLine: "Instant" },
            allocationStatus: {
              state: "missing",
              required: 1,
              allocated: 0,
              available: 0,
              missing: 1,
              owned: 0,
              candidates: [],
            },
          },
        ] as never
      }
      deckId="deck-1"
      highlightedCardIds={null}
      isSelecting={false}
      isUpdating={false}
      onBulkEdit={onBulkEdit}
      onBulkMove={onBulkMove}
      onBulkDelete={onBulkDelete}
      onDelete={vi.fn()}
      onEdit={vi.fn()}
      onMove={vi.fn()}
      onPreview={vi.fn()}
      onTag={vi.fn()}
      onToggleSelected={vi.fn()}
      selectedCardIds={new Set()}
      shareMode={shareMode}
      title="Considering"
    />,
  )

  return { onBulkDelete, onBulkEdit, onBulkMove }
}

test("provides bulk actions for the Considering cards", () => {
  const { onBulkDelete, onBulkEdit, onBulkMove } = renderTable()
  fireEvent.click(screen.getByText("Considering"))
  const actions = within(screen.getByRole("group", { name: "Bulk actions for Considering" }))

  fireEvent.click(actions.getByRole("button", { name: "Edit all" }))
  fireEvent.click(actions.getByRole("button", { name: "Move all to Mainboard" }))
  fireEvent.click(actions.getByRole("button", { name: "Delete all" }))

  expect(onBulkEdit).toHaveBeenCalledOnce()
  expect(onBulkMove).toHaveBeenCalledOnce()
  expect(onBulkDelete).toHaveBeenCalledOnce()
})

test("hides bulk actions for read-only lists", () => {
  renderTable({ canEdit: false })
  fireEvent.click(screen.getByText("Considering"))
  expect(screen.queryByRole("group", { name: "Bulk actions for Considering" })).toBeNull()
})
