# WorkForceHub Frontend

React frontend for WorkForceHub HR Management System.

## Features

- Modern React 18 with Vite
- React Router for navigation
- TanStack Query for data fetching
- Zustand for state management
- Tailwind CSS for styling
- Responsive design

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Build

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/      # Reusable components
│   │   ├── Layout.jsx   # Main layout with sidebar
│   │   └── ProtectedRoute.jsx
│   ├── pages/           # Page components
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Employees.jsx
│   │   ├── Teams.jsx
│   │   ├── Attendance.jsx
│   │   ├── Leave.jsx
│   │   ├── Documents.jsx
│   │   ├── Letters.jsx
│   │   └── Payroll.jsx
│   ├── services/        # API services
│   │   └── api.js       # Axios instance
│   ├── store/           # State management
│   │   └── authStore.js # Auth state (Zustand)
│   ├── App.jsx          # Main app component
│   ├── main.jsx         # Entry point
│   └── index.css        # Global styles
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Environment Variables

Create a `.env` file if needed:
```
VITE_API_URL=http://localhost:8000/api/v1
```
