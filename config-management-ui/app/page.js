'use client';
import React, { useState, useEffect } from 'react';
import ConfigList from '../components/ConfigList';
import ConfigDetails from '../components/ConfigDetails';
import ConfigForm from '../components/ConfigForm';
import TokenInput from '../components/TokenInput';
import { getAdminToken } from '../utils/tokenStorage.js';
import { fetchConfigs, createConfig, rollbackConfig } from '../lib/ConfigService';
export default function ConfigAdminApp() {
  const [env, setEnv] = useState('dev');
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('list');
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [token, setToken] = useState('');

  useEffect(() => {
    setToken(getAdminToken());
  }, []);

  useEffect(() => {
    loadConfigs();
  }, [env]);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const data = await fetchConfigs(env);
      setConfigs(data.configs);
    } catch (err) {
      console.error('Error loading configs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConfig = (config) => {
    setSelectedConfig(config);
    setView('details');
  };

  const handleCreateNew = () => {
    setSelectedConfig(null);
    setView('form');
  };

  const handleUpdateConfig = (config) => {
    setSelectedConfig(config);
    setView('form');
  };

  const handleSave = () => {
    setView('list');
    setSelectedConfig(null);
    loadConfigs();
  };

  const handleRefreshDetails = () => {
    loadConfigs();
    if (selectedConfig) {
      const updated = configs.find(c => c.key === selectedConfig.key);
      if (updated) {
        setSelectedConfig(updated);
      }
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* <h1 style={{ marginBottom: '10px' }}>Config Management - Admin UI</h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>Control-plane interface for managing configuration and feature toggles</p>

      <TokenInput token={token} onTokenChange={setToken} /> */}

      {view === 'list' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <label style={{ fontWeight: '600' }}>Environment:</label>
              <select
                value={env}
                onChange={(e) => setEnv(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
              >
                <option value="dev">Development</option>
                <option value="stage">Staging</option>
                <option value="prod">Production</option>
              </select>
            </div>
            <button
              onClick={handleCreateNew}
              style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
            >
              + Create Config
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Loading configs...</div>
          ) : (
            <ConfigList
              env={env}
              configs={configs}
              onSelectConfig={handleSelectConfig}
              onRefresh={loadConfigs}
            />
          )}
        </>
      )}

      {view === 'form' && (
        <ConfigForm
          env={env}
          initialConfig={selectedConfig}
          onSave={handleSave}
          onCancel={() => {
            setView('list');
            setSelectedConfig(null);
          }}
        />
      )}

      {view === 'details' && selectedConfig && (
        <>
          <div style={{ marginBottom: '20px' }}>
            <button
              onClick={() => handleUpdateConfig(selectedConfig)}
              style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
            >
              Update Config
            </button>
          </div>
          <ConfigDetails
            env={env}
            config={selectedConfig}
            onBack={() => {
              setView('list');
              setSelectedConfig(null);
            }}
            onRefresh={handleRefreshDetails}
          />
        </>
      )}
    </div>
  );
}
