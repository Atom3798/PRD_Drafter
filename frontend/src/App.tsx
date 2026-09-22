import { Navigate, Route, Routes } from 'react-router-dom'

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
 * AuthGuard lands in Phase 3; until then the protected routes are reachable
 * directly, which is fine locally and is the next thing to change.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/prds/new" element={<Wizard />} />
      <Route path="/prds/:id/edit" element={<Wizard />} />
      <Route path="/prds/:id" element={<Editor />} />
      <Route path="/settings" element={<Settings />} />

      <Route path="/index.html" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
