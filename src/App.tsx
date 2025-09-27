import './App.css';
import Table from './Table';
import ErrorBoundary from './ErrorBoundary';
import { Suspense } from 'react';

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div>Loading...</div>}>
        <div className="App">
          <h1>Number Matching Game</h1>
          <Table />
        </div>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
