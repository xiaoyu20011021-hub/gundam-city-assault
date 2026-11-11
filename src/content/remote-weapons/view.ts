import { Group, Quaternion, Vector3 } from 'three';
import type { Actor } from '../../gameplay/actor';
import type { RemoteUnitSnapshot } from '../../gameplay/remote-weapons/types';
import { GeometryResources } from '../mechas/geometry';
import { createNuFinFunnel, type NuFinFunnelModel } from './nu-fin-funnel-model';

export type RemoteModelFactory = (resources: GeometryResources) => NuFinFunnelModel;
export const REMOTE_MODELS: Record<string, RemoteModelFactory> = { 'nu-fin-funnel': createNuFinFunnel };

/** World-space models remain visible when first-person rendering hides the pilot's rig. */
export class RemoteWeaponView {
  readonly root = new Group();
  private resources = new Map<string, { bank: GeometryResources; count: number }>();
  private models = new Map<string, { model: NuFinFunnelModel; deployment: number; resourceKey: string }>();
  private forward = new Vector3(0, 0, -1);
  private direction = new Vector3();
  private rotation = new Quaternion();
  constructor(private factories = REMOTE_MODELS) { this.root.name = 'remote-weapons'; }
  sync(units: readonly RemoteUnitSnapshot[], owners: ReadonlyMap<string, Actor>, dt: number): void {
    const ids = new Set(units.map(unit => unit.id));
    for (const [id, view] of this.models) if (!ids.has(id)) {
      view.model.root.removeFromParent(); this.models.delete(id);
      const resources = this.resources.get(view.resourceKey)!;
      if (--resources.count === 0) { resources.bank.dispose(); this.resources.delete(view.resourceKey); }
    }
    for (const unit of units) {
      let view = this.models.get(unit.id);
      if (!view) {
        const factory = this.factories[unit.model];
        if (!factory) throw new Error(`Unknown remote weapon model: ${unit.model}`);
        const resourceKey = `${unit.ownerId}/${unit.equipmentId}`;
        let resources = this.resources.get(resourceKey);
        if (!resources) { resources = { bank: new GeometryResources(), count: 0 }; this.resources.set(resourceKey, resources); }
        resources.count++;
        view = { model: factory(resources.bank), deployment: 0, resourceKey };
        view.model.root.name = unit.id; this.models.set(unit.id, view); this.root.add(view.model.root);
      }
      const { model } = view;
      model.root.visible = unit.state !== 'destroyed';
      const docked = unit.state === 'docked' || unit.state === 'recharging';
      const mount = owners.get(unit.ownerId)?.rig.remoteMounts?.[unit.mountId];
      if (docked && mount) {
        mount.getWorldPosition(model.root.position); mount.getWorldQuaternion(model.root.quaternion);
      } else {
        model.root.position.set(unit.position.x, unit.position.y, unit.position.z);
        this.direction.set(unit.direction.x, unit.direction.y, unit.direction.z);
        if (this.direction.lengthSq() > 1e-8) {
          this.rotation.setFromUnitVectors(this.forward, this.direction.normalize()); model.root.quaternion.copy(this.rotation);
        }
      }
      const goal = docked ? 0 : 1;
      view.deployment += Math.sign(goal - view.deployment) * Math.min(Math.abs(goal - view.deployment), Math.max(0, dt) * 5);
      model.setDeployment(view.deployment);
      const thruster = model.root.getObjectByName('funnel-thruster');
      if (thruster) thruster.visible = !docked && unit.state !== 'destroyed';
    }
    this.root.updateMatrixWorld(true);
  }
  dispose(): void {
    this.root.clear(); this.root.removeFromParent(); this.models.clear();
    for (const resources of this.resources.values()) resources.bank.dispose();
    this.resources.clear();
  }
}
