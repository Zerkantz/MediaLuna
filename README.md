# MediaLuna

Frontend de MediaLuna, una plataforma para descubrir y rentar salones de eventos. Está construido con Vite + React y cuenta con una capa Firestore preparada para cargar los datos reales del proyecto.

## Correr el proyecto

```bash
npm install
npm run dev
```

La conexión web usa las variables de `.env.local` con los nombres `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID` y `VITE_FIREBASE_APP_ID`. Después de cambiar ese archivo, reinicia Vite.

Para validar producción:

```bash
npm run lint
npm run build
```

## Arquitectura rápida

- `src/data/mockData.js`: datos de respaldo con las colecciones `usuarios`, `salones`, `servicios`, `disponibilidad`, `reservaciones` y `pagos`.
- `src/services/mockDb.js`: adaptador local para trabajar sin Firebase.
- `src/services/firebaseClient.js`: inicializa Firebase Web con las variables Vite y exporta `auth` y `db`.
- `src/services/authService.js`: login, registro, persistencia de sesión y cierre de sesión con Firebase Authentication.
- `src/services/firestoreService.js`: lecturas y escrituras de las seis colecciones, con normalización de arrays, fechas y `Timestamp`.
- `src/services/cloudinaryService.js`: configuración pública placeholder con `upload_preset: media_luna_salones`; guarda la intención de usar `secure_url` y `public_id`.
- `src/context/AppContext.jsx`: carga las seis colecciones desde Firestore al iniciar y conserva un fallback mock si faltan variables o las reglas bloquean la lectura.
- `src/pages/PublicPages.jsx`: sitio público, catálogo, detalle, autenticación y flujo de reservación.
- `src/pages/WorkspacePages.jsx`: paneles de cliente, dueño y administrador.

## Rutas principales

- Público: `/`, `/salones`, `/salones/:id`, `/reservar/:id/fecha`, `/reservar/:id/servicios`, `/reservar/:id/resumen`, `/login`, `/registro`.
- Cliente: `/cliente`, `/cliente/reservaciones`, `/cliente/perfil`.
- Dueño: `/dueno`, `/dueno/salones`, `/dueno/reservaciones`, `/dueno/chats`.
- Administrador: `/admin`, `/admin/usuarios`, `/admin/salones`, `/admin/servicios`, `/admin/disponibilidad`, `/admin/reservaciones`, `/admin/pagos`, `/admin/reportes`.

## Usuarios demo

Con Firebase configurado, `/login` usa Email/Password de Firebase Authentication y busca el perfil en `usuarios/{uid}`. Los paneles requieren una sesión válida y redirigen al panel indicado por `rol`. En modo sin Firebase se conserva el modo demo: cliente, dueño o administrador, con contraseña `medialuna`.

`/registro` crea primero la cuenta en Firebase Authentication y después el perfil con rol `cliente` en `usuarios/{uid}`. La contraseña nunca se guarda en Firestore.

Las cuentas de administrador y dueño existentes deben tener el mismo UID en Authentication y en su documento de Firestore, como los registros actuales del proyecto.

Los botones de Stripe, chat, llamada, videollamada, cambios de contraseña y algunas exportaciones muestran “Pendiente de conexión” o un aviso equivalente para que no existan acciones silenciosas.
