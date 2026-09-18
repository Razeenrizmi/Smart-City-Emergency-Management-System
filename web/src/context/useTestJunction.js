import { useContext } from 'react';
import { TestJunctionContext } from './testJunctionContextValue';

export function useTestJunction() {
  const ctx = useContext(TestJunctionContext);
  if (!ctx) {
    throw new Error('useTestJunction must be used within a TestJunctionProvider');
  }
  return ctx;
}
