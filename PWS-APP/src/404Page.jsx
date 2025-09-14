import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div style={styles.container}>
      <h1 style={styles.text}>404 – Not Found</h1>
      <Link to="/" style={styles.button} className="hover-button">
        Go to Homepage
      </Link>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: '#000',
    color: '#fff',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: 'bold',
    fontSize: '2.5rem',
    textAlign: 'center',
    marginBottom: '20px',
  },
  button: {
    border: '2px solid #fff',
    padding: '10px 20px',
    color: '#fff',
    backgroundColor: 'transparent',
    textDecoration: 'none',
    fontWeight: 'bold',
    transition: 'all 0.3s ease',
  },

  buttonHover: {
    backgroundColor: '#fff',
    color: '#000',
  },
};

export default NotFound;
