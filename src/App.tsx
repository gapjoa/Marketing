import React from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import MarketingMap from './components/MarketingMap';

export default function App() {
  return (
    <ReactFlowProvider>
      <MarketingMap />
    </ReactFlowProvider>
  );
}
