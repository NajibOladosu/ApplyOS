import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmModal } from '@/components/modals/confirm-modal'

describe('ConfirmModal', () => {
  it('renders title and description when open', () => {
    render(
      <ConfirmModal
        isOpen
        title="Delete user?"
        description="This action cannot be undone."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByText('Delete user?')).toBeInTheDocument()
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument()
  })

  it('renders default button labels', () => {
    render(
      <ConfirmModal
        isOpen
        title="t"
        description="d"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('renders custom button labels', () => {
    render(
      <ConfirmModal
        isOpen
        title="t"
        description="d"
        confirmText="Delete"
        cancelText="Keep"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument()
  })

  it('calls onConfirm when confirm button clicked', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmModal
        isOpen
        title="t"
        description="d"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when cancel button clicked', async () => {
    const onCancel = vi.fn()
    render(
      <ConfirmModal
        isOpen
        title="t"
        description="d"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ConfirmModal
        isOpen={false}
        title="hidden"
        description="d"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
    expect(screen.queryByText('hidden')).not.toBeInTheDocument()
  })

  it('disables both buttons when isLoading=true', () => {
    render(
      <ConfirmModal
        isOpen
        title="t"
        description="d"
        isLoading
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('does NOT call onConfirm when clicked while loading', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmModal
        isOpen
        title="t"
        description="d"
        isLoading
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
