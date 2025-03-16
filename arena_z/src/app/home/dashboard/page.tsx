import DashboardPage from 'components/Dashboard/DashboardPage';
import HomePage from 'components/Home/HomePage';

export default function Dashboard() {
  return (
    <div className="flex">
      <HomePage />
      <DashboardPage />
    </div>
  );
}
