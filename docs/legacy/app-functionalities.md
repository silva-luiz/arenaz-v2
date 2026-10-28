# ArenaZ App Functionalities (Detailed)

This document describes the current functionalities implemented in the ArenaZ frontend application.

## 1. Public Landing Experience

### 1.1 Landing page (`/`)
- Shows the public homepage with:
  - A top navigation bar (brand, `Criar conta`, `Entrar`).
  - Two call-to-action banners with background images and button `Comece agora`.
  - Two platform description sections explaining value and operation.
- Main goal: convert visitors into registered users.

### 1.2 FAQ section
- There is a FAQ component with accordion behavior (`open/close` answer items).
- Includes questions about supported sports, reservation sources, and platform fees.
- Note: this component exists but is currently commented out in the root layout, so it is not rendered by default.

### 1.3 Footer
- Footer component exists with copyright text.
- Note: currently commented out in the root layout, so it is not rendered by default.

## 2. Authentication

### 2.1 Login page (`/login`)
- Login form with:
  - Email and password fields.
  - Optional “remember login” checkbox (UI only).
  - Link to registration page.
- Submits credentials to backend (`POST /api/login`).
- On success:
  - Stores `token` in `sessionStorage` under `auth-token`.
  - Redirects user to `home/dashboard`.

### 2.2 Session token behavior
- API client automatically attaches `Authorization: Bearer <token>` for authenticated requests.
- Token is read from `sessionStorage`.
- Logout helper exists in service (`authService.logout`) to remove token.

## 3. Registration Flow

### 3.1 Multi-step registration (`/register`)
- Two-step form process:
  - Step 1: User account data.
  - Step 2: Establishment data.
- Navigation controls:
  - `Avançar`, `Voltar`, `Finalizar`.

### 3.2 User data validations
- Email uniqueness check on blur using `POST /api/email-validation`.
- Password rules in input pattern:
  - Minimum 8 chars.
  - Must include uppercase, lowercase, number, and special char.
- Confirm password validation ensures equality.

### 3.3 Establishment data capture
- Collects:
  - Establishment name
  - Phone
  - ZIP code (CEP)
  - Address
  - City

### 3.4 Submission and feedback
- Executes user registration and establishment registration.
- Shows modal feedback for success or error.
- Success path offers navigation to `/login`.

## 4. Authenticated Area Structure

### 4.1 Home shell (`/home/*`)
- Uses a shared layout with sidebar navigation.
- Sidebar links include:
  - Início
  - Reservas ativas
  - Informações do estabelecimento
  - Perfil do usuário
  - Criar reserva (temporary/test link)

### 4.2 Navigation behavior
- Active link is highlighted based on current pathname.
- A logout confirmation modal exists in code (trigger UI currently commented in header section).

## 5. Dashboard

### 5.1 Dashboard page (`/home/dashboard`)
- Displays welcome area and user arenas section.
- Has action button `+ Nova arena` to open the arena creation page.
- Fetches dashboard data from backend (`GET /api/load-dashboard`) using auth token.

### 5.2 Arena listing
- Shows cards for each arena with:
  - Arena image
  - Name
  - Category
  - Hourly price
  - Link for creating reservation
- Handles states:
  - Loading
  - Error
  - Empty list (no arenas)

### 5.3 Reservation indicators
- Displays KPI-like summary blocks (`Total de reservas`, `Valor recebido`, `Valor a receber`) when arenas exist.
- If no arenas, shows no active reservations message.

## 6. Arena Management

### 6.1 New arena page (`/home/new-arena`)
- Form to create a new arena with:
  - Name
  - Price/hour
  - Category (Society, Beach Sports, Tênis, Outra)

### 6.2 Establishment binding
- Fetches establishment info (`GET /api/establishment/info/`) to retrieve `est_id`.
- Sends new arena payload with `est_id` and other fields to backend (`POST /api/arena`).

### 6.3 Feedback
- While request is processing, submit button changes to loading state (`Criando...`).
- Success/error modal is shown after submit.
- Success CTA redirects back to dashboard.

## 7. Reservations

### 7.1 Active reservations table page (`/reservations`)
- Renders reservations table with columns:
  - Arena
  - Category
  - Renter
  - Contact
  - Date
  - Time
  - Value
- Includes pagination UI.
- Current data source is local static mock data in component.

### 7.2 Reservation creation screen (component available)
- There is a `CreateReservationPage` component with:
  - Arena detail block
  - Date picker (calendar)
  - Start and end time selectors
  - Visual time slot list with selected range highlight
- Includes button to proceed with reservation.
- Current implementation relies on placeholder/local URLs and is not connected to a mounted Next route in `app/`.

### 7.3 Reservation confirmation (`/home/confirm-reservation`)
- Displays a reservation detail form for:
  - Responsible player
  - Reservation value
  - Advance payment choice (yes/no)
  - Selected schedule preview
- Includes cancel and create reservation action buttons.
- Some destination links are still placeholders.

## 8. Profile and Establishment Information

### 8.1 User profile page (`/home/profile`)
- Form for owner personal data edits:
  - Full name
  - CNPJ
  - Email (disabled)
- Buttons: cancel and save changes.
- Current submit is placeholder (no backend update integration yet).

### 8.2 Establishment info page (`/home/establishment-info`)
- Form for establishment edits:
  - Name
  - CEP
  - Address
  - City
- Buttons: cancel and save changes.
- Current submit is placeholder (no backend update integration yet).

## 9. Error Handling

### 9.1 404 page
- Custom not-found page with image, message, and link back to homepage.

### 9.2 Request-level handling
- Multiple pages implement loading and error states for async data fetching.
- API client throws errors for non-2xx responses and logs technical details in console.

## 10. API and Architecture Notes

### 10.1 API layer
- Central API client supports `GET`, `POST`, `PUT`, `DELETE`.
- Automatically sets `Content-Type: application/json`.
- Automatically injects auth token by default.

### 10.2 Service modules
- `authService`: login, register user, register establishment, validate email, verify token, logout.
- `arenasService`: list user arenas, register arena, load dashboard.
- `establishmentsService`: info/get/update/delete establishment.
- `reservationsService`: scaffold methods present (some endpoints still examples/placeholders).

### 10.3 Tech stack (frontend)
- Next.js (App Router)
- React + TypeScript
- SCSS modules
- Bootstrap / React-Bootstrap (table, pagination, form select)
- react-datepicker, react-modal, react-icons

## 11. Current Functional Gaps / In-Progress Areas

- Sidebar links include `/home/reservations`, but the active reservations page is currently under `/reservations`.
- `CreateReservationPage` imports `react-router-dom` hooks and uses placeholder/local URLs; route wiring in Next app is incomplete.
- Some UI actions still use temporary redirects (example: “Criar reserva” in confirmation page points to `/register`).
- Profile and establishment edit forms are not yet integrated with update API calls.
- Some hardcoded values remain in registration payload (`usr_cod_cad`, `own_id`) and dashboard greeting (`Luiz`).
- FAQ/Footer are available as components but currently not rendered in root layout.

---

## Summary

ArenaZ already delivers the core flow for arena owners: public landing, account login, multi-step registration, dashboard with arena list, new arena creation, active reservation table view, and profile/establishment pages.

The app is in a mixed stage of production + prototyping: core auth and arena registration are connected to backend APIs, while parts of reservation flow, route consistency, and profile update actions are still under implementation.

## Human-Friendly Explanation (Non-Technical)

If you are not a developer, this is what the app does in practical day-to-day terms:

- The app helps sports venue owners manage their business in one place.
- First, people can visit the website homepage and learn what ArenaZ is and why it is useful.
- If they want to use it, they can create an account and register their establishment.
- After logging in, they enter a private area where they manage everything.

### What you can do inside the app

- See your dashboard:
  - View your arenas (courts/fields/spaces) in one list.
  - Quickly access key numbers like reservation totals and money indicators.

- Add a new arena:
  - Register the arena name, price per hour, and sport category.
  - Save it so it appears in your dashboard.

- Check active reservations:
  - View reservation information in a table (who booked, date, time, and value).

- Prepare a reservation:
  - Choose date and time ranges for booking.
  - Fill reservation details before confirming.

- View and edit profile data:
  - Update owner information.
  - Update establishment information (name, address, city, etc.).

- Handle basic access flow:
  - Login to enter the management area.
  - If a page does not exist, the app shows a friendly 404 page with a link back home.

### In simple words

ArenaZ works like a digital control panel for sports venue owners: it helps you register your spaces, organize bookings, and keep business information together in one place instead of managing everything manually in chats, calls, or spreadsheets.
