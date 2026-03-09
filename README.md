# Vanaco Working Force

Sistema con autenticación propia por `usuario + contraseña` (sin correos en flujo de acceso).

## 1) Setup Supabase

1. Ejecuta completo:
- [supabase-setup.sql](/Users/rotumerorontum/Documents/Pagina%20gestion/supabase-setup.sql)

2. Haz redeploy en Vercel.

## 2) Primer acceso (admin inicial)

- Si no existe ningún usuario, en login escribe un `usuario` y `contraseña`.
- Al pulsar `Entrar`, se crea automáticamente el primer admin y entra.

## 3) Roles

- `admin`:
  - Crear/editar/eliminar entradas
  - Importar/recargar datos
  - Crear usuarios
  - Hacer/quitar admin
  - Bloquear/activar usuarios
- `usuario`:
  - Solo lectura de datos

## 4) Archivos clave

- [index.html](/Users/rotumerorontum/Documents/Pagina%20gestion/index.html)
- [styles.css](/Users/rotumerorontum/Documents/Pagina%20gestion/styles.css)
- [app.js](/Users/rotumerorontum/Documents/Pagina%20gestion/app.js)
- [supabase-setup.sql](/Users/rotumerorontum/Documents/Pagina%20gestion/supabase-setup.sql)
