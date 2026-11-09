import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

describe('App & Hash Navigation (Seam 2)', () => {
  beforeEach(() => {
    window.location.hash = '';
    localStorage.clear();
  });

  it('renders navigation header with brand title and date badge', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: '주간 시간표' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /오늘의 할 일/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /주간 시간표/i })).toBeInTheDocument();
  });

  it('renders today schedule items by default', () => {
    render(<App />);
    // Today view header should be visible
    expect(screen.getByTestId('today-view')).toBeInTheDocument();
    // Default items should be rendered
    expect(screen.getAllByText('코딱지').length).toBeGreaterThan(0);
  });

  it('switches between Today and Weekly grid views via hash routing tabs', () => {
    render(<App />);

    // Click Weekly view tab
    const weeklyTab = screen.getByRole('button', { name: /주간 시간표/i });
    fireEvent.click(weeklyTab);

    expect(window.location.hash).toBe('#weekly');
    expect(screen.getByTestId('weekly-view')).toBeInTheDocument();

    // Check all 7 weekday headers exist in weekly grid
    ['월', '화', '수', '목', '금', '토', '일'].forEach((day) => {
      expect(screen.getByTestId(`weekly-col-${day}`)).toBeInTheDocument();
    });

    // Click Today view tab
    const todayTab = screen.getByRole('button', { name: /오늘의 할 일/i });
    fireEvent.click(todayTab);

    expect(window.location.hash).toBe('#today');
    expect(screen.getByTestId('today-view')).toBeInTheDocument();
  });

  it('responds to browser window hashchange events', () => {
    render(<App />);

    // Simulate direct hash navigation to #weekly
    window.location.hash = '#weekly';
    fireEvent(window, new HashChangeEvent('hashchange'));

    expect(screen.getByTestId('weekly-view')).toBeInTheDocument();

    // Simulate back button to #today
    window.location.hash = '#today';
    fireEvent(window, new HashChangeEvent('hashchange'));

    expect(screen.getByTestId('today-view')).toBeInTheDocument();
  });
});
