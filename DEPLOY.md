# Tamgo Truck — Guía de Despliegue Online

Objetivo: que tu compañero abra una URL en el navegador y vea la app funcionando, sin instalar nada. Stack elegido (todo con capa gratuita, sin tarjeta de crédito donde es posible):

| Parte | Servicio | Por qué |
|---|---|---|
| Base de datos | [Neon](https://neon.tech) | PostgreSQL gratis en la nube, sin vencimiento |
| Backend (FastAPI) | [Render](https://render.com) | Deploy directo desde GitHub, gratis |
| Frontend (React) | [Vercel](https://vercel.com) | Deploy directo desde GitHub, gratis, sin "se duerme" |

**Advertencia sobre el free tier de Render**: si nadie usa el backend por 15 minutos, "se duerme" — el primer pedido después de eso tarda unos 30-60 segundos en responder mientras arranca de nuevo. Es normal, avisale a tu compañero para que no piense que está roto.

---

## Paso 1 — Subir el código a GitHub

Necesitás una cuenta de GitHub. Vas a crear **dos repositorios** (backend y frontend son proyectos independientes).

```powershell
# Backend
cd D:\tamgo-backend
git init
git add .
git commit -m "Backend inicial"
```

Andá a github.com → **New repository** → nombralo `tamgo-backend` → **no** marques "Add a README" (ya tenés archivos) → Create repository. GitHub te va a mostrar comandos como estos (usá los que te dé a vos, con tu usuario):

```powershell
git remote add origin https://github.com/TU_USUARIO/tamgo-backend.git
git branch -M main
git push -u origin main
```

Repetí lo mismo para el frontend:

```powershell
cd tamgo-frontend
git init
git add .
git commit -m "Frontend inicial"
```

Creá el repo `tamgo-frontend` en GitHub y pusheá igual que arriba.

> El `.gitignore` que agregamos ya excluye `venv/`, `node_modules/`, `.env` y todo lo que no debería subirse — no vas a subir contraseñas por accidente.

---

## Paso 2 — Base de datos en Neon

1. Entrá a [neon.tech](https://neon.tech) → creá cuenta gratis (podés usar tu cuenta de GitHub para entrar).
2. **Create a project** → nombre `tamgo-truck` → región cercana (ej. AWS South America si está disponible, si no la más cercana).
3. Neon te muestra un **connection string** parecido a:
   ```
   postgresql://usuario:contraseña@ep-xxxx.neon.tech/neondb?sslmode=require
   ```
   **Guardalo** — lo vas a necesitar en el Paso 3.
4. Cargá el esquema. En la consola de Neon hay un **SQL Editor** en el menú lateral — abrilo, pegá el contenido completo de tu archivo `tamgo_truck_schema.sql`, y ejecutalo. Deberías ver las 14 tablas creadas (podés confirmarlo en la pestaña **Tables** del panel de Neon).

---

## Paso 3 — Backend en Render

1. Entrá a [render.com](https://render.com) → creá cuenta (podés usar GitHub).
2. **New** → **Web Service** → conectá tu repo `tamgo-backend`.
3. Configuración:
   - **Name**: `tamgo-backend` (o el que quieras — este nombre define tu URL, ej. `tamgo-backend.onrender.com`)
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: Free
4. **Environment Variables** (sección más abajo en el mismo formulario, o en Settings después) — agregá estas cuatro:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | El connection string de Neon, pero cambiando `postgresql://` por `postgresql+psycopg://` al principio (SQLAlchemy lo necesita así) |
   | `JWT_SECRET_KEY` | Un valor real y secreto — generalo corriendo `python -c "import secrets; print(secrets.token_hex(32))"` en tu PC y pegando el resultado |
   | `APP_ENV` | `production` |
   | `APP_NAME` | `Tamgo Truck API` |

5. **Create Web Service**. Render va a instalar dependencias y levantar el servidor — mirá los logs, tarda unos minutos la primera vez.
6. Cuando termine, Render te da una URL tipo `https://tamgo-backend.onrender.com`. Probala en el navegador agregando `/health` al final — debería devolver `{"status":"ok",...}`. **Guardá esta URL**, la necesitás en el próximo paso.

---

## Paso 4 — Frontend en Vercel

1. Entrá a [vercel.com](https://vercel.com) → creá cuenta con GitHub.
2. **Add New** → **Project** → importá tu repo `tamgo-frontend`.
3. Vercel detecta Vite automáticamente. Antes de darle a Deploy, desplegá la sección **Environment Variables** y agregá:

   | Key | Value |
   |---|---|
   | `VITE_API_BASE` | La URL de Render del Paso 3, **sin** barra al final (ej. `https://tamgo-backend.onrender.com`) |

4. **Deploy**. En un minuto o dos te da una URL tipo `https://tamgo-frontend.vercel.app` — esa es la que le pasás a tu compañero.

---

## Paso 5 — Último ajuste: permitir que el frontend hable con el backend

Por defecto el backend acepta pedidos de cualquier origen (`allow_origins=["*"]` en `main.py`), así que en principio **no necesitás tocar nada más** y ya debería funcionar de punta a punta.

Si más adelante querés cerrarlo (buena práctica antes de compartirlo más ampliamente), en `main.py` cambiá:
```python
allow_origins=["*"],
```
por:
```python
allow_origins=["https://tamgo-frontend.vercel.app"],
```
con tu URL real de Vercel, y volvé a hacer `git push` (Render redespliega solo cuando detecta un push nuevo).

---

## Checklist final

- [ ] `https://tu-backend.onrender.com/health` responde `{"status":"ok"}`
- [ ] `https://tu-frontend.vercel.app` carga la pantalla de Onboarding
- [ ] Podés registrar una empresa nueva de prueba desde la URL de Vercel
- [ ] Le avisaste a tu compañero sobre el "despertar" de 30-60 seg si el backend estuvo inactivo

## Si algo no anda

- **Error de CORS en la consola del navegador**: revisá que `VITE_API_BASE` en Vercel no tenga una barra `/` al final.
- **El backend no arranca en Render**: mirá los logs (pestaña "Logs" del servicio) — casi siempre es `DATABASE_URL` mal copiada o sin `+psycopg`.
- **"relation does not exist" en los logs**: significa que el schema no se cargó bien en Neon — repetí el Paso 2.4.
