# Vanaco Working Force

Web de gestión con acceso privado y datos en Supabase.

## 1) Setup Supabase (obligatorio)

1. Ve a SQL Editor en tu proyecto Supabase.
2. Ejecuta el contenido de [supabase-setup.sql](/Users/rotumerorontum/Documents/Pagina%20gestion/supabase-setup.sql).
3. En `Authentication > Providers`, deja Email activo.
4. Crea usuarios de equipo en `Authentication > Users`.
5. Si no quieres registros abiertos, desactiva "Enable email signups".

## 2) Ejecutar en local

```bash
cd "/Users/rotumerorontum/Documents/Pagina gestion"
python3 -m http.server 8080
```

Abrir: [http://localhost:8080](http://localhost:8080)

## 3) Flujo

- Primero aparece login.
- Solo usuarios autenticados ven y editan datos.
- La primera vez, si la tabla está vacía, se importa base desde `Vanaco Working Force/Principal.html`.
- También puedes reemplazar datos con "Importar archivo" (`.html` o `.csv`).
