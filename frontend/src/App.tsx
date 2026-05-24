import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from './pages/Home';
import VenueDetail from './pages/VenueDetail';
import EventCreate from './pages/EventCreate';
import EventInvite from './pages/EventInvite';
import Dashboard from './pages/Dashboard';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/venue/:id" element={<VenueDetail />} />
          <Route path="/events/create/:bookingId" element={<EventCreate />} />
          <Route path="/invite/:token" element={<EventInvite />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
