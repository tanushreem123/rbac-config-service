import React, { useState, useEffect } from 'react';
import { rollbackConfig } from '@/lib/ConfigService';
const ConfigDetails = ({ env, config, onBack, onRefresh }) => {
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState('');
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(true);

  useEffect(() => {
    fetchVersionHistory();
  }, [config.key, env]);

  const fetchVersionHistory = async () => {
    try {
      setLoadingVersions(true);
      const baseUrl = process.env.NEXT_PUBLIC_CONFIG_SERVICE_BASE_URL;
      const response = await fetch(`${baseUrl}/configs/${config.key}/versions/?env=${env}`);
      if (!response.ok) {
        throw new Error('Failed to fetch version history');
      }
      const data = await response.json();
      setVersions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching versions:', err);
      setError(err.message);
    } finally {
      setLoadingVersions(false);
    }
  };
  const handleRollback = async (version) => {
    if (!window.confirm(`Rollback ${config.key} to version ${version}? This will change the active config.`)) {
      return;
    }

    setRolling(true);
    setError('');
    try {
      await rollbackConfig(env, config.key, version);
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setRolling(false);
    }
  };

  return (
    <div>
      <button
        onClick={onBack}
        style={{ padding: '8px 16px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '20px' }}
      >
        ← Back to List
      </button>

      <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '4px', marginBottom: '20px' }}>
        <h3 style={{ marginTop: 0 }}>Config: {config.key}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '10px', fontFamily: 'monospace' }}>
          <strong>Environment:</strong> <span>{env}</span>
          <strong>Active Version:</strong> <span>v{config.version}</span>
          <strong>Active Value:</strong> <span>{config.value}</span>
        </div>
      </div>

      {error && <div style={{ color: '#d32f2f', marginBottom: '15px', padding: '10px', background: '#ffebee', borderRadius: '4px' }}>{error}</div>}

      <h4>Version History</h4>
      {loadingVersions ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Loading version history...</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9f9f9', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Version</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Value</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Created At</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Created By</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {versions && Array.isArray(versions) && versions.length > 0 ? (
              [...versions].reverse().map((v) => {
                const isActive = v.version === config.version;
                return (
                  <tr key={v.version} style={{ borderBottom: '1px solid #eee', background: isActive ? '#e3f2fd' : 'white' }}>
                    <td style={{ padding: '12px' }}>
                      v{v.version} {isActive && <span style={{ color: '#1976d2', fontWeight: '600' }}>(active)</span>}
                    </td>
                    <td style={{ padding: '12px', fontFamily: 'monospace' }}>{JSON.stringify(v.value)}</td>
                    <td style={{ padding: '12px', fontSize: '14px' }}>{new Date(v.createdAt).toLocaleString()}</td>
                    <td style={{ padding: '12px', fontSize: '14px' }}>{v.createdBy}</td>
                    <td style={{ padding: '12px' }}>
                      {!isActive && (
                        <button
                          onClick={() => handleRollback(v.version)}
                          disabled={rolling}
                          style={{ padding: '6px 12px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: rolling ? 'not-allowed' : 'pointer', fontSize: '14px', opacity: rolling ? 0.6 : 1 }}
                        >
                          Rollback
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="5" style={{ padding: '12px', textAlign: 'center', color: '#666' }}>
                  No version history available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};
export default ConfigDetails;