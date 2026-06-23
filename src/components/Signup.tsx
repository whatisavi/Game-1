import React, { useState, useEffect } from 'react'

export default function Signup() {
  const [isSignUp, setIsSignUp] = useState(false) // toggle between Sign In and Sign Up
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)
  
  // Authenticated user state
  const [user, setUser] = useState<{ username: string; email: string } | null>(null)

  // Load user session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('auth_user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (e) {
        localStorage.removeItem('auth_user')
      }
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setLoading(true)

    const endpoint = isSignUp ? '/api/signup' : '/api/signin'
    const payload = isSignUp 
      ? { username, email, password }
      : { username: username, password } // backend signin accepts username (which acts as username or email)

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || `${isSignUp ? 'Signup' : 'Sign in'} failed`)
      }

      // Success
      if (isSignUp) {
        setMessage({ text: 'Account created successfully! Please sign in.', isError: false })
        setIsSignUp(false) // switch to login tab
        setPassword('')
      } else {
        const loggedInUser = { username: data.username, email: data.email }
        setUser(loggedInUser)
        localStorage.setItem('auth_user', JSON.stringify(loggedInUser))
        setMessage({ text: `Welcome back, ${data.username}!`, isError: false })
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'An unexpected error occurred', isError: true })
    } finally {
      setLoading(false)
    }
  }

  function handleSignOut() {
    setUser(null)
    localStorage.removeItem('auth_user')
    setMessage(null)
    setUsername('')
    setEmail('')
    setPassword('')
  }

  if (user) {
    return (
      <div className="auth-card logged-in">
        <div className="avatar-badge">
          {user.username.slice(0, 2).toUpperCase()}
        </div>
        <h3>Welcome, {user.username}!</h3>
        <p className="user-email">{user.email}</p>
        <div className="status-badge success">Active Session</div>
        <button onClick={handleSignOut} className="sign-out-btn">
          Sign Out
        </button>
      </div>
    )
  }

  return (
    <div className="auth-card">
      <div className="auth-tabs">
        <button 
          type="button" 
          className={`tab-btn ${!isSignUp ? 'active' : ''}`}
          onClick={() => { setIsSignUp(false); setMessage(null); }}
        >
          Sign In
        </button>
        <button 
          type="button" 
          className={`tab-btn ${isSignUp ? 'active' : ''}`}
          onClick={() => { setIsSignUp(true); setMessage(null); }}
        >
          Sign Up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label htmlFor="auth-username">{isSignUp ? 'Username' : 'Username or Email'}</label>
          <input 
            id="auth-username"
            placeholder={isSignUp ? 'Enter username' : 'Enter username or email'} 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            required
            disabled={loading}
            autoComplete="username"
          />
        </div>

        {isSignUp && (
          <div className="form-group animate-slide">
            <label htmlFor="auth-email">Email Address</label>
            <input 
              id="auth-email"
              type="email"
              placeholder="Enter your email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required={isSignUp}
              disabled={loading}
              autoComplete="email"
            />
          </div>
        )}

        <div className="form-group">
          <label htmlFor="auth-password">Password</label>
          <input 
            id="auth-password"
            type="password" 
            placeholder="Enter password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required
            disabled={loading}
            autoComplete="current-password"
          />
        </div>

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? (
            <span className="spinner-container">
              <span className="spinner"></span>
              {isSignUp ? 'Creating...' : 'Signing in...'}
            </span>
          ) : (
            isSignUp ? 'Create Account' : 'Sign In'
          )}
        </button>
      </form>

      {message && (
        <div className={`message-alert ${message.isError ? 'error' : 'success'}`}>
          {message.text}
        </div>
      )}
    </div>
  )
}
