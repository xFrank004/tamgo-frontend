import React, { useState, useEffect, useCallback } from 'react';
import { api } from './lib/api';

const SESSION_KEY = 'tamgo_session';

/* =========================================
   HELPERS
   ========================================= */
function formatCurrency(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return '$ -';
  return `$ ${number.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return `${date.toLocaleDateString('es-AR')} ${date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

/* =========================================
   FIRMA VISUAL: sello de estado + línea de ruta
   ========================================= */
const STAMP_STYLES = {
  // estados "positivos" en curso o resueltos favorablemente
  completed: 'text-route',
  delivered: 'text-route',
  paid: 'text-route',
  cleared: 'text-route',
  accepted: 'text-ink',
  assigned: 'text-ink',
  in_progress: 'text-ink',
  in_transit: 'text-ink',
  searching: 'text-ochre',
  pending: 'text-ochre',
  pending_acceptance: 'text-ochre',
  draft: 'text-asphalt/40',
  cancelled: 'text-rust',
  rejected: 'text-rust',
};

const StatusStamp = ({ status, label }) => (
  <span className={`stamp ${STAMP_STYLES[status] || 'text-asphalt/50'}`}>{label || status}</span>
);

/* =========================================
   TOAST (notificaciones de éxito / error)
   ========================================= */
const Toast = ({ toast }) => {
  if (!toast) return null;
  const isError = toast.type === 'error';
  return (
    <div
      key={toast.id}
      className={`fixed top-24 right-4 z-50 max-w-sm px-5 py-4 rounded-md shadow-2xl text-sm font-medium text-white flex items-center gap-3 animate-toast-in ${
        isError ? 'bg-rust' : 'bg-route'
      }`}
    >
      <span className="text-lg leading-none">{isError ? '✕' : '✓'}</span>
      <span>{toast.text}</span>
    </div>
  );
};

/* =========================================
   ROLE GATE (mensaje amigable si falta login o rol)
   ========================================= */
const RoleGate = ({ session, requiredType, children }) => {
  if (!session) {
    return (
      <div className="w-full min-h-[calc(100vh-68px)] flex items-center justify-center bg-paper">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">🔒</p>
          <p className="text-asphalt/70 font-medium">Iniciá sesión para ver esta pantalla.</p>
          <p className="text-asphalt/40 text-sm mt-1">Andá a "1.1 Onboarding" para crear una cuenta o ingresar.</p>
        </div>
      </div>
    );
  }
  if (requiredType && session.user.companyType !== requiredType) {
    const label = requiredType === 'shipper' ? 'un dador de carga' : 'un transportista';
    return (
      <div className="w-full min-h-[calc(100vh-68px)] flex items-center justify-center bg-paper">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">🚫</p>
          <p className="text-asphalt/70 font-medium">Esta pantalla es para {label}.</p>
          <p className="text-asphalt/40 text-sm mt-1">Ingresá con una cuenta de ese tipo para continuar.</p>
        </div>
      </div>
    );
  }
  return children;
};

/* =========================================
   ÉPICA 1: PANTALLA 1.1 - ONBOARDING + LOGIN
   ========================================= */
const Screen1_1 = ({ session, onAuthenticated, notify }) => {
  const [mode, setMode] = useState('register'); // 'register' | 'login'
  const [tab, setTab] = useState('cliente'); // 'cliente' | 'transportista'
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  if (session) {
    return (
      <div className="w-full min-h-[calc(100vh-68px)] flex items-center justify-center bg-paper">
        <div className="text-center">
          <p className="text-4xl mb-4">✅</p>
          <p className="text-asphalt/70 font-medium">
            Ya iniciaste sesión como {session.user.fullName} ({session.user.businessName}).
          </p>
        </div>
      </div>
    );
  }

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!fullName || !businessName || !taxId || !email || !password) {
      notify('error', 'Completá todos los campos obligatorios.');
      return;
    }
    setLoading(true);
    try {
      const companyType = tab === 'cliente' ? 'shipper' : 'carrier';
      const company = await api.registerCompany({
        company_type: companyType,
        business_name: businessName,
        tax_id: taxId,
        email,
        phone: phone || undefined,
      });
      await api.registerUser({
        company_id: company.id,
        full_name: fullName,
        email,
        phone: phone || undefined,
        password,
        role: 'admin',
      });
      notify(
        'success',
        `Cuenta creada (${companyType === 'shipper' ? 'C' : 'T'}-${company.id.slice(0, 8)}). Ya podés ingresar.`
      );
      setLoginEmail(email);
      setLoginPassword('');
      setMode('login');
    } catch (err) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      notify('error', 'Completá email y contraseña.');
      return;
    }
    setLoading(true);
    try {
      const data = await api.login(loginEmail, loginPassword);
      const newSession = {
        token: data.access_token,
        user: {
          id: data.user_id,
          fullName: data.full_name,
          companyId: data.company_id,
          businessName: data.business_name,
          companyType: data.company_type,
        },
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
      onAuthenticated(newSession);
      notify('success', `¡Bienvenido, ${data.full_name}!`);
    } catch (err) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex w-full h-full bg-paper-card overflow-y-auto">
      {/* Left Panel */}
      <div className="hidden md:flex w-1/2 bg-asphalt text-white flex-col justify-center items-center p-12 relative overflow-hidden">
        <div className="absolute inset-x-0 top-1/3 route-dash opacity-20" />
        <h1 className="font-display uppercase text-6xl font-bold mb-3 tracking-tight">Tamgo Truck</h1>
        <p className="text-lg mb-10 text-white/60 text-center max-w-sm">
          Logística y finanzas B2B en una sola ruta.
        </p>
        <div className="space-y-3 w-full max-w-sm">
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-4 rounded">
            <span className="stamp text-route">$</span>
            <p className="font-medium text-sm">Cobros garantizados a 30, 60 y 90 días</p>
          </div>
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-4 rounded">
            <span className="stamp text-ochre">⚡</span>
            <p className="font-medium text-sm">Liquidez inmediata para el transportista</p>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full md:w-1/2 flex flex-col justify-center px-8 md:px-24 py-12">
        {mode === 'register' ? (
          <>
            <h2 className="font-display uppercase text-3xl font-semibold text-asphalt mb-2">Creá tu cuenta</h2>
            <p className="text-asphalt/50 mb-8">Unite a la red logística más grande.</p>

            <div className="flex bg-paper p-1 rounded mb-8 border border-paper-line">
              <button
                type="button"
                onClick={() => setTab('cliente')}
                className={`flex-1 py-2 text-sm font-display uppercase tracking-wide rounded transition-all ${
                  tab === 'cliente' ? 'bg-white shadow text-ink' : 'text-asphalt/40'
                }`}
              >
                Dador de Carga (Cliente)
              </button>
              <button
                type="button"
                onClick={() => setTab('transportista')}
                className={`flex-1 py-2 text-sm font-display uppercase tracking-wide rounded transition-all ${
                  tab === 'transportista' ? 'bg-white shadow text-route' : 'text-asphalt/40'
                }`}
              >
                Transportista
              </button>
            </div>

            <form className="space-y-5" onSubmit={handleRegister}>
              <div>
                <label className="block text-sm font-medium text-asphalt/70 mb-1">Tu nombre y apellido</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full border border-paper-line rounded p-3 outline-none focus:border-ink focus:ring-1 focus:ring-ink bg-white"
                  placeholder="Ej. Daniel Jiménez"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-asphalt/70 mb-1">Razón Social</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full border border-paper-line rounded p-3 outline-none focus:border-ink focus:ring-1 focus:ring-ink bg-white"
                  placeholder="Ej. Logística SA"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-asphalt/70 mb-1">CUIT</label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="w-full border border-paper-line rounded p-3 outline-none focus:border-ink font-mono bg-white"
                  placeholder="00-00000000-0"
                />
                <p className="text-xs text-asphalt/40 mt-1">
                  Formato XX-XXXXXXXX-X. La validación de identidad real contra ARCA/AFIP todavía no está conectada.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-asphalt/70 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-paper-line rounded p-3 outline-none focus:border-ink bg-white"
                    placeholder="contacto@empresa.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-asphalt/70 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border border-paper-line rounded p-3 outline-none focus:border-ink bg-white"
                    placeholder="+54 9..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-asphalt/70 mb-1">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-paper-line rounded p-3 outline-none focus:border-ink bg-white"
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
              {tab === 'transportista' && (
                <p className="text-xs text-route bg-route-light border border-route/20 rounded p-3">
                  Vas a poder cargar tus vehículos y choferes después de ingresar, desde el dashboard.
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-route text-white font-display uppercase tracking-wide py-3 rounded hover:bg-route-dark transition mt-6 disabled:opacity-50"
              >
                {loading ? 'Registrando...' : 'Registrarme'}
              </button>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full text-ink font-semibold py-3 hover:underline"
              >
                Ya tengo cuenta - Ingresar
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="font-display uppercase text-3xl font-semibold text-asphalt mb-2">Ingresá a tu cuenta</h2>
            <p className="text-asphalt/50 mb-8">Usá el email y la contraseña que registraste.</p>
            <form className="space-y-5" onSubmit={handleLogin}>
              <div>
                <label className="block text-sm font-medium text-asphalt/70 mb-1">Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full border border-paper-line rounded p-3 outline-none focus:border-ink bg-white"
                  placeholder="contacto@empresa.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-asphalt/70 mb-1">Contraseña</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full border border-paper-line rounded p-3 outline-none focus:border-ink bg-white"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-route text-white font-display uppercase tracking-wide py-3 rounded hover:bg-route-dark transition mt-6 disabled:opacity-50"
              >
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className="w-full text-ink font-semibold py-3 hover:underline"
              >
                Todavía no tengo cuenta - Registrarme
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

/* =========================================
   ÉPICA 2: PANTALLA 2.1 - HOME (Transportista o Dador)
   ========================================= */
const Screen2_1 = ({ session, notify, goTo }) => {
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [shipmentsById, setShipmentsById] = useState({});
  const [fuelAccount, setFuelAccount] = useState(null);
  const [myShipments, setMyShipments] = useState([]);
  const [actingTripId, setActingTripId] = useState(null);

  const isCarrier = session && session.user.companyType === 'carrier';

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      if (isCarrier) {
        const [tripsData, fuelData] = await Promise.all([
          api.getMyTrips(session.token),
          api.getFuelAccount(session.token),
        ]);
        setTrips(tripsData);
        setFuelAccount(fuelData);

        const details = {};
        for (let i = 0; i < tripsData.length; i += 1) {
          const trip = tripsData[i];
          try {
            details[trip.shipment_id] = await api.getShipment(session.token, trip.shipment_id);
          } catch {
            // si falla una consulta puntual, seguimos con las demás
          }
        }
        setShipmentsById(details);
      } else {
        const shipmentsData = await api.getMyShipments(session.token);
        setMyShipments(shipmentsData);
      }
    } catch (err) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  }, [session, isCarrier, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStart = async (tripId) => {
    setActingTripId(tripId);
    try {
      await api.startTrip(session.token, tripId);
      notify('success', 'Viaje iniciado.');
      load();
    } catch (err) {
      notify('error', err.message);
    } finally {
      setActingTripId(null);
    }
  };

  const handleComplete = async (tripId) => {
    setActingTripId(tripId);
    try {
      await api.completeTrip(session.token, tripId);
      notify('success', 'Viaje completado. La carga quedó marcada como entregada.');
      load();
    } catch (err) {
      notify('error', err.message);
    } finally {
      setActingTripId(null);
    }
  };

  const tripStatusStyles = {
    accepted: { text: 'Aceptado' },
    in_progress: { text: 'En curso' },
    completed: { text: 'Completado' },
    cancelled: { text: 'Cancelado' },
    rejected: { text: 'Rechazado' },
    pending_acceptance: { text: 'Pendiente' },
  };

  const shipmentStatusStyles = {
    searching: { text: 'Buscando transporte' },
    assigned: { text: 'Asignada' },
    in_transit: { text: 'En tránsito' },
    delivered: { text: 'Entregada' },
    cancelled: { text: 'Cancelada' },
    draft: { text: 'Borrador' },
  };

  return (
    <RoleGate session={session}>
      {session && (
        <div className="w-full h-full overflow-y-auto bg-paper p-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="font-display uppercase text-3xl font-semibold text-asphalt">
                  Hola {session.user.fullName}
                </h1>
                <p className="text-asphalt/50 text-sm mt-1 font-mono">
                  {session.user.businessName} · {isCarrier ? 'Sin historial de calificaciones todavía.' : 'Panel del dador de carga'}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-ink-light border-2 border-ink flex items-center justify-center text-xl font-display font-bold text-ink">
                {session.user.fullName.slice(0, 2).toUpperCase()}
              </div>
            </div>

            {isCarrier ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-paper-card rounded-lg border border-paper-line p-6 flex flex-col justify-between">
                    <div>
                      <h3 className="text-asphalt/50 font-display uppercase text-xs tracking-wide mb-1">Saldo Disponible (Combustible)</h3>
                      <p className="text-4xl font-display font-semibold text-asphalt">
                        {fuelAccount ? formatCurrency(fuelAccount.available_balance) : '—'}
                      </p>
                    </div>
                    <button
                      onClick={() => goTo('4.2')}
                      className="mt-6 bg-asphalt text-white py-2 px-4 rounded font-display uppercase text-xs tracking-wide hover:bg-asphalt-light w-fit"
                    >
                      {fuelAccount ? 'Ver billetera' : 'Abrir línea de combustible'}
                    </button>
                  </div>
                  <div className="bg-ink rounded-lg p-6 text-white flex flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10">
                      <h3 className="text-white/60 font-display uppercase text-xs tracking-wide mb-1">Cargas disponibles para tomar</h3>
                      <p className="text-3xl font-display font-semibold">Ver listado</p>
                    </div>
                    <button
                      onClick={() => goTo('3.2')}
                      className="mt-6 bg-white text-ink py-2 px-4 rounded font-display uppercase text-xs tracking-wide hover:bg-paper w-fit z-10 flex items-center gap-2"
                    >
                      <span>📦</span> Buscar cargas
                    </button>
                  </div>
                </div>

                <h2 className="font-display uppercase text-xl font-semibold text-asphalt mb-4">Mis viajes</h2>
                {loading && <p className="text-asphalt/40">Cargando...</p>}
                {!loading && trips.length === 0 && (
                  <p className="text-asphalt/40">
                    Todavía no aceptaste ningún viaje. Andá a "3.2 Transportes" para ver cargas disponibles.
                  </p>
                )}
                <div className="space-y-4">
                  {trips.map((trip) => {
                    const shipment = shipmentsById[trip.shipment_id];
                    const style = tripStatusStyles[trip.status] || { text: trip.status };
                    return (
                      <div key={trip.id} className="waybill p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <StatusStamp status={trip.status} label={style.text} />
                          <p className="font-display uppercase text-lg font-semibold text-asphalt mt-2 break-words">
                            {shipment ? `${shipment.origin_address} → ${shipment.destination_address}` : 'Cargando ruta...'}
                          </p>
                          <p className="text-sm text-asphalt/50 break-words">
                            {shipment ? shipment.cargo_description || 'Carga general' : ''}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {trip.status === 'accepted' && (
                            <button
                              onClick={() => handleStart(trip.id)}
                              disabled={actingTripId === trip.id}
                              className="text-ink font-medium hover:underline disabled:opacity-50"
                            >
                              Iniciar viaje
                            </button>
                          )}
                          {trip.status === 'in_progress' && (
                            <button
                              onClick={() => handleComplete(trip.id)}
                              disabled={actingTripId === trip.id}
                              className="text-route font-medium hover:underline disabled:opacity-50"
                            >
                              Completar viaje
                            </button>
                          )}
                          {trip.status === 'completed' && (
                            <button onClick={() => goTo('4.1')} className="text-ink font-medium hover:underline">
                              Ir a liquidación
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="mb-8">
                  <button
                    onClick={() => goTo('3.1')}
                    className="bg-route text-white font-display uppercase tracking-wide py-3 px-6 rounded shadow-md hover:bg-route-dark transition"
                  >
                    + Publicar nueva carga
                  </button>
                </div>
                <h2 className="font-display uppercase text-xl font-semibold text-asphalt mb-4">Mis cargas publicadas</h2>
                {loading && <p className="text-asphalt/40">Cargando...</p>}
                {!loading && myShipments.length === 0 && (
                  <p className="text-asphalt/40">Todavía no publicaste ninguna carga.</p>
                )}
                <div className="space-y-4">
                  {myShipments.map((shipment) => {
                    const style = shipmentStatusStyles[shipment.status] || { text: shipment.status };
                    return (
                      <div key={shipment.id} className="waybill p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <StatusStamp status={shipment.status} label={style.text} />
                          <p className="font-display uppercase text-lg font-semibold text-asphalt mt-2 break-words">
                            {shipment.origin_address} → {shipment.destination_address}
                          </p>
                          <p className="text-sm text-asphalt/50 break-words">{shipment.cargo_description || 'Carga general'}</p>
                        </div>
                        {shipment.status === 'delivered' && (
                          <button onClick={() => goTo('4.1')} className="text-ink font-medium hover:underline flex-shrink-0">
                            Liquidar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </RoleGate>
  );
};

/* =========================================
   ÉPICA 3: PANTALLA 3.1 - NUEVO SERVICIO (Dador)
   ========================================= */
const Screen3_1 = ({ session, notify, goTo }) => {
  const [origin, setOrigin] = useState('Córdoba, Córdoba');
  const [destination, setDestination] = useState('Rosario, Santa Fe');
  const [loadDate, setLoadDate] = useState('2026-08-20T08:00');
  const [unloadDate, setUnloadDate] = useState('2026-08-21T18:00');
  const [description, setDescription] = useState('Repuestos automotrices');
  const [declaredValue, setDeclaredValue] = useState('1250000');
  const [weight, setWeight] = useState('8500');
  const [packageCount, setPackageCount] = useState('40');
  const [stackable, setStackable] = useState(true);
  const [fragile, setFragile] = useState(false);
  const [imo, setImo] = useState(false);
  const [oversized, setOversized] = useState(false);
  const [loading, setLoading] = useState(false);

  const suggestedVehicle = weight && Number(weight) > 5000 ? 'Semi remolque' : 'Furgón';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const shipment = await api.createShipment(session.token, {
        origin_address: origin,
        destination_address: destination,
        load_datetime: new Date(loadDate).toISOString(),
        unload_datetime: new Date(unloadDate).toISOString(),
        cargo_description: description,
        declared_value: declaredValue ? Number(declaredValue) : undefined,
        weight_kg: weight ? Number(weight) : undefined,
        package_count: packageCount ? Number(packageCount) : undefined,
        is_stackable: stackable,
        is_fragile: fragile,
        is_imo: imo,
        is_oversized: oversized,
      });
      notify('success', `Carga publicada (${shipment.id.slice(0, 8)}). Ya está visible para transportistas.`);
      goTo('2.1');
    } catch (err) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleGate session={session} requiredType="shipper">
      <div className="w-full min-h-[calc(100vh-68px)] overflow-y-auto bg-paper p-8">
        <form onSubmit={handleSubmit} className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8">
          <div className="flex-1 space-y-6">
            <h1 className="font-display uppercase text-2xl font-semibold text-asphalt mb-4">Solicitar Transporte</h1>

            <div className="bg-paper-card p-6 rounded-lg border border-paper-line">
              <h3 className="font-display uppercase text-sm tracking-wide text-asphalt/60 mb-4 border-b border-paper-line pb-2">📍 Ruta</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-asphalt/50">Origen</label>
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="w-full border border-paper-line rounded p-2 mt-1 bg-white focus:border-ink outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-asphalt/50">Destino</label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full border border-paper-line rounded p-2 mt-1 bg-white focus:border-ink outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="bg-paper-card p-6 rounded-lg border border-paper-line">
              <h3 className="font-display uppercase text-sm tracking-wide text-asphalt/60 mb-4 border-b border-paper-line pb-2">⏰ Fechas y Horas</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-asphalt/50">Carga</label>
                  <input
                    type="datetime-local"
                    value={loadDate}
                    onChange={(e) => setLoadDate(e.target.value)}
                    className="w-full border border-paper-line rounded p-2 mt-1 font-mono text-sm bg-white focus:border-ink outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-asphalt/50">Descarga</label>
                  <input
                    type="datetime-local"
                    value={unloadDate}
                    onChange={(e) => setUnloadDate(e.target.value)}
                    className="w-full border border-paper-line rounded p-2 mt-1 font-mono text-sm bg-white focus:border-ink outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="bg-paper-card p-6 rounded-lg border border-paper-line">
              <h3 className="font-display uppercase text-sm tracking-wide text-asphalt/60 mb-4 border-b border-paper-line pb-2">📦 Mercadería</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-sm text-asphalt/50">Descripción</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full border border-paper-line rounded p-2 mt-1 bg-white focus:border-ink outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-asphalt/50">Valor Declarado (ARS)</label>
                  <input
                    type="number"
                    value={declaredValue}
                    onChange={(e) => setDeclaredValue(e.target.value)}
                    className="w-full border border-paper-line rounded p-2 mt-1 font-mono bg-white focus:border-ink outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-asphalt/50">Peso Total (kg)</label>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full border border-paper-line rounded p-2 mt-1 font-mono bg-white focus:border-ink outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-asphalt/50">Bultos</label>
                  <input
                    type="number"
                    value={packageCount}
                    onChange={(e) => setPackageCount(e.target.value)}
                    className="w-full border border-paper-line rounded p-2 mt-1 font-mono bg-white focus:border-ink outline-none"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-6 mt-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={stackable} onChange={(e) => setStackable(e.target.checked)} /> ¿Apilable?
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={fragile} onChange={(e) => setFragile(e.target.checked)} /> ¿Frágil?
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={imo} onChange={(e) => setImo(e.target.checked)} /> ¿Carga IMO?
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={oversized} onChange={(e) => setOversized(e.target.checked)} /> ¿Sobredimensionada?
                </label>
              </div>
            </div>
          </div>

          <div className="w-full md:w-1/3">
            <div className="bg-ink-light border border-ink/20 p-6 rounded-lg sticky top-8">
              <h3 className="font-display uppercase text-sm tracking-wide text-ink-dark mb-4 flex items-center gap-2">
                <span>✨</span> Sugerencia automática
              </h3>
              <ul className="space-y-3 mb-6 text-sm text-ink-dark">
                <li className="flex gap-2">{imo ? '⚠️ Es carga IMO' : '✅ No es carga IMO'}</li>
                <li className="flex gap-2">{oversized ? '⚠️ Es sobredimensionada' : '✅ No es sobredimensionada'}</li>
                <li className="flex gap-2">{fragile ? '⚠️ Es frágil' : '✅ No es frágil'}</li>
              </ul>
              <div className="bg-white p-4 rounded border border-ink/10 mb-6 text-center">
                <p className="text-xs text-asphalt/40 uppercase tracking-wide mb-1 font-display">Camión Sugerido (por peso)</p>
                <p className="font-display font-semibold text-lg text-asphalt">{suggestedVehicle}</p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-route text-white font-display uppercase tracking-wide py-3 rounded shadow-md hover:bg-route-dark transition disabled:opacity-50"
              >
                {loading ? 'Publicando...' : 'Publicar y buscar transportes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </RoleGate>
  );
};

/* =========================================
   ÉPICA 3: PANTALLA 3.2 - CARGAS DISPONIBLES (Transportista)
   Nota: en el mockup original esta pantalla mostraba una lista de
   transportistas para que el dador eligiera. El backend real funciona al
   revés (el transportista toma cargas disponibles), así que la pantalla
   se reinterpretó para reflejar el flujo que realmente existe hoy.
   ========================================= */
const Screen3_2 = ({ session, notify, goTo }) => {
  const [loading, setLoading] = useState(true);
  const [availableTrips, setAvailableTrips] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [selections, setSelections] = useState({});
  const [acceptingId, setAcceptingId] = useState(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [tripsData, vehiclesData, driversData] = await Promise.all([
        api.getAvailableTrips(session.token),
        api.getMyVehicles(session.token).catch(() => []),
        api.getMyDrivers(session.token).catch(() => []),
      ]);
      setAvailableTrips(tripsData);
      setVehicles(vehiclesData || []);
      setDrivers(driversData || []);
    } catch (err) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  }, [session, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAccept = async (shipmentId) => {
    setAcceptingId(shipmentId);
    try {
      const selection = selections[shipmentId] || {};
      await api.acceptTrip(session.token, shipmentId, {
        vehicle_id: selection.vehicleId || undefined,
        driver_id: selection.driverId || undefined,
      });
      notify('success', 'Viaje aceptado. Lo vas a ver en "Mis viajes".');
      load();
      goTo('3.3');
    } catch (err) {
      notify('error', err.message);
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <RoleGate session={session} requiredType="carrier">
      <div className="w-full h-full overflow-y-auto bg-paper p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-paper-card p-6 rounded-lg border border-paper-line mb-8">
            <h2 className="font-display uppercase text-xl font-semibold text-asphalt">Cargas Disponibles</h2>
            <p className="text-asphalt/50 text-sm mt-1">Todas las cargas publicadas que todavía buscan transportista.</p>
          </div>

          {loading && <p className="text-asphalt/40">Cargando...</p>}
          {!loading && availableTrips.length === 0 && (
            <p className="text-asphalt/40">No hay cargas disponibles en este momento.</p>
          )}

          <div className="space-y-4">
            {availableTrips.map((shipment) => (
              <div key={shipment.id} className="waybill p-6">
                <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
                  <div className="min-w-0">
                    <h4 className="font-display uppercase text-lg font-semibold text-asphalt break-words">
                      {shipment.origin_address} → {shipment.destination_address}
                    </h4>
                    <p className="text-sm text-asphalt/50 font-mono">
                      {formatDate(shipment.load_datetime)} ·{' '}
                      {shipment.weight_kg ? `${shipment.weight_kg} kg` : 'Peso sin especificar'}
                    </p>
                  </div>
                  {shipment.declared_value ? (
                    <p className="text-right text-sm text-asphalt/50 flex-shrink-0">
                      Valor declarado
                      <span className="block font-mono font-semibold text-asphalt">{formatCurrency(shipment.declared_value)}</span>
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs text-asphalt/40 uppercase font-display tracking-wide">Unidad (opcional)</label>
                    <select
                      className="w-full border border-paper-line rounded p-2 mt-1 text-sm bg-white focus:border-ink outline-none"
                      value={(selections[shipment.id] && selections[shipment.id].vehicleId) || ''}
                      onChange={(e) =>
                        setSelections((prev) => ({
                          ...prev,
                          [shipment.id]: { ...prev[shipment.id], vehicleId: e.target.value },
                        }))
                      }
                    >
                      <option value="">Sin especificar</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.plate} ({v.vehicle_type})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-asphalt/40 uppercase font-display tracking-wide">Chofer (opcional)</label>
                    <select
                      className="w-full border border-paper-line rounded p-2 mt-1 text-sm bg-white focus:border-ink outline-none"
                      value={(selections[shipment.id] && selections[shipment.id].driverId) || ''}
                      onChange={(e) =>
                        setSelections((prev) => ({
                          ...prev,
                          [shipment.id]: { ...prev[shipment.id], driverId: e.target.value },
                        }))
                      }
                    >
                      <option value="">Sin especificar</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => handleAccept(shipment.id)}
                  disabled={acceptingId === shipment.id}
                  className="bg-route text-white px-6 py-2 rounded font-display uppercase text-sm tracking-wide hover:bg-route-dark disabled:opacity-50"
                >
                  {acceptingId === shipment.id ? 'Aceptando...' : 'Aceptar viaje'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </RoleGate>
  );
};

/* =========================================
   ÉPICA 3: PANTALLA 3.3 - WHATSAPP UI (recapitulación del último viaje)
   ========================================= */
const Screen3_3 = ({ session }) => {
  const [latestTrip, setLatestTrip] = useState(null);
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!session || session.user.companyType !== 'carrier') {
        setLoading(false);
        return;
      }
      try {
        const trips = await api.getMyTrips(session.token);
        if (trips.length > 0 && active) {
          setLatestTrip(trips[0]);
          const shipmentData = await api.getShipment(session.token, trips[0].shipment_id);
          if (active) setShipment(shipmentData);
        }
      } catch {
        // pantalla puramente visual: si falla, se muestra el estado vacío
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [session]);

  return (
    <RoleGate session={session} requiredType="carrier">
      <div className="w-full h-full bg-gray-200 flex justify-center items-center p-4">
        <div className="w-full max-w-sm h-[700px] bg-[#efeae2] rounded-3xl shadow-2xl border-8 border-gray-900 overflow-hidden flex flex-col relative">
          <div className="bg-[#075e54] text-white px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl">🤖</div>
            <div>
              <h4 className="font-bold leading-tight">Bot Tamgo Truck</h4>
              <p className="text-xs text-green-200">En línea</p>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {loading && <p className="text-sm text-gray-500 text-center mt-8">Cargando...</p>}

            {!loading && !latestTrip && (
              <div className="bg-white text-gray-600 p-3 rounded-lg rounded-tl-none shadow-sm max-w-[90%] text-sm">
                Todavía no aceptaste ningún viaje. Cuando aceptes uno en "3.2 Transportes", acá vas a ver la confirmación.
              </div>
            )}

            {!loading && latestTrip && shipment && (
              <div className="bg-white text-gray-800 p-3 rounded-lg rounded-tl-none shadow-sm max-w-[90%] relative text-sm">
                <p className="font-bold text-[#075e54] mb-2">✅ Viaje confirmado</p>
                <p>Hola {session.user.fullName}.</p>
                <ul className="mt-2 mb-3 space-y-1">
                  <li>
                    📍 <strong>Origen:</strong> {shipment.origin_address}
                  </li>
                  <li>
                    🏁 <strong>Destino:</strong> {shipment.destination_address}
                  </li>
                  <li>
                    📅 <strong>Carga:</strong> {formatDate(shipment.load_datetime)}
                  </li>
                  {shipment.weight_kg && (
                    <li>
                      ⚖️ <strong>Peso:</strong> {shipment.weight_kg} kg
                    </li>
                  )}
                </ul>
                <p className="font-medium">Estado actual: {latestTrip.status}</p>
              </div>
            )}

            {!loading && latestTrip && (
              <div className="flex justify-end">
                <span className="bg-[#dcf8c6] text-gray-700 text-xs font-bold px-4 py-2 rounded-full shadow">
                  ✔ Aceptado desde la app
                </span>
              </div>
            )}
          </div>

          <div className="bg-gray-100 p-2 flex items-center gap-2">
            <div className="bg-white flex-1 rounded-full px-4 py-2 text-gray-400 text-sm">Escribe un mensaje...</div>
            <div className="w-10 h-10 bg-[#00a884] rounded-full flex items-center justify-center text-white">🎤</div>
          </div>
        </div>
      </div>
    </RoleGate>
  );
};

/* =========================================
   ÉPICA 4: PANTALLA 4.1 - LIQUIDACIÓN Y ECHEQ (Dador)
   ========================================= */
const Screen4_1 = ({ session, notify }) => {
  const [completedShipments, setCompletedShipments] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [freight, setFreight] = useState('');
  const [insurance, setInsurance] = useState('');
  const [paymentPlan, setPaymentPlan] = useState('dias_30');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const trips = await api.getMyTrips(session.token);
      const completed = trips.filter((t) => t.status === 'completed');
      const withShipment = [];
      for (let i = 0; i < completed.length; i += 1) {
        const trip = completed[i];
        try {
          const shipment = await api.getShipment(session.token, trip.shipment_id);
          withShipment.push({ trip, shipment });
        } catch {
          // se omite si no se puede leer el detalle
        }
      }
      setCompletedShipments(withShipment);
      if (withShipment.length > 0) {
        setSelectedTripId(withShipment[0].trip.id);
        const declared = Number(withShipment[0].shipment.declared_value || 0);
        setInsurance(declared ? String(Math.round(declared * 0.0015)) : '');
      }
    } catch (err) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  }, [session, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSelectTrip = (tripId) => {
    setSelectedTripId(tripId);
    setResult(null);
    const item = completedShipments.find((i) => i.trip.id === tripId);
    if (item) {
      const declared = Number(item.shipment.declared_value || 0);
      setInsurance(declared ? String(Math.round(declared * 0.0015)) : '');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTripId) {
      notify('error', 'Elegí un viaje completado para liquidar.');
      return;
    }
    setSubmitting(true);
    try {
      const settlement = await api.createSettlement(session.token, selectedTripId, {
        freight_amount: Number(freight),
        insurance_amount: insurance ? Number(insurance) : 0,
        payment_plan: paymentPlan,
      });
      setResult(settlement);
      notify('success', 'Liquidación generada.');
    } catch (err) {
      notify('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const planLabels = {
    contado: 'Contado (Inmediato)',
    dias_30: 'Plan 30 días vía ECHEQ',
    dias_45: 'Plan 45 días vía ECHEQ',
    dias_60: 'Plan 60 días vía ECHEQ',
    dias_90: 'Plan 90 días vía ECHEQ',
  };

  return (
    <RoleGate session={session} requiredType="shipper">
      <div className="w-full h-full overflow-y-auto bg-paper p-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-1/2 space-y-6">
            <h2 className="font-display uppercase text-2xl font-semibold text-asphalt">Resumen de Liquidación</h2>

            {loading && <p className="text-asphalt/40">Cargando viajes completados...</p>}
            {!loading && completedShipments.length === 0 && (
              <p className="text-asphalt/40">Todavía no tenés ningún viaje en estado "completado" para liquidar.</p>
            )}

            {!loading && completedShipments.length > 0 && (
              <div className="bg-paper-card p-6 rounded-lg border border-paper-line">
                <label className="text-sm text-asphalt/50 block mb-2">Viaje a liquidar</label>
                <select
                  value={selectedTripId}
                  onChange={(e) => handleSelectTrip(e.target.value)}
                  className="w-full border border-paper-line rounded p-2 mb-4 bg-white focus:border-ink outline-none"
                >
                  {completedShipments.map(({ trip, shipment }) => (
                    <option key={trip.id} value={trip.id}>
                      {shipment.origin_address} → {shipment.destination_address}
                    </option>
                  ))}
                </select>

                <h3 className="font-display uppercase text-sm tracking-wide text-asphalt/60 mb-4 pb-2 border-b border-paper-line">Detalle de Costos</h3>
                <div className="space-y-3 text-sm mb-4">
                  <div>
                    <label className="text-asphalt/50 block mb-1">Flete acordado (ARS)</label>
                    <input
                      type="number"
                      value={freight}
                      onChange={(e) => setFreight(e.target.value)}
                      placeholder="Ej. 4668000"
                      className="w-full border border-paper-line rounded p-2 font-mono bg-white focus:border-ink outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-asphalt/50 block mb-1">Seguro (ARS)</label>
                    <input
                      type="number"
                      value={insurance}
                      onChange={(e) => setInsurance(e.target.value)}
                      className="w-full border border-paper-line rounded p-2 font-mono bg-white focus:border-ink outline-none"
                    />
                    <p className="text-xs text-asphalt/40 mt-1">Sugerido: 0,15% del valor declarado (editable).</p>
                  </div>
                </div>

                {result ? (
                  <div className="mt-4 pt-4 border-t border-paper-line space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-asphalt/50">Comisión Tamgo Truck</span>
                      <span className="font-mono font-medium text-asphalt">{formatCurrency(result.commission_amount)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-display uppercase text-asphalt">Total liquidación</span>
                      <span className="font-mono font-bold text-xl text-asphalt">{formatCurrency(result.total_amount)}</span>
                    </div>
                    {result.echeq && (
                      <div className="bg-ink-light border border-ink/20 rounded p-4 mt-3">
                        <div className="flex justify-between mb-1">
                          <span className="text-asphalt/50">Vencimiento ECHEQ</span>
                          <span className="font-mono font-medium">{formatDate(result.echeq.due_date)}</span>
                        </div>
                        <div className="flex justify-between mb-1">
                          <span className="text-asphalt/50">Interés ({result.echeq.annual_rate}% TNA)</span>
                          <span className="font-mono font-medium text-rust">+ {formatCurrency(result.echeq.interest_amount)}</span>
                        </div>
                        <div className="flex justify-between border-t border-ink/20 pt-2 mt-2">
                          <span className="font-display uppercase text-asphalt">Total a pagar</span>
                          <span className="font-mono font-bold text-ink">{formatCurrency(result.echeq.total_to_pay)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-asphalt/40 mt-2">
                    La comisión y, si corresponde, el ECHEQ se calculan al confirmar (no se estiman antes).
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="w-full md:w-1/2 space-y-6">
            <h2 className="font-display uppercase text-2xl font-semibold text-asphalt">Forma de Pago</h2>
            <form onSubmit={handleSubmit} className="bg-paper-card rounded-lg border border-paper-line overflow-hidden">
              {Object.entries(planLabels).map(([value, label]) => (
                <label
                  key={value}
                  className={`block p-5 border-b border-paper-line last:border-b-0 cursor-pointer transition ${
                    paymentPlan === value ? 'bg-ink-light' : 'hover:bg-paper'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="pay"
                      checked={paymentPlan === value}
                      onChange={() => setPaymentPlan(value)}
                      className="w-5 h-5 accent-ink"
                    />
                    <span className="font-display uppercase text-asphalt">{label}</span>
                  </div>
                </label>
              ))}
              <div className="p-5">
                <button
                  type="submit"
                  disabled={submitting || !selectedTripId || !freight}
                  className="w-full bg-ink text-white font-display uppercase tracking-wide py-4 rounded shadow-lg hover:bg-ink-dark transition text-lg disabled:opacity-50"
                >
                  {submitting ? 'Procesando...' : 'Confirmar Pago y Emitir ECHEQ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </RoleGate>
  );
};

/* =========================================
   ÉPICA 4: PANTALLA 4.2 - WALLET COMBUSTIBLE (Transportista)
   ========================================= */
const Screen4_2 = ({ session, notify }) => {
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openingLimit, setOpeningLimit] = useState('10000000');
  const [showConsumeForm, setShowConsumeForm] = useState(false);
  const [stationName, setStationName] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const accountData = await api.getFuelAccount(session.token);
      setAccount(accountData);
      if (accountData) {
        const txData = await api.getFuelTransactions(session.token);
        setTransactions(txData);
      }
    } catch (err) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  }, [session, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpenAccount = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.openFuelAccount(session.token, { bank_name: 'Banco BPA', credit_limit: Number(openingLimit) });
      notify('success', 'Línea de combustible abierta.');
      load();
    } catch (err) {
      notify('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConsume = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.registerFuelTransaction(session.token, {
        station_name: stationName || 'Estación sin nombre',
        amount: Number(amount),
      });
      notify('success', 'Consumo registrado.');
      setShowConsumeForm(false);
      setStationName('');
      setAmount('');
      load();
    } catch (err) {
      notify('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RoleGate session={session} requiredType="carrier">
      <div className="w-full h-full bg-asphalt-dark flex justify-center items-center p-4">
        <div className="w-full max-w-sm h-[750px] bg-paper-card rounded-2xl shadow-2xl border-8 border-asphalt overflow-hidden flex flex-col font-sans">
          <div className="bg-ink text-white p-6 rounded-b-2xl shadow-md">
            <p className="text-white/60 text-sm mb-1 text-center font-display uppercase tracking-wide">
              Línea de Combustible {account && account.bank_name ? `(${account.bank_name})` : ''}
            </p>
            {loading ? (
              <h2 className="text-2xl font-display text-center">Cargando...</h2>
            ) : account ? (
              <h2 className="text-4xl font-display font-semibold text-center tracking-tight font-mono">{formatCurrency(account.available_balance)}</h2>
            ) : (
              <h2 className="text-lg font-display text-center">Todavía no abriste tu línea</h2>
            )}

            {account && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => setShowConsumeForm((v) => !v)}
                  className="bg-white text-ink font-display uppercase tracking-wide py-4 px-6 rounded-full shadow-lg flex items-center gap-3 hover:scale-105 transition-transform w-full justify-center"
                >
                  <span className="text-2xl">📷</span> Escanear QR en la estación
                </button>
              </div>
            )}
          </div>

          {!loading && !account && (
            <form onSubmit={handleOpenAccount} className="p-6 space-y-3">
              <p className="text-sm text-asphalt/60">Abrí tu línea de combustible para empezar a usarla.</p>
              <label className="text-xs text-asphalt/40 block font-display uppercase tracking-wide">Límite de crédito (ARS)</label>
              <input
                type="number"
                value={openingLimit}
                onChange={(e) => setOpeningLimit(e.target.value)}
                className="w-full border border-paper-line rounded p-2 font-mono focus:border-ink outline-none"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-ink text-white font-display uppercase tracking-wide py-3 rounded disabled:opacity-50"
              >
                {submitting ? 'Abriendo...' : 'Abrir línea de combustible'}
              </button>
            </form>
          )}

          {showConsumeForm && account && (
            <form onSubmit={handleConsume} className="p-6 space-y-3 border-b border-paper-line bg-paper">
              <label className="text-xs text-asphalt/40 block font-display uppercase tracking-wide">Estación</label>
              <input
                type="text"
                value={stationName}
                onChange={(e) => setStationName(e.target.value)}
                placeholder="Ej. YPF Ruta 9"
                className="w-full border border-paper-line rounded p-2 bg-white focus:border-ink outline-none"
              />
              <label className="text-xs text-asphalt/40 block font-display uppercase tracking-wide">Monto (ARS)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border border-paper-line rounded p-2 font-mono bg-white focus:border-ink outline-none"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-ink text-white font-display uppercase tracking-wide py-2 rounded disabled:opacity-50"
              >
                {submitting ? 'Registrando...' : 'Confirmar consumo'}
              </button>
            </form>
          )}

          <div className="flex-1 p-6 overflow-y-auto">
            <h3 className="font-display uppercase text-sm tracking-wide text-asphalt/60 mb-4">Últimos movimientos</h3>
            {account && transactions.length === 0 && (
              <p className="text-asphalt/40 text-sm">Todavía no registraste ningún consumo.</p>
            )}
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div key={tx.id} className="waybill flex justify-between items-center p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-rust-light rounded-full flex items-center justify-center text-lg">⛽</div>
                    <div>
                      <p className="font-medium text-asphalt text-sm">{tx.station_name || 'Estación'}</p>
                      <p className="text-xs text-asphalt/40 font-mono">{formatDate(tx.transaction_datetime)}</p>
                    </div>
                  </div>
                  <p className="font-mono font-semibold text-rust">- {formatCurrency(tx.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </RoleGate>
  );
};

/* =========================================
   ÉPICA 5: PANTALLA 5.1 - DASHBOARD BANCARIO (sin login)
   ========================================= */
const Screen5_1 = () => {
  const [summary, setSummary] = useState(null);
  const [risk, setRisk] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [summaryData, riskData] = await Promise.all([api.getDashboardSummary(), api.getCarriersRisk()]);
        if (active) {
          setSummary(summaryData);
          setRisk(riskData);
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const activeOperations = summary
    ? Object.entries(summary.trips_by_status)
        .filter(([status]) => status === 'accepted' || status === 'in_progress')
        .reduce((sum, [, count]) => sum + count, 0)
    : 0;

  const totalEcheqs = summary ? Object.values(summary.echeqs_by_status).reduce((a, b) => a + b, 0) : 0;

  const avgTicket =
    summary && summary.settlements_paid_count > 0 ? summary.settlements_paid_amount / summary.settlements_paid_count : null;

  const riskCounts = risk.reduce(
    (acc, carrier) => {
      acc[carrier.risk_level] = (acc[carrier.risk_level] || 0) + 1;
      return acc;
    },
    { verde: 0, amarillo: 0, rojo: 0 }
  );
  const riskTotal = risk.length || 1;
  const riskPctVerde = Math.round((riskCounts.verde / riskTotal) * 100);

  return (
    <div className="flex w-full h-full bg-paper">
      <div className="w-64 bg-asphalt-dark text-white/70 flex-col hidden md:flex">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-white font-display uppercase text-xl tracking-widest">BPA FinOps</h1>
          <p className="text-xs text-white/40 mt-1 font-mono">Tamgo Truck Partner</p>
        </div>
        <nav className="flex-1 mt-6">
          <a href="#" className="block px-6 py-3 bg-ink/20 text-white border-l-4 border-ink font-display uppercase text-sm tracking-wide">
            Dashboard Riesgo
          </a>
          <a href="#" className="block px-6 py-3 hover:bg-white/5 transition font-display uppercase text-sm tracking-wide">
            ECHEQs Emitidos
          </a>
          <a href="#" className="block px-6 py-3 hover:bg-white/5 transition font-display uppercase text-sm tracking-wide">
            Líneas de Crédito
          </a>
        </nav>
        <p className="text-[10px] text-white/30 px-6 pb-4">
          Acceso sin autenticación (demo). Pendiente de restringir antes de producción.
        </p>
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        <h2 className="font-display uppercase text-3xl font-semibold text-asphalt mb-8">Análisis de Cartera y Riesgo</h2>

        {loading && <p className="text-asphalt/40">Cargando datos en vivo del backend...</p>}
        {error && <p className="text-rust">{error}</p>}

        {summary && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-paper-card p-6 rounded-lg border border-paper-line border-t-4 border-t-ink">
                <p className="text-sm text-asphalt/50 font-display uppercase tracking-wide mb-1">Operaciones Activas</p>
                <p className="text-3xl font-mono font-bold text-asphalt">{activeOperations}</p>
              </div>
              <div className="bg-paper-card p-6 rounded-lg border border-paper-line border-t-4 border-t-route">
                <p className="text-sm text-asphalt/50 font-display uppercase tracking-wide mb-1">Ticket Promedio</p>
                <p className="text-3xl font-mono font-bold text-asphalt">{avgTicket ? formatCurrency(avgTicket) : 'N/D'}</p>
              </div>
              <div className="bg-paper-card p-6 rounded-lg border border-paper-line border-t-4 border-t-asphalt">
                <p className="text-sm text-asphalt/50 font-display uppercase tracking-wide mb-1">ECHEQs Emitidos (total)</p>
                <p className="text-3xl font-mono font-bold text-asphalt">{totalEcheqs}</p>
              </div>
              <div className="bg-paper-card p-6 rounded-lg border border-paper-line border-t-4 border-t-ochre">
                <p className="text-sm text-asphalt/50 font-display uppercase tracking-wide mb-1">Liquidaciones Pendientes</p>
                <p className="text-3xl font-mono font-bold text-asphalt">{summary.settlements_pending_count}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 bg-paper-card p-6 rounded-lg border border-paper-line">
                <h3 className="font-display uppercase text-asphalt mb-2">Cargas por estado</h3>
                <p className="text-xs text-asphalt/40 mb-6 font-mono">
                  {summary.shippers_total} dadores de carga · {summary.carriers_total} transportistas registrados
                </p>
                <div className="space-y-3">
                  {Object.entries(summary.shipments_by_status).map(([status, count]) => (
                    <div key={status} className="flex items-center gap-3">
                      <span className="text-xs w-36 text-asphalt/50 capitalize font-mono">{status.replace(/_/g, ' ')}</span>
                      <div className="flex-1 bg-paper rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-ink h-3 rounded-full"
                          style={{
                            width: `${Math.min(100, (count / Math.max(1, summary.companies_total * 2)) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono font-bold text-asphalt w-6 text-right">{count}</span>
                    </div>
                  ))}
                  {Object.keys(summary.shipments_by_status).length === 0 && (
                    <p className="text-sm text-asphalt/40">Todavía no hay cargas publicadas.</p>
                  )}
                </div>
              </div>

              <div className="bg-paper-card p-6 rounded-lg border border-paper-line flex flex-col items-center justify-center">
                <h3 className="font-display uppercase text-asphalt mb-6 self-start">Riesgo de Cartera</h3>
                {risk.length === 0 ? (
                  <p className="text-sm text-asphalt/40 text-center">Todavía no hay transportistas registrados.</p>
                ) : (
                  <>
                    <div className="relative w-40 h-40 rounded-full border-[16px] border-route flex items-center justify-center">
                      <div className="text-center">
                        <span className="text-2xl font-mono font-bold text-asphalt block">{riskPctVerde}%</span>
                        <span className="text-xs text-asphalt/50 font-display uppercase tracking-wide">Bajo riesgo</span>
                      </div>
                    </div>
                    <div className="w-full mt-8 space-y-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-route rounded-full"></div> Verde (Bajo riesgo)
                        </span>
                        <span className="font-mono font-bold">{riskCounts.verde}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-ochre rounded-full"></div> Amarillo (Riesgo medio)
                        </span>
                        <span className="font-mono font-bold">{riskCounts.amarillo}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-rust rounded-full"></div> Rojo (Alto riesgo)
                        </span>
                        <span className="font-mono font-bold">{riskCounts.rojo}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* =========================================
   APP PRINCIPAL
   ========================================= */
const TamgoTruckApp = () => {
  const [currentScreen, setCurrentScreen] = useState('1.1');
  const [session, setSession] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        setSession(JSON.parse(stored));
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
  }, []);

  const notify = useCallback((type, text) => {
    setToast({ type, text, id: Date.now() });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const handleAuthenticated = (newSession) => {
    setSession(newSession);
    setCurrentScreen(newSession.user.companyType === 'carrier' ? '2.1' : '3.1');
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setCurrentScreen('1.1');
    notify('success', 'Sesión cerrada.');
  };

  const navButtons = [
    { id: '1.1', label: '1.1 Onboarding' },
    { id: '2.1', label: '2.1 Dashboard' },
    { id: '3.1', label: '3.1 Nuevo Servicio' },
    { id: '3.2', label: '3.2 Transportes' },
    { id: '3.3', label: '3.3 WhatsApp' },
    { id: '4.1', label: '4.1 Pago ECHEQ' },
    { id: '4.2', label: '4.2 Combustible' },
    { id: '5.1', label: '5.1 Panel Banco' },
  ];

  return (
    <div className="min-h-screen bg-paper flex flex-col font-sans">
      <Toast toast={toast} />

      <div className="bg-asphalt text-white px-4 py-3 flex flex-wrap gap-2 items-center shadow-md border-b-4 border-route">
        <div className="flex flex-wrap gap-2">
          {navButtons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => setCurrentScreen(btn.id)}
              className={`px-4 py-2 rounded text-sm font-display uppercase tracking-wide transition-colors ${
                currentScreen === btn.id ? 'bg-route text-white' : 'bg-asphalt-light hover:bg-asphalt-light/70'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
        {session && (
          <div className="flex items-center gap-3 ml-auto pl-4 border-l border-white/20">
            <span className="text-sm text-white/70 font-mono">
              {session.user.fullName} · {session.user.businessName}
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded text-xs font-display uppercase tracking-wide bg-asphalt-light hover:bg-rust transition-colors"
            >
              Salir
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {currentScreen === '1.1' && <Screen1_1 session={session} onAuthenticated={handleAuthenticated} notify={notify} />}
        {currentScreen === '2.1' && <Screen2_1 session={session} notify={notify} goTo={setCurrentScreen} />}
        {currentScreen === '3.1' && <Screen3_1 session={session} notify={notify} goTo={setCurrentScreen} />}
        {currentScreen === '3.2' && <Screen3_2 session={session} notify={notify} goTo={setCurrentScreen} />}
        {currentScreen === '3.3' && <Screen3_3 session={session} />}
        {currentScreen === '4.1' && <Screen4_1 session={session} notify={notify} />}
        {currentScreen === '4.2' && <Screen4_2 session={session} notify={notify} />}
        {currentScreen === '5.1' && <Screen5_1 />}
      </div>
    </div>
  );
};

export default TamgoTruckApp;
