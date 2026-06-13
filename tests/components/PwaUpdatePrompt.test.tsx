import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PwaUpdatePrompt } from '../../src/components/shared/PwaUpdatePrompt';
import { pwaMock } from '../stubs/pwa-register';

// PwaUpdatePrompt imports `virtual:pwa-register/react`, aliased to tests/stubs/
// pwa-register in vitest.config — so the component and this test share `pwaMock`.

beforeEach(() => {
  pwaMock.needRefresh = false;
  pwaMock.setNeedRefresh.mockClear();
  pwaMock.updateServiceWorker.mockClear();
});

describe('PwaUpdatePrompt', () => {
  it('renders nothing while no update is waiting', () => {
    const { container } = render(<PwaUpdatePrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the reload prompt when a new build is precached', () => {
    pwaMock.needRefresh = true;
    render(<PwaUpdatePrompt />);
    expect(screen.getByText('A new version is ready.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('Reload activates the new service worker with true (which reloads)', () => {
    pwaMock.needRefresh = true;
    render(<PwaUpdatePrompt />);
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    // The `true` arg is load-bearing — it's what forces the reload. Lock it.
    expect(pwaMock.updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('Later dismisses the prompt without updating', () => {
    pwaMock.needRefresh = true;
    render(<PwaUpdatePrompt />);
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(pwaMock.setNeedRefresh).toHaveBeenCalledWith(false);
    expect(pwaMock.updateServiceWorker).not.toHaveBeenCalled();
  });
});
