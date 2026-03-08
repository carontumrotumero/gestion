# Vanaco Working Force

Web de gestión con acceso privado y datos en Supabase.

## 1) Setup Supabase (obligatorio)

1. Ve a SQL Editor en tu proyecto Supabase.
2. Ejecuta el contenido de [supabase-setup.sql](/Users/rotumerorontum/Documents/Pagina%20gestion/supabase-setup.sql).
3. En `Authentication > Providers`, deja Email activo.
4. Para registro desde la web, deja activado `Enable email signups`.
5. Opcional: en `Authentication > Email`, desactiva confirmación de email si quieres acceso inmediato tras registrarse.
6. Si aparece `email rate limit exceeded`, desactiva confirmación por email o configura SMTP propio en Supabase.

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

## 4) Diagnóstico rápido (si no entra)

1. Verifica que en login aparezca `Build 2026-03-09.1` (si no, Vercel está sirviendo versión vieja).
2. Si el registro falla con límite de email: desactiva confirmación por email o configura SMTP.
3. Si no guarda filas: revisa que estés autenticado y que `supabase-setup.sql` esté aplicado.
4. Haz hard refresh en Safari: `Cmd + Shift + R`.
