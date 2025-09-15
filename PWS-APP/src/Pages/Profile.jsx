import React, { createContext, useContext, useState, useEffect } from 'react';
import './Profile.css';

// Create User Context
const UserContext = createContext();

// User Provider Component
export const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [theme, setTheme] = useState("dark"); // default theme

  useEffect(() => {
    const checkAuthStatus = () => {
      try {
        const storedUser = localStorage.getItem('user');
        const storedIsLoggedIn = localStorage.getItem('isLoggedIn');
        
        if (storedUser && storedIsLoggedIn === 'true') {
          const parsedUser = JSON.parse(storedUser);
          setCurrentUser(parsedUser);
          setIsAuthenticated(true);
          
          // Load user's preferred theme
          const userTheme = localStorage.getItem(`darkMode_${parsedUser.email}`);
          if (userTheme !== null) {
            const isDarkMode = JSON.parse(userTheme);
            setTheme(isDarkMode ? "dark" : "light");
          } else if (parsedUser.theme) {
            setTheme(parsedUser.theme);
          }
        } else {
          setCurrentUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('wishlist');
        setCurrentUser(null);
        setIsAuthenticated(false);
        setTheme("dark");
      }
    };

    checkAuthStatus();
  }, []);

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('isLoggedIn');
    setCurrentUser(null);
    setIsAuthenticated(false);
    setTheme("dark");
  };

  const updateUser = (updatedUserData) => {
    try {
      const updatedUser = { ...currentUser, ...updatedUserData };
      setCurrentUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return { success: true };
    } catch (error) {
      console.error('Error updating user data:', error);
      return { success: false, error: error.message };
    }
  };

  return (
    <UserContext.Provider value={{ currentUser, isAuthenticated, logout, theme, updateUser }}>
      {children}
    </UserContext.Provider>
  );
};

// Custom hook
const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
};

// Profile Component
const Profile = () => {
  const { currentUser, logout, theme, updateUser } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    bio: ''
  });
  const [errors, setErrors] = useState({});
  const [saveStatus, setSaveStatus] = useState(null);

  // Initialize form data when currentUser changes
  useEffect(() => {
    if (currentUser) {
      setFormData({
        name: currentUser.name || '',
        email: currentUser.email || '',
        phone: currentUser.phone || '',
        bio: currentUser.bio || ''
      });
    }
  }, [currentUser]);

  const handleLogout = () => {
    logout();
    window.location.href = '/Home';
  };

  const handleBackToProducts = () => {
    window.location.href = '/ProductPage';
  };

  const getDisplayName = () => {
    if (!currentUser) return "User";
    if (currentUser.name) return currentUser.name;
    if (currentUser.email) return currentUser.email.split('@')[0];
    return "User";
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (formData.phone && !/^[\d\s\-\+\(\)]+$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }
    
    if (formData.bio && formData.bio.length > 500) {
      newErrors.bio = 'Bio must be less than 500 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setSaveStatus(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setErrors({});
    setSaveStatus(null);
    // Reset form data to current user data
    if (currentUser) {
      setFormData({
        name: currentUser.name || '',
        email: currentUser.email || '',
        phone: currentUser.phone || '',
        bio: currentUser.bio || ''
      });
    }
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    const result = updateUser(formData);
    
    if (result.success) {
      setIsEditing(false);
      setSaveStatus({ type: 'success', message: 'Profile updated successfully!' });
      setTimeout(() => setSaveStatus(null), 3000);
    } else {
      setSaveStatus({ type: 'error', message: 'Failed to update profile. Please try again.' });
    }
  };

  return (
    <div className={`profile-container ${theme}-theme`}>
      {/* Header */}
      <div className="profile-header">
        <button className="back-to-products-btn" onClick={handleBackToProducts}>
          Back to Products
        </button>
        <span className="profile-title">PROFILE</span>
      </div>

      {/* Main Content */}
      <div className="profile-content">
        <div className="greeting">
          HI, {getDisplayName().toUpperCase()}
        </div>

        {/* Save Status Message */}
        {saveStatus && (
          <div className={`status-message ${saveStatus.type}`}>
            {saveStatus.message}
          </div>
        )}

        {/* Profile Information */}
        <div className="user-info-section">
          <div className="section-header">
            <h3>Profile Information</h3>
            {!isEditing && (
              <button className="edit-button" onClick={handleEdit}>
                Edit Profile
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="edit-form">
              <div className="form-group">
                <label htmlFor="name">Full Name *</label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={errors.name ? 'error' : ''}
                  placeholder="Enter your full name"
                />
                {errors.name && <span className="error-message">{errors.name}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address *</label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={errors.email ? 'error' : ''}
                  placeholder="Enter your email address"
                />
                {errors.email && <span className="error-message">{errors.email}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input
                  type="tel"
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className={errors.phone ? 'error' : ''}
                  placeholder="Enter your phone number (optional)"
                />
                {errors.phone && <span className="error-message">{errors.phone}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  className={errors.bio ? 'error' : ''}
                  placeholder="Tell us about yourself (optional)"
                  rows="4"
                  maxLength="500"
                />
                <div className="char-count">
                  {formData.bio.length}/500 characters
                </div>
                {errors.bio && <span className="error-message">{errors.bio}</span>}
              </div>

              <div className="form-actions">
                <button className="save-button" onClick={handleSave}>
                  Save Changes
                </button>
                <button className="cancel-button" onClick={handleCancel}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="user-info-display">
              <div className="info-item">
                <strong>Name:</strong> 
                <span>{currentUser?.name || 'Not provided'}</span>
              </div>
              <div className="info-item">
                <strong>Email:</strong> 
                <span>{currentUser?.email || 'Not provided'}</span>
              </div>
              <div className="info-item">
                <strong>Phone:</strong> 
                <span>{currentUser?.phone || 'Not provided'}</span>
              </div>
              <div className="info-item">
                <strong>Bio:</strong> 
                <span>{currentUser?.bio || 'Not provided'}</span>
              </div>
            </div>
          )}
        </div>

        <button className="logout-button" onClick={handleLogout}>
          LOG OUT
        </button>
      </div>
    </div>
  );
};

const App = () => (
  <UserProvider>
    <Profile />
  </UserProvider>
);

export default App;
