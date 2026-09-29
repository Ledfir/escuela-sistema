# Edge Functions

## Crear acceso de docente

Despliega la función desde la raíz del proyecto:

```powershell
supabase functions deploy create-teacher-access
```

Configura la URL pública de tu aplicación para que el enlace de invitación redirija correctamente:

```powershell
# supabase secrets set SITE_URL=https://tu-dominio.com
supabase secrets set SITE_URL=https://escuela.aflores.com.mx/
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` son secretos administrados por Supabase en funciones desplegadas. Nunca los copies al archivo `.env` del frontend.
