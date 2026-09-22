import { Navigate, Route, Routes } from 'react-router-dom'

import { AuthGuard, GuestOnly } from '@/components/layout/AuthGuard'
import Dashboard from '@/pages/Dashboard'
import Editor from '@/pages/Editor'
import Landing from '@/pages/Landing'
import Login from '@/pages/Login'
import NotFound from '@/pages/NotFound'
import Settings from '@/pages/Settings'
import Signup from '@/pages/Signup'
import Wizard from '@/pages/Wizard'

/**
 * Route table.
 *
 * Protected routes sit behind <AuthGuard>, which preserves the intended
 * destination so signing in returns you where you were headed. Login and
 * signup sit behind <GuestOnly> so an already-signed-in user does not land
 * on a form they do not need.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route element={<GuestOnly />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Route>

      <Route element={<AuthGuard />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/prds/new" element={<Wizard />} />
        <Route path="/prds/:id/edit" element={<Wizard />} />
        <Route path="/prds/:id" element={<Editor />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="/index.html" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
