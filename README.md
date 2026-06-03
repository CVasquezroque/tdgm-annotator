# DIANA Annotation Tool

Plataforma web para segmentacion, anotacion y revision de habilidades motoras TGMD-3 en videos locales.

DIANA esta pensada para flujos clinicos, educativos y de investigacion donde se requiere registrar segmentos de movimiento sin subir los videos a servidores externos. Los videos se cargan desde el dispositivo del usuario; en Firestore solo se guardan metadatos codificados, sesiones, segmentos y estados de revision.

## Estado actual del proyecto

- Aplicacion web con React, TypeScript y Vite.
- Autenticacion con Firebase Auth.
- Persistencia de perfiles, sesiones, segmentos y revisiones con Cloud Firestore.
- Firebase Storage bloqueado por reglas: los videos no se suben.
- Flujo de aprobacion de usuarios antes de permitir anotaciones.
- Roles: `annotator`, `reviewer`, `supervisor` y `admin`.
- Guardado automatico de segmentos con respaldo local recuperable.
- Exportacion de la sesion actual y exportacion consolidada para roles con permisos.

## Flujo principal

1. El usuario crea una cuenta con correo y contrasena.
2. Firebase envia verificacion de correo.
3. Un supervisor o administrador activa la cuenta, asigna codigo de anotador y registra capacitacion/acuerdo.
4. El anotador carga un video local desde su dispositivo.
5. La aplicacion genera un nombre/codigo seguro para trazabilidad.
6. El anotador marca inicio y fin de cada segmento, selecciona la accion TGMD-3 y guarda.
7. Los cambios se sincronizan con Firestore mediante autosave.
8. El anotador envia la sesion a revision.
9. Un revisor, supervisor o administrador puede revisar, devolver o bloquear la sesion.
10. Se exportan anotaciones en CSV o JSON segun permisos.

## Modulos funcionales

### Anotacion

- Carga de video local.
- Reproductor HTML5 con play/pausa, silencio, velocidad y saltos.
- Vista normal y vista ampliada del video.
- Vista ampliada opcional, desactivada por defecto y recordada localmente.
- Timeline visual con segmentos.
- Lista editable de segmentos.
- Formulario de anotacion por segmento.
- Resumen del segmento como clip independiente en bucle.
- Pose opcional en el resumen mediante analisis MediaPipe bajo demanda.
- Sugerencia semiautomatica de `cruce_instructor` cuando aparecen dos poses validas en varios frames.
- Atajos de teclado para anotacion rapida.

### Sesiones

- Creacion automatica de sesion por usuario y video codificado.
- Estados de sesion: `draft`, `submitted`, `reviewed`, `returned`, `locked`.
- Recuperacion de borradores locales con `localStorage`.
- Edicion permitida solo en sesiones `draft` o `returned`.
- Envio de anotaciones a revision.

### Revision

- Panel de sesiones recibidas.
- Busqueda por anotador, video o estado.
- Paginacion configurable de 5, 10, 20 o 50 sesiones.
- Visor local de lectura que indica el archivo requerido y muestra los segmentos sobre el timeline.
- El visor `Ver` muestra la nota completa del segmento seleccionado y permite modificar solo las notas.
- Modo de revision editable para sesiones enviadas, sin permitir crear o eliminar segmentos.
- Checkbox `Pose en resumen` disponible tanto al ver como al revisar.
- Acciones de revision: revisar, aprobar, devolver o bloquear.
- Eliminacion administrativa de una anotacion completa mediante confirmacion escrita en Danger Zone.
- Comentarios opcionales para eventos de revision.
- Historial basico de eventos por sesion.

### Dashboard

- Resumen de sesiones, videos, segmentos, tiempo anotado y duracion promedio.
- Distribucion de sesiones por estado.
- Grafica de segmentos por accion TGMD-3.
- Conteo de videos, sesiones, segmentos y tiempo por anotador.
- Detalle de segmentos por cada combinacion de video y anotador.
- Alcance propio para anotadores y alcance global para roles de revision.

### Administracion de usuarios

- Listado de perfiles institucionales.
- Edicion de rol.
- Cambio de estado: `pending`, `active`, `suspended`.
- Asignacion de codigo de anotador.
- Registro de capacitacion completada.
- Registro de acuerdo de confidencialidad.
- Eliminacion administrativa de perfiles mediante confirmacion escrita en Danger Zone.

La eliminacion de usuarios desde la interfaz borra el perfil de DIANA guardado en Firestore, pero no elimina la cuenta correspondiente de Firebase Auth ni sus anotaciones existentes. Eliminar cuentas de Auth de otros usuarios requiere un servicio backend protegido con Firebase Admin SDK.

### Exportacion

- Exportacion de la sesion actual a CSV.
- Exportacion de la sesion actual a JSON.
- Exportacion de segmentos propios.
- Exportacion consolidada para revisores/supervisores/admins.
- Exportacion filtrada de sesiones revisadas o bloqueadas.

## Privacidad y datos

El video permanece en el dispositivo del usuario. La aplicacion no usa Firebase Storage para cargar videos ni guarda rutas locales reales, nombres personales originales, tamanos de archivo o `lastModified`.

Datos que si se guardan:

- Perfil institucional del usuario.
- Codigo de anotador.
- Codigo/nombre seguro del video.
- Sesion de anotacion.
- Segmentos anotados.
- Estado de revision.
- Eventos de revision.

Datos que no deben guardarse:

- Ruta local del video.
- Nombre original sensible del archivo si contiene datos personales.
- Bytes del video.
- Metadatos locales como `sizeBytes` o `lastModified`.
- Archivos en Firebase Storage.

## Stack tecnologico

- Frontend: React 19, TypeScript, Vite.
- Autenticacion: Firebase Auth.
- Base de datos: Cloud Firestore.
- Reglas de seguridad: `firestore.rules` y `storage.rules`.
- Estilos: CSS custom.
- Video: elemento nativo HTML5 `<video>`.

## Estructura del proyecto

```text
tgdm-annotator/
  public/
    logo.png
    icon-*.png
  scripts/
    phase1_1_validate.mjs
    phase2_validate.mjs
  server/
    index.cjs
  src/
    components/
      AdminUsersPanel.tsx
      AnnotationForm.tsx
      ApprovalStatusCard.tsx
      AutosaveStatus.tsx
      DashboardPanel.tsx
      DangerZoneConfirmDialog.tsx
      ExportPanel.tsx
      LoginCard.tsx
      MySessionsPanel.tsx
      ReviewSessionViewer.tsx
      ReviewerSessionsPanel.tsx
      SegmentLoopPreview.tsx
      SegmentList.tsx
      Timeline.tsx
      VideoLoader.tsx
      VideoPlayer.tsx
    constants/
      actions.ts
      app.ts
    hooks/
      useAnnotationSession.ts
      useAuth.ts
      useKeyboardShortcuts.ts
      useLocalBooleanPreference.ts
      useThumbnailGenerator.ts
    services/
      annotationSessions.ts
      exports.ts
      userAdmin.ts
      userProfiles.ts
    utils/
      csvExport.ts
      time.ts
      video.ts
    App.tsx
    firebase.ts
    types.ts
  tests/
    firestore-rules-phase1_1-cases.md
    firestore-rules-phase2-cases.md
  firebase.json
  firestore.rules
  storage.rules
  package.json
  vite.config.ts
```

## Variables de entorno

Crear un archivo `.env` local con las credenciales web del proyecto Firebase:

```env
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu_proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

El archivo `.env` no debe subirse al repositorio.

## Scripts disponibles

```bash
npm run dev
npm run build
npm run lint
npm run preview
npm run test:phase1.1
npm run test:phase2
```

Notas:

- `npm run dev` inicia Vite para desarrollo local.
- `npm run build` compila TypeScript y genera `dist/`.
- `npm run lint` ejecuta ESLint.
- `npm run test:phase1.1` y `npm run test:phase2` hacen validaciones estaticas del flujo seguro y de reglas esperadas.

## Rendimiento de video y pose

- Las previews del timeline usan `preload="metadata"` y limitan la frecuencia de seeks.
- Las previews del timeline se pausan mientras el video reproduce o MediaPipe procesa un segmento.
- MediaPipe se carga solo cuando se solicita pose.
- La pose no se estima continuamente durante la reproduccion normal.
- El resumen de pose estima los frames presentados por el clip segmentado, sin procesar el video principal completo.
- El modelo Pose Landmarker se reutiliza entre segmentos mientras la pagina permanece abierta.
- El primer recorrido de cada clip se analiza a velocidad normal y luego el resumen vuelve a `0.5x` para revision.
- El video secundario y canvas del resumen se liberan al cerrar el formulario o visor de pose.
- El overlay de pose se dibuja sobre el clip en bucle con opacidad aproximada de 85 %.

## Firebase

El archivo `firebase.json` referencia:

- `firestore.rules` para Cloud Firestore.
- `storage.rules` para Firebase Storage.

Firestore contiene las colecciones principales:

- `users`
- `video_registry`
- `annotation_sessions`
- `annotation_sessions/{sessionId}/segments`
- `annotation_sessions/{sessionId}/review_events`
- `annotation_segments`

`annotation_segments` funciona como coleccion plana para exportaciones consolidadas. Cuando se modifica el guardado de segmentos, se debe mantener sincronizada con la subcoleccion de segmentos de cada sesion.

## Reglas de acceso

Condiciones generales para anotar:

- Usuario autenticado.
- Correo verificado.
- Perfil institucional activo.
- Capacitacion marcada como completada.
- Acuerdo de confidencialidad marcado.
- Codigo de anotador asignado.

Permisos principales:

- `annotator`: crea y edita sus propias sesiones en `draft` o `returned`.
- `reviewer`: revisa sesiones, puede editar campos de segmentos existentes mientras la sesion esta `submitted` y puede marcarla como `reviewed`, `returned` o `locked`.
- Los roles de revision pueden corregir notas desde `Ver` sin modificar accion, inicio o fin.
- `supervisor`: puede revisar y administrar usuarios.
- `admin`: permisos administrativos ampliados, incluida eliminacion de anotaciones completas y perfiles de usuario segun reglas.

## Acciones TGMD-3

| Tecla | Accion |
| --- | --- |
| `1` | Correr (Run) |
| `2` | Galope (Gallop) |
| `3` | Saltar en un pie (Hop) |
| `4` | Salto indio (Skip) |
| `5` | Saltar con ambos pies (Horizontal jump) |
| `6` | Deslizarse (Slide) |
| `7` | Golpear con ambas manos (Strike two hands) |
| `8` | Golpear con una mano (Strike one hand) |
| `9` | Rebotar con una mano (Dribble one hand) |
| `0` | Atrapar con ambas manos (Catch two hands) |
| `Q` | Patear (Kick) |
| `W` | Lanzar por encima (Overhand throw) |
| `E` | Lanzar por debajo (Underhand throw) |

## Atajos de teclado

| Tecla | Accion |
| --- | --- |
| `Espacio` | Play/Pausa |
| `A` | Marcar inicio |
| `D` | Marcar fin |
| `S` | Guardar segmento |
| `Flecha izquierda` | Retroceder 2 segundos |
| `Flecha derecha` | Avanzar 2 segundos |
| `Alt + Flecha izquierda` | Retroceder ajuste fino |
| `Alt + Flecha derecha` | Avanzar ajuste fino |
| `1-9`, `0`, `Q`, `W`, `E` | Seleccionar accion TGMD-3 |

## Despliegue

El frontend puede desplegarse en Netlify u otro hosting estatico compatible con Vite.

Configuracion tipica:

- Build command: `npm run build`
- Publish directory: `dist`
- Variables de entorno: las mismas claves `VITE_FIREBASE_*` usadas localmente.

No desplegar secretos locales como `.env`, `client_secret.json` o `secrets.txt`.

## Archivos locales sensibles

El repositorio ignora archivos locales como:

- `.env`
- `client_secret.json`
- `secrets.txt`
- `server/auth.db`
- `CHANGELOG_LOCAL.md`
- `dist/`
- `node_modules/`

## Notas de mantenimiento

- Revisar `firestore.rules` cada vez que cambien roles, estados o datos guardados.
- Revisar `exports.ts` cuando cambie el esquema de exportacion.
- Revisar `annotationSessions.ts` si se cambia la forma de crear, guardar o listar segmentos.
- Mantener `APP_VERSION` y `EXPORT_SCHEMA_VERSION` actualizados cuando haya cambios de compatibilidad.
- El servidor `server/index.cjs` parece corresponder a una autenticacion local alternativa o legado; la aplicacion actual usa Firebase Auth.

## Autor

Carlos Vasquez

- GitHub: [@CVasquezroque](https://github.com/CVasquezroque)
