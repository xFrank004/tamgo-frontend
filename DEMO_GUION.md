# Tamgo Truck — Guion de Demo

Duración estimada: 8–10 minutos. Dos ventanas de navegador: una normal (dador) y una de incógnito (transportista), ambas en `http://localhost:5173`.

## 0. Antes de que llegue la persona (5 min antes, a solas)

- [ ] PostgreSQL corriendo (`Get-Service -Name postgresql*` en PowerShell si tenés dudas).
- [ ] Backend arriba: `cd D:\tamgo-backend` → `venv\Scripts\activate` → `uvicorn main:app --reload`.
- [ ] Frontend arriba: `cd tamgo-frontend` → `npm run dev`.
- [ ] Dos ventanas abiertas en `localhost:5173`: una normal, una de incógnito (`Ctrl+Shift+N`).
- [ ] Cerrar pestañas y notificaciones que no querés que se vean si compartís pantalla.
- [ ] Zoom del navegador al 100%.
- [ ] Tener a mano (en un doc aparte, no en pantalla) los datos que vas a tipear — ver abajo.

### Datos sugeridos para crear en vivo

Si ya usaste estos CUIT o emails en pruebas anteriores, cambiales el último dígito (el CUIT y el email tienen que ser únicos en la base).

**Dador de carga** (ventana normal):
- Nombre y apellido: `Valentina Suárez`
- Razón social: `Cosecha Federal SA`
- CUIT: `30-55566677-4`
- Email: `operaciones@cosechafederal.com`
- Contraseña: `Demo2026!`

**Transportista** (ventana incógnito):
- Nombre y apellido: `Martín Ibarra`
- Razón social: `Transportes del Sur`
- CUIT: `30-88899911-2`
- Email: `flota@transportesdelsur.com`
- Contraseña: `Demo2026!`

## 1. Introducción (30 seg, sin tocar la pantalla todavía)

Una frase de contexto, no una explicación técnica:

> "Tamgo Truck conecta empresas que necesitan transportar carga con transportistas, y les resuelve el problema de plata en el medio: el transportista cobra rápido, el dador puede pagar a plazo con un ECHEQ."

## 2. Ventana normal — Onboarding del dador (Pantalla 1.1)

1. Tab **"Dador de Carga (Cliente)"**.
2. Completar el formulario con los datos de arriba.
3. Al registrar, la app te lleva sola al login — entrá con el mismo email/contraseña.

**Qué decir mientras tipeás:** "Esto no es una maqueta — cada campo que completo pega contra un backend real en FastAPI, con una base de datos PostgreSQL detrás."

## 3. Publicar una carga (Pantalla 3.1)

Después del login entrás directo acá.

1. Dejá los valores por defecto o cambiá origen/destino si querés algo más visual (ej. "Buenos Aires, Buenos Aires" → "Neuquén, Neuquén").
2. Señalá el panel derecho: **"Sugerencia automática"** — el camión sugerido cambia según el peso que cargues.
3. Botón **"Publicar y buscar transportes"**.

Te devuelve al dashboard (2.1), con la carga recién publicada en estado **BUSCANDO TRANSPORTE**.

## 4. Ventana incógnito — Onboarding del transportista (Pantalla 1.1)

1. Tab **"Transportista"**.
2. Completar con los datos de Transportes del Sur.
3. Login.

Te lleva directo al **Dashboard del transportista** (Pantalla 2.1) — distinto al del dador: acá se ve el saldo de combustible y un botón para buscar cargas.

## 5. Aceptar la carga (Pantalla 3.2)

1. Desde el dashboard, botón **"📦 Buscar cargas"**.
2. Ahí aparece la carga que publicaste en la ventana del dador — **en tiempo real, sin refrescar nada a mano**.
3. Los selectores de "Unidad" y "Chofer" van a estar vacíos (no cargaste flota) — está bien, son opcionales. Mencioná al pasar: "esto se conecta con la flota del transportista, que se carga en otra sección."
4. Botón **"Aceptar viaje"**.

Te lleva a la pantalla de WhatsApp (3.3) con la confirmación — es un mock visual, no manda un WhatsApp real, pero muestra el patrón (así se les avisa a los transportistas en el diseño original).

## 6. Iniciar y completar el viaje (Pantalla 2.1, ventana transportista)

1. Volvé a **"2.1 Dashboard"**. La carga aparece en "Mis viajes" con el sello **ACEPTADO**.
2. Botón **"Iniciar viaje"** → el sello cambia a **EN CURSO**.
3. Botón **"Completar viaje"** → cambia a **COMPLETADO**.

**Qué decir:** "Cada uno de estos clics es una transición de estado real en la base — no hay nada hardcodeado, y del otro lado la carga pasa a 'entregada' automáticamente."

## 7. Liquidar el viaje (Pantalla 4.1, ventana dador)

1. Volvé a la ventana del **dador**, andá a **"4.1 Pago ECHEQ"**.
2. El viaje completado ya aparece seleccionable. Completá el **flete** (poné un número, ej. `2500000`) — el seguro ya viene sugerido solo.
3. Elegí un plan a plazo, por ejemplo **"30 días vía ECHEQ"**.
4. Botón **"Confirmar Pago y Emitir ECHEQ"**.

Ahí aparece el resultado: **comisión calculada sola** (no la tipeaste vos), fecha de vencimiento del ECHEQ, interés, y el total a pagar.

**Punto clave para remarcar:** "La comisión y el interés no los pone el usuario — los calcula el servidor, así nadie los puede manipular. Y el ECHEQ queda como un registro interno, listo para conectar a una integración bancaria real el día que la haya."

*(Acá termina el flujo de liquidación en esta versión — todavía no hay un botón para marcar el ECHEQ como cobrado, así que no sigas con eso en la demo.)*

## 8. Wallet de combustible (Pantalla 4.2, ventana transportista)

1. Volvé a la ventana del **transportista**, "4.2 Combustible".
2. Si es la primera vez, va a pedir abrir la línea — poné un límite (ej. `5000000`) y confirmá.
3. Botón **"📷 Escanear QR"** (simulado): completá estación y monto, confirmá.
4. El saldo disponible baja en el momento.

## 9. Panel Banco (Pantalla 5.1) — cerrar con esto

1. Cualquiera de las dos ventanas, **"5.1 Panel Banco"**.
2. Mostrá los números: empresas registradas, cargas por estado, ECHEQs emitidos, riesgo de cartera — **todo son datos reales de lo que acabás de hacer**, no una maqueta con números fijos.

**Cierre sugerido:** "Esto es lo que vería un banco socio si integrara con la plataforma: visibilidad completa de la operatoria y del riesgo, en tiempo real."

## Si te preguntan cosas incómodas (respuestas honestas, preparadas)

- **"¿Esto ya está conectado a un banco real?"** → No. El ECHEQ es un registro interno; la integración con COELSA/BIND es un paso futuro, a propósito no simulado como si ya existiera.
- **"¿Validan el CUIT contra AFIP?"** → Hoy solo se valida el formato, no la identidad real. Está aclarado en el propio formulario de registro.
- **"¿Y si dos transportistas quieren la misma carga?"** → El sistema lo resuelve: la primera aceptación gana, la segunda persona recibe un error porque la carga ya no está disponible.
- **"¿Esto lo puede ver cualquiera?"** → El panel de banco (5.1) hoy no pide login — es una decisión tomada a propósito para esta etapa, pendiente de resolver antes de un despliegue real.

## Plan B si algo falla en vivo

- Si el backend se cae o tira un error inesperado: quedate en la pantalla que estabas, explicá qué debería pasar, y ofrecé mostrarlo de nuevo o seguir por otro lado del flujo mientras revisás la consola de `uvicorn`.
- Si perdés la sesión de alguna ventana sin querer: no pasa nada, volvés a loguearte con las mismas credenciales — no hace falta registrar de nuevo.
- Tené las credenciales anotadas aparte (no las vayas a tipear de memoria bajo presión).
