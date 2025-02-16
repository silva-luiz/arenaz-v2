import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LoginPage from '../src/components/Login/LoginPage.jsx'
import RegisterPage from '../src/components/Register/RegisterPage.jsx'
import ProfilePage from './components/Profile/ProfilePage.jsx'
import EstablishmentProfilePage from './components/Profile/EstablishmentProfilePage.jsx'
import HomePage from './components/Home/HomePage.jsx'
import ReservationsPage from './components/Reservations/ReservationsPage.jsx'


// React-Router import
import { createBrowserRouter, RouterProvider, Route, Navigate } from 'react-router-dom';
import ErrorPage from './components/error/ErrorPage.jsx';
import DashboardPage from './components/Dashboard/DashboardPage.jsx'
import ArenaRegisterForm from './components/Register/ArenaRegisterForm.jsx'
import CreateReservationPage from './components/Reservations/CreateReservationPage.jsx'

const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <App />,
      errorElement: <ErrorPage />
    },
    {
      path: "login",
      element: <LoginPage />
    },
    {
      path: "register",
      element: <RegisterPage />
    },
    {
      path: "home",
      element: <HomePage />,
      children: [
        {
          index: true,
          element: <Navigate to="dashboard" />
        },
        {
          path: "dashboard",
          element: <DashboardPage />
        },
        {
          path: "reservations",
          element: <ReservationsPage />
        },
        {
          path: "establishment-info",
          element: <EstablishmentProfilePage />
        },
        {
          path: "new-arena",
          element: <ArenaRegisterForm />
        },
        {
          path: "profile",
          element: <ProfilePage />
        }
      ]
    },
    {
      path: "reservations/:id",
      element: <HomePage />, // Renderiza HomePage para manter o layout
      children: [
        {
          index: true,
          element: <CreateReservationPage /> // Renderiza CreateReservationPage no Outlet
        }
      ]
    }
  ]
);


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
