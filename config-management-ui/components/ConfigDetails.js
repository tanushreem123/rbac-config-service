'use client';
import React, { useState, useEffect } from 'react';
import { fetchConfigVersions, rollbackConfig } from '@/lib/ConfigService';

const ConfigDetails = ({ env, config, onBack, onRefresh }) => {
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState('');
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(true);

  useEffect(() => {
    loadVersionHistory();
  }, [config.key, env]);

  const loadVersionHistory = async () => {
    try {
      setLoadingVersions(true);
      setError('');
      const data = await fetchConfigVersions(config.key, env);
      setVersions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleRollback = async (targetVersion) => {
    if (!window.confirm(`Rollback ${config.key} to version ${targetVersion}?`)) return;

    setRolling(true);
    setError('');
    try {
      await rollbackConfig({ key: config.key, environment: env, targetVersion });
      await loadVersionHistory();
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
          <strong>Active Version:</strong> <span>v{config.active_version}</span>
          <strong>Active Value:</strong> <span>{JSON.stringify(config.value)}</span>
        </div>
      </div>

      {error && (
        <div style={{ color: '#c62828', marginBottom: '15px', padding: '10px', background: '#ffebee', borderRadius: '4px' }}>
          {error}
        </div>
      )}

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
            {versions.length > 0 ? (
              versions.map((v) => {
                const isActive = v.version === config.active_version;
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
                          {rolling ? 'Rolling back...' : 'Rollback'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
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
