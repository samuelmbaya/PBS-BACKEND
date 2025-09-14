import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import LoginSignupForm from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LoginSignupForm />
  </StrictMode>,
)
if (localStorage.getItem('userData')) {
  const userData = JSON.parse(localStorage.getItem('userData'));
  if (userData.isLoggedIn) {
    window.location.href = '/ProductPage';
  }
}