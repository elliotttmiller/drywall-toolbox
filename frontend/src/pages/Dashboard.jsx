/**
 * frontend/src/pages/Dashboard.jsx
 *
 * Authenticated account dashboard — /dashboard
 *
 * Thin wrapper around AccountHub (mirrors the Calculators → CalculatorHub pattern).
 * All layout, state, and tab logic lives in AccountHub.
 *
 * Auth: ProtectedRoute in App.jsx ensures only authenticated users can reach this
 *       route; AccountHub also redirects to /login if session is invalid.
 */

import { AccountHub } from '../components/dashboard';
import SEOHead from '../components/SEOHead';

export default function Dashboard() {
  return (
    <>
      <SEOHead noindex title="My Account" />
      <AccountHub />
    </>
  );
}
