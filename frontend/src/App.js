import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PublicSchedule from './components/PublicSchedule';
import AdminLogin from './components/AdminLogin';
import RoundList from './components/admin/RoundList';
import RoundForm from './components/admin/RoundForm';
import Navbar from './components/Navbar';
import Standings from './components/standings';

import './nls-styles.css';

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<PublicSchedule />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<RoundList />} />
        <Route path="/admin/round/new" element={<RoundForm />} />
        <Route path="/admin/round/:id/edit" element={<RoundForm />} />
        <Route path="/standings" element={<Standings />} />
      </Routes>
    
    </BrowserRouter>
  );
}

export default App;
