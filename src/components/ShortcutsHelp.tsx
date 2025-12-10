import { useState } from 'react'

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false)
  return (
    <div className="skills-card">
      <div className="skills-header">
        <div className="skills-title">
          <img className="icon" src="/icon-tag.png" alt="" />
          <span>TGMD-3 skills</span>
        </div>
        <button className="ghost" onClick={() => setOpen((v) => !v)}>
          ⌨ Atajos
        </button>
      </div>
      <div className="skills-actions-note">
        <div className="collapsible">
          <div className="collapsible-summary" onClick={() => setOpen((v) => !v)}>
            Instrucciones rápidas (click para {open ? 'ocultar' : 'ver más'})
          </div>
          {open && (
            <ul>
              <li>Espacio: reproducir/pausar</li>
              <li>A: marcar inicio</li>
              <li>D: marcar fin</li>
              <li>← / →: -2s / +2s (Alt + flechas: ajuste fino)</li>
              <li>1 / 2 / 3: velocidad 0.5x / 1x / 1.5x</li>
              <li>S: guardar segmento</li>
              <li>Teclas de acción: ver leyenda (ej. 1,2,3...)</li>
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

