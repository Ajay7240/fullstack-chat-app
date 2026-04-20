import React from 'react'
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import SignUpPage from './pages/SignUpPage'
import LoginPage from './pages/LoginPage'
import SettingsPage from './pages/SettingsPage'
import ProfilePage from './pages/ProfilePage'

import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/useAuthStore'
import { useEffect, useRef } from 'react'
import { Loader } from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import { useThemeStore } from './store/useThemeStore'
import { useChatStore } from './store/useChatStore'

const App = () => {
  const { authUser, checkAuth, isCheckingAuth } = useAuthStore();
  const { theme } = useThemeStore();
  const resetChat = useChatStore((state) => state.resetChat);
  const restoreSelectedUser = useChatStore((state) => state.restoreSelectedUser);
  const previousUserIdRef = useRef(null);
  const wasCheckingAuthRef = useRef(true);

  useEffect(() => {
    checkAuth()
  }, [checkAuth]);

  // DaisyUI themes are reliably applied when `data-theme` is on <html>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const currentUserId = authUser?._id || null;
    const previousUserId = previousUserIdRef.current;

    if(previousUserId === currentUserId){
      if(!isCheckingAuth) wasCheckingAuthRef.current = false;
      return;
    }

    if(previousUserId && !currentUserId){
      resetChat({ clearPersisted: true, userId: previousUserId });
    } else if(previousUserId && currentUserId && previousUserId !== currentUserId){
      resetChat({ clearPersisted: true, userId: previousUserId });
      resetChat({ clearPersisted: true, userId: currentUserId });
    } else if(!previousUserId && currentUserId){
      if(wasCheckingAuthRef.current){
        restoreSelectedUser(currentUserId);
      } else {
        resetChat({ clearPersisted: true, userId: currentUserId });
      }
    }

    previousUserIdRef.current = currentUserId;
    if(!isCheckingAuth) wasCheckingAuthRef.current = false;
  }, [authUser?._id, isCheckingAuth, resetChat, restoreSelectedUser]);

  if (isCheckingAuth && !authUser) return (
    <div className='flex items-center justify-center h-screen'>
      <Loader className='size-10 animate-spin' />
    </div>
  )
  return (
    <div data-theme={theme}>
      <Navbar />

      <Routes>
        <Route path='/' element={authUser ? <HomePage /> : <Navigate to='/login' />} />
        <Route path='/signup' element={!authUser ? <SignUpPage /> : <Navigate to='/' />} />
        <Route path='/login' element={!authUser ? <LoginPage /> : <Navigate to='/' />} />
        <Route path='/settings' element={<SettingsPage />} />
        <Route path='/profile' element={authUser ? <ProfilePage /> : <Navigate to='/login' />} />
      </Routes>
      <Toaster />
    </div>
  )
}

export default App
