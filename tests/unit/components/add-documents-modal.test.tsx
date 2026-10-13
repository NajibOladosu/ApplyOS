import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddDocumentsModal } from '@/modules/applications/components/modals/add-documents-modal'
import type { Document } from '@/types/database'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

const documents = [
  {
    id: 'linked-document',
    file_name: 'Already linked.pdf',
    file_size: 1024,
    analysis_status: 'success',
  },
  {
    id: 'available-document',
    file_name: 'Current resume.pdf',
    file_size: 2048,
    analysis_status: 'not_analyzed',
  },
] as Document[]

describe('AddDocumentsModal', () => {
  it('shows only unlinked documents and submits the selected ids', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()

    render(
      <AddDocumentsModal
        isOpen
        documents={documents}
        linkedDocumentIds={['linked-document']}
        onClose={vi.fn()}
        onAdd={onAdd}
      />
    )

    expect(screen.queryByText('Already linked.pdf')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Current resume\.pdf/i }))
    await user.click(screen.getByRole('button', { name: 'Add 1' }))

    expect(onAdd).toHaveBeenCalledWith(['available-document'])
  })

  it('clears a pending selection when the picker is reopened', async () => {
    const user = userEvent.setup()
    const props = {
      documents,
      linkedDocumentIds: ['linked-document'],
      onClose: vi.fn(),
      onAdd: vi.fn(),
    }
    const { rerender } = render(<AddDocumentsModal isOpen {...props} />)

    await user.click(screen.getByRole('button', { name: /Current resume\.pdf/i }))
    expect(screen.getByRole('button', { name: 'Add 1' })).toBeEnabled()

    rerender(<AddDocumentsModal isOpen={false} {...props} />)
    rerender(<AddDocumentsModal isOpen {...props} />)

    expect(screen.getByRole('button', { name: 'Add selected' })).toBeDisabled()
  })

  it('offers an upload path and can close when the library is empty', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(
      <AddDocumentsModal
        isOpen
        documents={[]}
        linkedDocumentIds={[]}
        onClose={onClose}
        onAdd={vi.fn()}
      />
    )

    expect(screen.getByText('No documents yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Upload a document' })).toHaveAttribute('href', '/upload')

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('keeps controls disabled while relationships are being saved', () => {
    render(
      <AddDocumentsModal
        isOpen
        documents={documents}
        linkedDocumentIds={['linked-document']}
        isSaving
        onClose={vi.fn()}
        onAdd={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /Current resume\.pdf/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Adding...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })
})
