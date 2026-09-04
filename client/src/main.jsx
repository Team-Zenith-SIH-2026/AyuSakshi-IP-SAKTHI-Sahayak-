import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[AyuSakshi UI Crash Caught by ErrorBoundary]:', error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.removeItem('ayusakshi_user');
      localStorage.removeItem('ayusakshi_token');
    } catch (e) {}
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#060d10',
          color: '#f1f5f9',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: '24px',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '480px',
            backgroundColor: '#0e181e',
            border: '1px solid #1b2c34',
            borderRadius: '16px',
            padding: '32px 24px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              display: 'inline-block',
              padding: '8px 16px',
              borderRadius: '10px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              fontWeight: 'bold',
              fontSize: '14px',
              marginBottom: '16px'
            }}>
              AyuSakshi Recover
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px', color: '#ffffff' }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.6', marginBottom: '24px' }}>
              {this.state.error?.message || 'A client-side initialization issue occurred.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 18px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Reload Application
              </button>
              <button
                onClick={this.handleReset}
                style={{
                  backgroundColor: 'transparent',
                  color: '#cbd5e1',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '10px 18px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Reset Session & Clear Cache
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
