# MediaLuna

MediaLuna es una plataforma para descubrir y rentar salones de eventos. El cliente está construido con Vite + React y el servidor integra Firebase Admin y Stripe Checkout.

## Correr el proyecto

```bash
npm install
npm run dev
```

En otra terminal inicia el backend:

```bash
npm run server
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
- `src/services/stripeService.js`: cliente autenticado para iniciar y sincronizar Stripe Checkout.
- `server/index.js`: crea reservaciones y sesiones Checkout con precios leídos desde Firestore, valida Firebase ID tokens y procesa el webhook firmado de Stripe.
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

Los botones de chat, llamada, videollamada, cambios de contraseña y algunas exportaciones todavía muestran “Pendiente de conexión” o un aviso equivalente para que no existan acciones silenciosas.

## Configurar Stripe

1. Copia las variables de `.env.example` a `.env.local` y conserva las variables Firebase web existentes.
2. Obtén `STRIPE_SECRET_KEY` desde Developers > API keys en el Dashboard de Stripe. Usa primero una clave `sk_test_...`.
3. Crea una cuenta de servicio en Firebase Console > Configuración del proyecto > Cuentas de servicio > Generar nueva clave privada. Guarda el JSON fuera del repositorio, elimina `FIREBASE_SERVICE_ACCOUNT` si existe y configura su ruta, por ejemplo `GOOGLE_APPLICATION_CREDENTIALS=C:/Users/tu_usuario/Downloads/firebase-service-account.json`.
4. Instala Stripe CLI, autentícate y reenvía eventos al backend local:

```bash
stripe login
stripe listen --forward-to localhost:4242/stripe/webhook
```

5. Copia el valor `whsec_...` mostrado por Stripe CLI a `STRIPE_WEBHOOK_SECRET` y reinicia `npm run server`.
6. En producción crea un webhook para `https://TU_BACKEND/stripe/webhook` con los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `refund.updated`, `refund.failed`, `charge.dispute.created` y `charge.dispute.closed`.
7. Configura `APP_URL` con el dominio del frontend y `VITE_STRIPE_BACKEND_URL` con el dominio HTTPS de este backend. `VITE_BACKEND_URL` puede seguir apuntando al servicio existente de chat y videollamada. Render puede iniciar este repositorio con `npm start`.

La reservación, el importe y el bloqueo de disponibilidad se generan en el servidor. Una sesión Checkout expira después de 31 minutos; el webhook cancela esa reservación pendiente y vuelve a liberar la fecha. El frontend nunca recibe `STRIPE_SECRET_KEY` ni la cuenta de servicio Firebase.

Para una prueba en modo test usa la tarjeta `4242 4242 4242 4242`, cualquier fecha futura y cualquier CVC. El resultado debe actualizar `pagos.estadoPago`, `pagos.identificadorPagoStripe`, `pagos.metodoPago`, `reservaciones.estadoPago` y la tabla de administración.
