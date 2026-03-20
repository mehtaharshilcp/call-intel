import { NavLink, Outlet, Route, Routes } from 'react-router-dom'
import { CallsPage } from './pages/CallsPage'
import { CallDetailPage } from './pages/CallDetailPage'
import { MainDashboard } from './pages/MainDashboard'

function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Call Intelligence</div>
        <NavLink to="/" end className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          Dashboard
        </NavLink>
        <NavLink
          to="/calls"
          className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
        >
          Calls
        </NavLink>
      </aside>
      <main>
        <Outlet />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<MainDashboard />} />
        <Route path="calls" element={<CallsPage />} />
        <Route path="calls/:id" element={<CallDetailPage />} />
      </Route>
    </Routes>
  )
}
