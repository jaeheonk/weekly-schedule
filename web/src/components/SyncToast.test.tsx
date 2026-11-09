import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SyncToast } from './SyncToast';

describe('SyncToast Component', () => {
  it('does not render when status is idle and message is null', () => {
    const { container } = render(
      <SyncToast status="idle" message={null} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders syncing state with spinner and message', () => {
    render(
      <SyncToast status="syncing" message="클라우드 동기화 중..." onClose={vi.fn()} />
    );
    expect(screen.getByText('클라우드 동기화 중...')).toBeInTheDocument();
    expect(screen.getByTestId('sync-toast')).toHaveClass('from-blue-600');
  });

  it('renders success state with checkmark and gradient', () => {
    render(
      <SyncToast status="success" message="클라우드 동기화 완료" onClose={vi.fn()} />
    );
    expect(screen.getByText('클라우드 동기화 완료')).toBeInTheDocument();
    expect(screen.getByTestId('sync-toast')).toHaveClass('from-emerald-600');
  });

  it('renders error state with warning and error gradient', () => {
    render(
      <SyncToast status="error" message="동기화 실패: 네트워크 오류" onClose={vi.fn()} />
    );
    expect(screen.getByText('동기화 실패: 네트워크 오류')).toBeInTheDocument();
    expect(screen.getByTestId('sync-toast')).toHaveClass('from-rose-600');
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <SyncToast status="success" message="완료" onClose={handleClose} />
    );
    const closeBtn = screen.getByRole('button', { name: /닫기/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
