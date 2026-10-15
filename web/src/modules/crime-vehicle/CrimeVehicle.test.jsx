import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import NodeStatus from './components/cctv/NodeStatus';

describe('Crime Vehicle ANPR Detection Frontend Unit Tests', () => {
  it('renders ONLINE node status badge correctly', () => {
    render(<NodeStatus status="ONLINE" />);
    expect(screen.getByText('ONLINE')).toBeInTheDocument();
  });

  it('renders OFFLINE node status badge correctly', () => {
    render(<NodeStatus status="OFFLINE" />);
    expect(screen.getByText('OFFLINE')).toBeInTheDocument();
  });

  it('renders ANALYZING status badge when AI detection pipeline is active', () => {
    render(<NodeStatus status="ANALYZING" />);
    expect(screen.getByText('ANALYZING')).toBeInTheDocument();
  });
});
