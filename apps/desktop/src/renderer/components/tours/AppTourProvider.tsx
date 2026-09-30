import type { ReactNode } from 'react';
import { TourManager } from './TourManager';
import { GuideHost } from '../guides/GuideHost';

interface AppTourProviderProps {
  children: ReactNode;
}

export function AppTourProvider({ children }: AppTourProviderProps) {
  return (
    <>
      {children}
      <TourManager />
      <GuideHost />
    </>
  );
}
