import type { RemoteUnitSnapshot } from '../gameplay/remote-weapons/types';

const labels = { docked: '待命', deploying: '出击', attacking: '攻击', repositioning: '换位', returning: '归队', recharging: '补能', destroyed: '损失' };
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
export function remoteHudMarkup(units: readonly RemoteUnitSnapshot[], targetNames: Record<string, string> = {}): string {
  const alive = units.filter(unit => unit.state !== 'destroyed');
  const deployed = alive.filter(unit => !['docked', 'recharging'].includes(unit.state));
  const names = [...new Set(deployed.flatMap(unit => unit.targetId ? [targetNames[unit.targetId] ?? '敌方机体'] : []))];
  return `<div class="remote-heading"><span>FIN FUNNEL</span><b>存活 ${alive.length}/${units.length} · 出击 ${deployed.length}</b></div><div class="remote-grid">${units.map(unit => {
    const lost = unit.state === 'destroyed', health = Math.max(0, unit.health / unit.maxHealth * 100);
    const label = unit.blocked ? unit.state === 'returning' ? '归队受阻' : '路径受阻' : labels[unit.state];
    return `<div class="remote-unit ${lost ? 'lost' : health <= 25 ? 'critical' : ''}" data-state="${unit.state}"><div><strong>${String(unit.index + 1).padStart(2, '0')}</strong><span>${lost ? '×' : label}</span></div><div class="remote-health"><i style="width:${health}%"></i></div><small>${lost ? '损失' : `${Math.ceil(unit.health)}/${unit.maxHealth}`}${unit.state === 'recharging' ? ` · ${Math.ceil(unit.cooldown)}s` : ''}</small></div>`;
  }).join('')}</div>${names.length ? `<small class="remote-note">攻击目标：${names.map(escape).join(' / ')}</small>` : ''}<small class="remote-note">自动出击 / 回收 · 回收不修复 · 击毁后本场损失</small>`;
}
