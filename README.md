# TGMD-3 Video Annotator

Este proyecto busca ofrecer una herramienta local, estable y fácil de usar para la anotación manual de los 13 movimientos del TGMD-3 en videos de niños, pensada para flujos clínicos, educativos y de investigación. La prioridad es que cualquier equipo institucional pueda cargar videos locales, marcar segmentos con precisión estilo ELAN, revisar/editar las anotaciones y exportar a CSV con los IDs oficiales del TGMD-3, sin depender de un backend ni instalaciones complejas.

Herramienta local para segmentar manualmente videos de habilidades motoras TGMD-3. Construida con React + TypeScript + Vite usando el reproductor HTML5 nativo (probado, mantenible y sin dependencias exóticas).

## ¿Por qué esta pila?

- **Web local y ligera**: Vite + React es estándar, ampliamente documentado y corre en navegadores actuales de hospitales/escuelas sin backend. Permite empaquetar como app de escritorio en el futuro (Electron/Tauri) sin reescribir.
- **Reproductor robusto**: Se apoya en el elemento `<video>` del navegador (acelerado por hardware) y controles propios, evitando motores propietarios. Previsualizaciones se generan con un video oculto + canvas, patrón común y mantenible.
- **Arquitectura clara**: Componentes separados (`VideoPlayer`, `Timeline`, `SegmentTrack`, `SegmentList`, `AnnotationForm`) y utilidades (`csvExport`, `time`). La ontología TGMD-3 está centralizada en `src/constants/actions.ts`.

## Requisitos previos
- Node.js 18+ (se recomienda 20+).

## Instalación y ejecución
```bash
npm install
# Frontend
npm run dev    # http://localhost:5173 (usa VITE_AUTH_URL para apuntar al backend)
npm run build  # build de producción estático

# Backend de autenticación local (Node + SQLite)
npm run server # http://localhost:4000 (env: CORS_ORIGIN, JWT_SECRET)
```
Variables relevantes (frontend):
- `VITE_AUTH_URL`: URL del backend de auth (por defecto http://localhost:4000)

Backend: `server/index.cjs` (Express + JWT + SQLite, cookie httpOnly). **No commitees `.env` ni `auth.db`**.

## Uso rápido
1. **Cargar video local**: botón “Seleccionar video local”.
2. **Reproducir y navegar**: play/pausa, saltos ±2s, barra de tiempo arrastrable con miniatura de previsualización.
3. **Marcar segmento**: inicio/fin (botones o atajos i/f). Se abre el formulario.
4. **Etiquetar**: elegir acción TGMD-3, repetición se asigna automáticamente, anotador se toma del usuario logueado, notas opcionales.
5. **Gestionar**: tabla de segmentos permite ir al inicio, editar o eliminar; la pista coloreada refleja los cambios.
6. **Exportar CSV**: botón “Exportar CSV” genera archivo con columnas exactas `video_id,file_path,action,start_sec,end_sec,repetition_id,annotator_id,notes`.

## Atajos de teclado
- Espacio: play/pausa
- `i`: marcar inicio
- `f`: marcar fin
- `← / →`: saltar 2s

## Estructura relevante
- `src/constants/actions.ts`: lista fija TGMD-3 (IDs, etiquetas, colores).
- `src/utils/csvExport.ts`: lógica de exportación CSV.
- `src/components/`: UI modular
  - `VideoPlayer`, `Timeline` + `ActionTimeline` (Gantt por acción), `SegmentList`, `AnnotationForm`, `ShortcutsHelp`, `LoginCard`.
- `src/hooks/useThumbnailGenerator.ts`: miniaturas con `<video>` oculto + `<canvas>`.
- `src/hooks/useAuth.ts`: login/register/logout contra el backend.
- `src/types.ts`: tipos `ActionId`, `Segment`, `VideoMeta`.

## CSV / ID de video
`video_id` se deriva del nombre de archivo sin extensión. `file_path` almacena el nombre recibido del `File` (los navegadores no exponen la ruta completa por seguridad).

## Ajustes recomendados
- **Latencia de scrubbing**: el generador de miniaturas usa `seeked`; si los videos son muy largos, se puede limitar la frecuencia de llamadas en `Timeline` o reducir el ancho de miniatura en `useThumbnailGenerator`.
- **Distribución**: se puede empaquetar con `vite build` y servir como app estática o integrarse en Electron/Tauri si se requiere un ejecutable.

