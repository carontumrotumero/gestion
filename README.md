# Vanaco Working Force

Gestión privada con Supabase, control de acceso por aprobación y roles (`admin`/`viewer`).

## 1) Configuración Supabase (obligatoria)

1. Abre SQL Editor y ejecuta:
   - [supabase-setup.sql](/Users/rotumerorontum/Documents/Pagina%20gestion/supabase-setup.sql)
2. En `Authentication > Providers > Email`:
   - `Enable email signups`: ON
3. En `Authentication > Email`:
   - `Confirm email`: OFF (recomendado al inicio por límites de envío)
4. En `Authentication > URL Configuration`:
   - Site URL: `https://vanacoworkingforces.vercel.app`
   - Redirect URL: `https://vanacoworkingforces.vercel.app/*`

## 2) Modelo de permisos

- `admin`:
  - Ver/editar/eliminar trabajos
  - Importar CSV/HTML
  - Aprobar o bloquear usuarios
  - Subir/bajar rol admin/viewer
- `viewer` (usuario normal):
  - Solo ver datos
  - No editar ni importar
- Usuario nuevo:
  - Queda `approved = false` hasta aprobación admin

## 3) Admin inicial

El SQL marca como admin al correo:

`carontumrotumero@gmail.com`

Si quieres cambiarlo, modifica la última sentencia `insert ... select` del SQL.

## 4) Deploy

### GitHub
Sube estos archivos:
- [index.html](/Users/rotumerorontum/Documents/Pagina%20gestion/index.html)
- [styles.css](/Users/rotumerorontum/Documents/Pagina%20gestion/styles.css)
- [app.js](/Users/rotumerorontum/Documents/Pagina%20gestion/app.js)
- [supabase-setup.sql](/Users/rotumerorontum/Documents/Pagina%20gestion/supabase-setup.sql)
- [README.md](/Users/rotumerorontum/Documents/Pagina%20gestion/README.md)

### Vercel
1. Importa el repo.
2. Verifica Root Directory (donde está `index.html`).
3. Deploy.
4. Hard refresh navegador: `Cmd + Shift + R`.

## 5) Local

```bash
cd "/Users/rotumerorontum/Documents/Pagina gestion"
python3 -m http.server 8080
```

Abrir: [http://localhost:8080](http://localhost:8080)
