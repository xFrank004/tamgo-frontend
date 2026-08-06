// Cliente de API para Tamgo Truck.
// Todas las funciones devuelven el JSON ya parseado, o lanzan un Error con
// el mensaje que vino en el campo "detail" de la respuesta de FastAPI.

// En desarrollo apunta a localhost. En producción, Vercel inyecta
// VITE_API_BASE con la URL real del backend desplegado (ver DEPLOY.md).
const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

async function request(path, { method = 'GET', token, body, form, allow404 = false } = {}) {
  const headers = {};
  let payload;

  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    payload = new URLSearchParams(body).toString();
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { method, headers, body: payload });
  } catch (networkError) {
    throw new Error(
      'No se pudo conectar con el servidor. ¿Está corriendo "uvicorn main:app --reload" en http://127.0.0.1:8000?'
    );
  }

  if (allow404 && response.status === 404) {
    return null;
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail = data && data.detail !== undefined ? data.detail : `Error ${response.status}`;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg || JSON.stringify(item)).join(', ')
      : String(detail);
    throw new Error(message);
  }

  return data;
}

export const api = {
  // ---------- Empresas ----------
  registerCompany: (payload) => request('/companies/', { method: 'POST', body: payload }),

  // ---------- Usuarios ----------
  registerUser: (payload) => request('/users/', { method: 'POST', body: payload }),

  // ---------- Autenticación ----------
  login: (email, password) =>
    request('/auth/login', { method: 'POST', form: true, body: { username: email, password } }),

  // ---------- Cargas ----------
  createShipment: (token, payload) => request('/shipments/', { method: 'POST', token, body: payload }),
  getMyShipments: (token) => request('/shipments/mine', { token }),
  getShipment: (token, shipmentId) => request(`/shipments/${shipmentId}`, { token }),

  // ---------- Viajes ----------
  getAvailableTrips: (token) => request('/trips/available', { token }),
  getMyTrips: (token) => request('/trips/mine', { token }),
  acceptTrip: (token, shipmentId, payload) =>
    request(`/trips/${shipmentId}/accept`, { method: 'POST', token, body: payload || {} }),
  startTrip: (token, tripId) => request(`/trips/${tripId}/start`, { method: 'POST', token }),
  completeTrip: (token, tripId) => request(`/trips/${tripId}/complete`, { method: 'POST', token }),

  // ---------- Liquidaciones y ECHEQs ----------
  createSettlement: (token, tripId, payload) =>
    request(`/trips/${tripId}/settlement`, { method: 'POST', token, body: payload }),
  getSettlement: (token, tripId) => request(`/trips/${tripId}/settlement`, { token, allow404: true }),
  paySettlement: (token, tripId) => request(`/trips/${tripId}/settlement/pay`, { method: 'POST', token }),
  clearEcheq: (token, tripId) =>
    request(`/trips/${tripId}/settlement/echeq/clear`, { method: 'POST', token }),
  rejectEcheq: (token, tripId) =>
    request(`/trips/${tripId}/settlement/echeq/reject`, { method: 'POST', token }),

  // ---------- Flota ----------
  getMyVehicles: (token) => request('/vehicles/mine', { token }),
  createVehicle: (token, payload) => request('/vehicles/', { method: 'POST', token, body: payload }),
  getMyDrivers: (token) => request('/drivers/mine', { token }),
  createDriver: (token, payload) => request('/drivers/', { method: 'POST', token, body: payload }),

  // ---------- Combustible ----------
  getFuelAccount: (token) => request('/fuel-account/mine', { token, allow404: true }),
  openFuelAccount: (token, payload) => request('/fuel-account/', { method: 'POST', token, body: payload }),
  registerFuelTransaction: (token, payload) =>
    request('/fuel-account/transactions', { method: 'POST', token, body: payload }),
  getFuelTransactions: (token) => request('/fuel-account/transactions', { token }),

  // ---------- Dashboard bancario (sin auth) ----------
  getDashboardSummary: () => request('/dashboard/summary'),
  getCarriersRisk: () => request('/dashboard/carriers-risk'),
};
