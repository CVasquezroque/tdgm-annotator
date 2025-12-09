export function ShortcutsHelp() {
  return (
    <div className="skills-card">
      <div className="skills-header">
        <div className="skills-title">
          <img className="icon" src="/icon-tag.png" alt="" />
          <span>TGMD-3 skills</span>
        </div>
      </div>
      <div className="skills-actions-note">
        Instrucciones rápidas:
        <ul>
          <li>Carga un video local (MP4) y presiona reproducir (barra espaciadora).</li>
          <li>Marca inicio/fin con botones o atajos: <strong>i</strong> (inicio), <strong>f</strong> (fin).</li>
          <li>Selecciona la acción TGMD-3 en la vista ampliada; la repetición se calcula automáticamente.</li>
          <li>La pista muestra segmentos por acción (Gantt). Tabla permite ir, editar, eliminar.</li>
          <li>Exporta CSV con los campos requeridos cuando termines.</li>
        </ul>
      </div>
    </div>
  )
}

