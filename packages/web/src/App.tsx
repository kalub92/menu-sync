import { useEffect, useState } from 'react';

export function App() {
  const [health, setHealth] = useState<{ status: string; timestamp: string } | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 600, margin: '4rem auto' }}>
      <h1>Menu Sync Platform</h1>
      <p>Synchronize your restaurant menus across delivery platforms.</p>
      {health ? (
        <p style={{ color: 'green' }}>API connected: {health.status}</p>
      ) : (
        <p style={{ color: 'gray' }}>API not connected. Start the API server to connect.</p>
      )}
    </div>
  );
}
