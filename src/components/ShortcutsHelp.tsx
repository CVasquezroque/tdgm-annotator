import { ACTION_BY_ID, TGMD_ACTIONS } from '../constants/actions'

const locomotorOrder = ['run', 'gallop', 'hop', 'skip', 'horizontal_jump', 'slide'] as const
const ballSkillsOrder = [
  'strike_two_hands',
  'strike_one_hand',
  'dribble_one_hand',
  'catch_two_hands',
  'kick',
  'overhand_throw',
  'underhand_throw',
] as const

export function ShortcutsHelp() {
  const renderGroup = (title: string, ids: readonly string[]) => (
    <div className="skills-group">
      <div className="skills-group-title">{title}</div>
      <ul className="skills-list">
        {ids.map((id) => {
          const action = ACTION_BY_ID[id]
          if (!action) return null
          return (
            <li key={id}>
              <img className="icon icon-tag" src="/icon-tag.png" alt="" />
              <span className="skill-shortcut">{action.shortKey?.toUpperCase()}</span>
              <span className="skill-name">{action.label}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )

  return (
    <div className="skills-card">
      <div className="skills-header">
        <div className="skills-title">
          <img className="icon" src="/icon-tag.png" alt="" />
          <span>TGMD-3 skills</span>
        </div>
      </div>
      <div className="skills-body">
        {renderGroup('Locomotor subtest', locomotorOrder)}
        {renderGroup('Ball skills subtest', ballSkillsOrder)}
      </div>
      <div className="skills-actions-note">
        {TGMD_ACTIONS.length} acciones fijas TGMD-3. Etiquetas exportan los IDs oficiales en CSV.
      </div>
    </div>
  )
}

