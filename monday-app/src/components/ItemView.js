import React, { useState } from 'react';

const ItemView = ({ context, settings, monday }) => {
  const [formData, setFormData] = useState({
    projectType: 'residential',
    squareFootage: '',
    complexityLevel: 'standard',
    location: 'suburban'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    alert('ElectricalAI Pro estimation would process here!');
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>⚡ ElectricalAI Pro Estimator</h1>
      
      <form onSubmit={handleSubmit} style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px' }}>
        <h2>📋 Project Information</h2>
        
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="projectType" style={{ display: 'block', marginBottom: '5px' }}>
            Project Type:
          </label>
          <select
            id="projectType"
            name="projectType"
            value={formData.projectType}
            onChange={handleChange}
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          >
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="industrial">Industrial</option>
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="squareFootage" style={{ display: 'block', marginBottom: '5px' }}>
            Square Footage:
          </label>
          <input
            id="squareFootage"
            name="squareFootage"
            type="number"
            value={formData.squareFootage}
            onChange={handleChange}
            placeholder="e.g., 2500"
            min="100"
            max="50000"
            required
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="complexityLevel" style={{ display: 'block', marginBottom: '5px' }}>
            Complexity Level:
          </label>
          <select
            id="complexityLevel"
            name="complexityLevel"
            value={formData.complexityLevel}
            onChange={handleChange}
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          >
            <option value="simple">Simple</option>
            <option value="standard">Standard</option>
            <option value="complex">Complex</option>
            <option value="high-end">High-End</option>
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="location" style={{ display: 'block', marginBottom: '5px' }}>
            Location Type:
          </label>
          <select
            id="location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          >
            <option value="urban">Urban</option>
            <option value="suburban">Suburban</option>
            <option value="rural">Rural</option>
          </select>
        </div>

        <button
          type="submit"
          style={{
            backgroundColor: '#0073ea',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: 'pointer',
            width: '100%'
          }}
        >
          Generate Estimate
        </button>
      </form>

      <div style={{ marginTop: '20px', background: '#e8f4fd', padding: '15px', borderRadius: '8px' }}>
        <h3>📊 Current Configuration:</h3>
        <ul>
          <li><strong>Monday Context:</strong> {context?.itemId || 'Not available'}</li>
          <li><strong>Project Type:</strong> {formData.projectType}</li>
          <li><strong>Square Footage:</strong> {formData.squareFootage || 'Not set'}</li>
          <li><strong>Complexity:</strong> {formData.complexityLevel}</li>
          <li><strong>Location:</strong> {formData.location}</li>
        </ul>
      </div>

      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        <p>
          <strong>Note:</strong> This is a demonstration version of ElectricalAI Pro. 
          In production, this would connect to N8N workflows for AI-powered estimation, 
          NEC compliance checking, and real-time material cost tracking.
        </p>
      </div>
    </div>
  );
};

export default ItemView;