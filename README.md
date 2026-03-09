# Vanaco Working Force

Proyecto migrado a arquitectura **server-side** (como `Pagina web geopolitico`):
- Frontend: `index.html` + `app.js` + `styles.css`
- Backend: `server.js` (Express)
- DB: tablas directas en Supabase (sin RPC para login)

## 1) SQL en Supabase
Ejecuta completo:
- [/Users/rotumerorontum/Documents/Pagina gestion/supabase-server-schema.sql](/Users/rotumerorontum/Documents/Pagina%20gestion/supabase-server-schema.sql)

## 2) Variables en Vercel
En el proyecto `vanacoworkingforces.vercel.app` configura:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET` (cadena larga aleatoria)

## 3) Deploy
Sube a GitHub estos archivos clave:
- [/Users/rotumerorontum/Documents/Pagina gestion/server.js](/Users/rotumerorontum/Documents/Pagina%20gestion/server.js)
- [/Users/rotumerorontum/Documents/Pagina gestion/package.json](/Users/rotumerorontum/Documents/Pagina%20gestion/package.json)
- [/Users/rotumerorontum/Documents/Pagina gestion/vercel.json](/Users/rotumerorontum/Documents/Pagina%20gestion/vercel.json)
- [/Users/rotumerorontum/Documents/Pagina gestion/index.html](/Users/rotumerorontum/Documents/Pagina%20gestion/index.html)
- [/Users/rotumerorontum/Documents/Pagina gestion/app.js](/Users/rotumerorontum/Documents/Pagina%20gestion/app.js)
- [/Users/rotumerorontum/Documents/Pagina gestion/styles.css](/Users/rotumerorontum/Documents/Pagina%20gestion/styles.css)

## 4) Flujo de usuarios
- Registro normal: crea usuario en estado pendiente (`is_active=false`).
- Primer registro del sistema: se crea como admin activo automáticamente.
- Solo admin puede activar/bloquear usuarios, hacer/quitar admin y editar datos.
- Usuario normal: solo lectura.
