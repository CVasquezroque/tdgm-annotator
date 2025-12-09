# TGMD-3 Video Annotator (ELAN-style)

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
npm run dev    # levanta la app en modo desarrollo
npm run build  # build de producción estático
```
Abre el enlace que muestra Vite (típicamente http://localhost:5173). No se necesita backend.

## Uso rápido
1. **Cargar video local**: botón “Seleccionar video local”.
2. **Reproducir y navegar**: play/pausa, saltos ±2s, barra de tiempo arrastrable con miniatura de previsualización.
3. **Marcar segmento**: `[ inicio`, `] fin` (o botones). Al tener inicio y fin válidos se abre el formulario.
4. **Etiquetar**: elegir acción TGMD-3, opcional `repetition_id`, `annotator_id`, `notes`. Guardar.
5. **Gestionar**: tabla de segmentos permite ir al inicio, editar o eliminar; la pista coloreada refleja los cambios.
6. **Exportar CSV**: botón “Exportar CSV” genera archivo con columnas exactas `video_id,file_path,action,start_sec,end_sec,repetition_id,annotator_id,notes`.

## Atajos de teclado
- Espacio: play/pausa
- `[`: marcar inicio
- `]`: marcar fin
- `← / →`: saltar 2s
- Acciones TGMD-3: `1..9,0,q,w,e` (ver leyenda en UI)

## Estructura relevante
- `src/constants/actions.ts`: lista fija TGMD-3 (IDs, etiquetas, colores, atajos). Ajusta aquí para nuevas etiquetas/colores.
- `src/utils/csvExport.ts`: lógica de exportación CSV.
- `src/components/`: UI modular
  - `VideoPlayer`, `Timeline`, `SegmentTrack`, `SegmentList`, `AnnotationForm`, `ShortcutsHelp`.
- `src/hooks/useThumbnailGenerator.ts`: genera miniaturas con `<video>` oculto + `<canvas>`.
- `src/types.ts`: tipos `ActionId`, `Segment`, `VideoMeta`.

## CSV / ID de video
`video_id` se deriva del nombre de archivo sin extensión. `file_path` almacena el nombre recibido del `File` (los navegadores no exponen la ruta completa por seguridad).

## Ajustes recomendados
- **Latencia de scrubbing**: el generador de miniaturas usa `seeked`; si los videos son muy largos, se puede limitar la frecuencia de llamadas en `Timeline` o reducir el ancho de miniatura en `useThumbnailGenerator`.
- **Distribución**: se puede empaquetar con `vite build` y servir como app estática o integrarse en Electron/Tauri si se requiere un ejecutable.

