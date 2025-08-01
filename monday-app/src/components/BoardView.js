import React from 'react';

const BoardView = ({ context, settings, monday }) => {
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>📊 Estimation Dashboard</h1>
      
      <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <h2>Board Overview</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div style={{ background: 'white', padding: '15px', borderRadius: '4px', textAlign: 'center' }}>
            <h3>Total Projects</h3>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0073ea' }}>12</div>
          </div>
          <div style={{ background: 'white', padding: '15px', borderRadius: '4px', textAlign: 'center' }}>
            <h3>Estimated</h3>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#00c875' }}>8</div>
          </div>
          <div style={{ background: 'white', padding: '15px', borderRadius: '4px', textAlign: 'center' }}>
            <h3>Total Value</h3>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fdab3d' }}>$342,750</div>
          </div>
          <div style={{ background: 'white', padding: '15px', borderRadius: '4px', textAlign: 'center' }}>
            <h3>Avg. Timeline</h3>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#a25ddc' }}>2.3 days</div>
          </div>
        </div>
      </div>

      <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <h2>Recent Projects</h2>
        <div style={{ background: 'white', borderRadius: '4px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#e1e5e9' }}>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Project</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Cost</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Updated</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>Residential Rewiring - Smith House</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                  <span style={{ background: '#00c875', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '12px' }}>
                    Estimated
                  </span>
                </td>
                <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>$18,500</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>2 hours ago</td>
              </tr>
              <tr>
                <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>Commercial Office - Tech Startup</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                  <span style={{ background: '#fdab3d', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '12px' }}>
                    In Progress
                  </span>
                </td>
                <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>$45,200</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>1 day ago</td>
              </tr>
              <tr>
                <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>Industrial Warehouse - Manufacturing</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                  <span style={{ background: '#0073ea', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '12px' }}>
                    New Project
                  </span>
                </td>
                <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>—</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>3 days ago</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ background: '#e8f4fd', padding: '15px', borderRadius: '8px' }}>
        <h3>🚀 Batch Processing</h3>
        <p>Select multiple projects and generate estimates simultaneously for improved efficiency.</p>
        <button
          style={{
            backgroundColor: '#0073ea',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '10px'
          }}
          onClick={() => alert('Batch processing would start here!')}
        >
          Process Selected Projects
        </button>
      </div>

      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        <p>
          <strong>Board ID:</strong> {context?.boardId || 'Not available'} | 
          <strong> User ID:</strong> {context?.userId || 'Not available'}
        </p>
      </div>
    </div>
  );
};

export default BoardView;