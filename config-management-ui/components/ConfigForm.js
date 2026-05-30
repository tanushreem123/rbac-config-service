import React, { useState } from 'react';
import { createConfig } from '../lib/ConfigService';
import { updateConfig } from '../lib/ConfigService';
const ConfigForm = ({ env, onSave, onCancel, initialConfig }) => {
  const [key, setKey] = useState(initialConfig?.key || '');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!key || !value) {
      setError('Key and value are required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await createConfig({ environment: env, key, value });
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '4px', marginTop: '20px' }}>
      <h3 style={{ marginTop: 0 }}>{initialConfig ? 'Update Config' : 'Create Config'}</h3>
      <div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
            Config Key
          </label>
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={!!initialConfig}
            placeholder="e.g., feature.newDashboard"
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontFamily: 'monospace', background: initialConfig ? '#eee' : 'white' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
            Value {initialConfig && <span style={{ color: '#666', fontWeight: 'normal' }}>(creates new version)</span>}
          </label>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g., true"
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontFamily: 'monospace' }}
          />
        </div>
        {error && <div style={{ color: '#d32f2f', marginBottom: '15px' }}>{error}</div>}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onCancel}
            style={{ padding: '10px 20px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
export default ConfigForm;