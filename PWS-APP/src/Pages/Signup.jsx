import { useState, useEffect } from 'react';
import './Signup.css';

const Signup = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    const checkAuthStatus = () => {
      try {
        const storedUser = localStorage.getItem('user');
        const storedIsLoggedIn = localStorage.getItem('isLoggedIn');
        
        if (storedUser && storedIsLoggedIn === 'true') {
          const parsedUser = JSON.parse(storedUser);
          setCurrentUser(parsedUser);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('wishlist');
      }
    };

    checkAuthStatus();
  }, []);

  const API_BASE_URL = 'http://localhost:3000';

  const handleRegisterInputChange = (e) => {
    const { name, value } = e.target;
    setRegisterData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    // Client-side validation
    if (registerData.password.length < 8) {
      setMessage('Password must be at least 8 characters long');
      setIsLoading(false);
      return;
    }

    if (!registerData.email.includes('@')) {
      setMessage('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    if (registerData.password !== registerData.confirmPassword) {
      setMessage('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (!registerData.name.trim()) {
      setMessage('Name is required');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: registerData.name,
          email: registerData.email,
          password: registerData.password,
          confirmPassword: registerData.confirmPassword
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Registration successful! Redirecting to login...');
        setRegisterData({ name: '', email: '', password: '', confirmPassword: '' });
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        setMessage(data.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setMessage('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipToHome = () => {
    if (isAuthenticated && currentUser) {
      window.location.href = '/ProtectedRoutez';
    } else {
      alert('You must be logged in to access this page.');
    }
  };

  const goToLogin = () => {
    window.location.href = '/';
  };

  return (
    <div className="signup-body">
      <div className="signup-container">
        {message && (
          <div className={`message ${message.includes('successful') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        <div className="signup-form-box">
          <div className="form-container">
            <h1>Sign Up</h1>
            <form onSubmit={handleRegister}>
              <div className="input-box">
                <input 
                  type="text" 
                  name="name"
                  placeholder="Full Name" 
                  value={registerData.name}
                  onChange={handleRegisterInputChange}
                  disabled={isLoading}
                  required 
                />
                <i className='bx bxs-user'></i>
              </div>
              <div className="input-box">
                <input 
                  type="email" 
                  name="email"
                  placeholder="Email" 
                  value={registerData.email}
                  onChange={handleRegisterInputChange}
                  disabled={isLoading}
                  required 
                />
                <i className='bx bxs-envelope'></i>
              </div>
              <div className="input-box">
                <input 
                  type="password" 
                  name="password"
                  placeholder="Password (min 8 characters)" 
                  value={registerData.password}
                  onChange={handleRegisterInputChange}
                  disabled={isLoading}
                  required 
                />
                <i className='bx bxs-lock-alt'></i>
              </div>
              <div className="input-box">
                <input 
                  type="password" 
                  name="confirmPassword"
                  placeholder="Confirm Password" 
                  value={registerData.confirmPassword}
                  onChange={handleRegisterInputChange}
                  disabled={isLoading}
                  required 
                />
                <i className='bx bxs-lock-alt'></i>
              </div>
              <button 
                type="submit"
                className="signup-btn"
                disabled={isLoading}
              >
                {isLoading ? 'Registering...' : 'Sign Up'}
              </button>
            </form>
            
            <div className="auth-links">
              <p>Already have an account? <button onClick={goToLogin} className="link-btn">Login</button></p>
              <button onClick={handleSkipToHome} className="skip-btn">
                Skip to Home
              </button>
            </div>
            
            <p className="social-text">or register with social platforms</p>
            <div className="social-icons">
              <a href="#"><i className='bx bxl-google'></i></a>
              <a href="#"><i className='bx bxl-facebook'></i></a>
              <a href="#"><i className='bx bxl-github'></i></a>
              <a href="#"><i className='bx bxl-linkedin'></i></a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;