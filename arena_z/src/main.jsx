import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import LoginPage from '../src/components/Login/LoginPage.jsx'
import RegisterPage from '../src/components/Register/RegisterPage.jsx'
import './index.css'

// React-Router import
import { createBrowserRouter, RouterProvider, Route } from 'react-router-dom';
import ErrorPage from './components/error/ErrorPage.jsx';

const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <App />,
      errorElement: <ErrorPage/>
    },
    {
      path: "login",
      element: <LoginPage/>
    },
    {
      path: "register",
      element: <RegisterPage/>
    }
  ]
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
