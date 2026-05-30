 import React, { useState } from 'react';
import { setAdminToken } from '../utils/tokenStorage.js';
 const TokenInput = ({ token, onTokenChange }) => {
  const [inputValue, setInputValue] = useState(token);

  const handleSave = () => {
    setAdminToken(inputValue);
    onTokenChange(inputValue);
  };

  return (
    <div style={{ marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '4px' }}>
      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
        Admin Token
      </label>
      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          type="password"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter admin token"
          style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
        />
        <button onClick={handleSave} style={{ padding: '8px 16px', background: '#333', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Save Token
        </button>
      </div>
    </div>
  );
};

export default TokenInput;