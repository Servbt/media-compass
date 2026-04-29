import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'

describe('App capture stabilization', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('persists manually captured items after remount', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)

    await user.type(screen.getByLabelText('Title'), 'Past Lives')
    await user.selectOptions(screen.getByLabelText('Category'), 'movie')
    await user.type(screen.getByLabelText('Tags'), 'quiet, romantic')
    await user.type(screen.getByLabelText('Reason'), 'A beautiful film for a quieter mood.')
    await user.click(screen.getByRole('button', { name: /add to queue/i }))

    expect(screen.getByText('Past Lives')).toBeInTheDocument()

    unmount()
    render(<App />)

    expect(screen.getByText('Past Lives')).toBeInTheDocument()
  })

  it('keeps review inbox items out of picker eligibility', async () => {
    const user = userEvent.setup()
    render(<App />)

    const reviewInbox = screen.getByRole('region', { name: /review inbox/i })
    expect(within(reviewInbox).getByText('Dune')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Category filter'), 'other')
    await user.click(screen.getByRole('button', { name: /pick for me/i }))

    expect(screen.getByText(/no matching options/i)).toBeInTheDocument()
  })

  it('can approve an inbox item into the queue', async () => {
    const user = userEvent.setup()
    render(<App />)

    const reviewInbox = screen.getByRole('region', { name: /review inbox/i })
    await user.click(within(reviewInbox).getByRole('button', { name: /approve/i }))

    expect(within(reviewInbox).queryByText('Dune')).not.toBeInTheDocument()
    expect(screen.getByText('Dune')).toBeInTheDocument()
  })
})
