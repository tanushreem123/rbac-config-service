
const ConfigList = ({ env, configs, onSelectConfig, onRefresh }) => {
  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
        <thead>
          <tr style={{ background: '#f9f9f9', borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Config Key</th>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Active Value</th>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Active Version</th>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {configs?.length === 0 ? (
            <tr>
              <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                No configs found for {env}
              </td>
            </tr>
          ) : (
            configs.map((config) => (
              <tr key={config.key} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px', fontFamily: 'monospace' }}>{config.key}</td>
                <td style={{ padding: '12px', fontFamily: 'monospace' }}>{config.value}</td>
                <td style={{ padding: '12px' }}>v{config.version}</td>
                <td style={{ padding: '12px' }}>
                  <button
                    onClick={() => onSelectConfig(config)}
                    style={{ padding: '6px 12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
export default ConfigList;