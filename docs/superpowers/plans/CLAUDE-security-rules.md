# Reglas de seguridad y calidad — Supabase + Next.js

> Pegar esta sección en el `CLAUDE.md` de cada proyecto.
> Nacida de una auditoría real: 7 hallazgos, 3 críticos, todos silenciosos.

## Principio rector

**Los errores de seguridad no gritan.** Una policy mal escrita no tira excepción: devuelve
cero filas o deja pasar de más. Un permiso de más es el *default* de Postgres, no un error.
Por eso todo lo de acá abajo se **verifica con una consulta**, nunca se asume.

---

## Row Level Security

1. **RLS activo en toda tabla del esquema `public`.** El navegador le habla directo a la base
   con una clave que es pública por diseño. RLS es la única frontera que existe.

2. **Las policies permisivas se suman con OR.** Una sola policy laxa anula a todas las
   estrictas. Antes de agregar una policy, listar las que ya existen en esa tabla.

3. **Nunca `using (true)` ni `with check (true)`** salvo con `TO service_role` explícito.

4. **Siempre declarar `TO`.** Sin cláusula `TO`, Postgres asume `PUBLIC`, que incluye a `anon`.
   Usar `TO authenticated` cuando solo deben entrar usuarios logueados.

5. **`(select auth.uid())`, no `auth.uid()` pelado.** Envuelto en subconsulta, Postgres lo
   evalúa una vez por query en lugar de una vez por fila.

6. **INSERT usa `with check`, SELECT y DELETE usan `using`, UPDATE usa las dos.**
   Si `with check` se omite en un UPDATE, Postgres reutiliza la expresión de `using`.

7. **El nombre de una policy no restringe nada.** Una llamada "service role full access" con
   `TO public` es un agujero, no una policy de service role.

## Funciones SECURITY DEFINER

8. **Ignoran RLS por completo.** Cada función `SECURITY DEFINER` es una puerta que esquiva
   todas las policies de las tablas que toca.

9. **Postgres otorga `EXECUTE` a `PUBLIC` por defecto.** Supabase expone toda función del
   esquema `public` como endpoint RPC. Sin revoke explícito, la puede llamar cualquiera con
   la clave publishable. Para cada función nueva:

   ```sql
   revoke execute on function public.mi_funcion(tipos...) from public, anon, authenticated;
   grant  execute on function public.mi_funcion(tipos...) to service_role;
   ```

10. **Un comentario no es un control de acceso.** Si el cuerpo no valida al llamador, la
    función no está protegida — no importa qué diga el comentario de arriba.

11. **Validar adentro del cuerpo cuando la llama un usuario:**

    ```sql
    if not exists (
      select 1 from profiles
      where id = (select auth.uid()) and gym_id = p_gym_id and role = 'admin'
    ) then
      raise exception 'Not authorized';
    end if;
    ```

12. **`SET search_path = ''`** en toda función `SECURITY DEFINER`, para evitar secuestro de
    esquema.

## Storage

13. **Las policies de Storage viven en el esquema `storage`, no en `public`.** Una auditoría
    filtrada por `schemaname = 'public'` no las ve.

14. **En un bucket público, los archivos se sirven por URL sin evaluar policies.** Bucket
    público solo para contenido que puede ver cualquiera. Lo demás, bucket privado + URLs
    firmadas.

15. **Alcanzar por dueño o por inquilino, no solo por bucket.** `bucket_id = 'x'` como única
    condición deja que cualquier usuario pise los archivos de cualquier otro. Meter el
    identificador en la ruta y validarlo:
    `(storage.foldername(name))[1] = (select auth.uid())::text`

16. **Nunca aplicar las plantillas del dashboard sin leerlas.** Las que dicen
    "Give anon users access to..." otorgan escritura y borrado a usuarios sin cuenta.

## Claves

17. **`NEXT_PUBLIC_` = va al navegador.** Cualquiera la lee con F12. La clave publishable/anon
    es pública por diseño; lo que la protege es RLS.

18. **La clave secreta / service_role nunca sale del servidor.** Ni en URLs, ni en el
    frontend, ni en un chat. Si se expone, se rota.

19. **Los secretos van en `.env.local` (ignorado por git) y en las variables de entorno del
    hosting.** Solo `.env.example` se versiona, con nombres y sin valores.

## Migraciones y deriva

20. **Todo cambio de esquema va en un archivo de migración versionado y commiteado.**
    El click en el dashboard genera agujeros invisibles: quedan en la base y no en el código,
    así que nadie puede leerlos ni auditarlos.

21. **Los `drop policy`, `revoke` y `grant` también son migraciones.** Documentan la decisión.

22. **El repo debe describir la base.** Si divergen, cualquier entorno nuevo levanta distinto
    de producción.

## Antes de cada push

23. **Correr `npm run build` local.** Es el mismo comando que corre el CI y el hosting. Treinta
    segundos localmente contra minutos de espera y commits rojos.

24. **Verificar que el CI se dispare en `push` a `main`, no solo en `pull_request`.** Un
    workflow que solo corre en PR nunca se ejecuta si se pushea directo.

25. **El build del CI necesita variables de entorno dummy** para que el prerender de Next.js
    no explote.

26. **Revisar que los deploys de producción estén en verde.** El hosting deja andando el
    último build exitoso: la app parece funcionar mientras sirve una versión vieja.

## Linting

27. **Los plugins de ESLint hay que instalarlos Y cargarlos en `extends`.** Una regla
    referenciada pero no cargada tira "Definition for rule not found" y rompe el build.

28. **Un `// eslint-disable-next-line` nombra una regla que debe existir.** Si el plugin no
    está cargado, cada comentario es un error.

29. **Nunca destrabar el build con `eslint: { ignoreDuringBuilds: true }`.** Un build verde
    logrado apagando el linter es peor que uno rojo.

30. **Al limpiar variables sin usar: borrar imports es seguro; borrar la línea de una llamada
    a función, no.** Sacar la variable del destructuring, nunca la llamada.

---

## Primer paso siempre

Antes de auditar a mano: **Dashboard → Advisors → Security Advisor**. El linter integrado
(Splinter) detecta RLS deshabilitado, policies permisivas, funciones `SECURITY DEFINER`
ejecutables por `anon`, buckets públicos listables y el patrón `auth.uid()` sin subconsulta.
La auditoría manual es la segunda pasada, no la primera.
