import { expect, it, vi } from 'vitest';
import { CylinderGeometry, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { chamferGeometry } from '../src/content/maps/selene/batch';
import { createArchitecture } from '../src/content/maps/selene/architecture';
import { createMaterials } from '../src/content/maps/selene/materials';
import { createMapDisposer } from '../src/content/maps/selene/resources';
import { generateBlocks } from '../src/content/maps/selene/layout';
import { buildingColliders } from '../src/content/maps/selene/collisions';
import { SELENE_COLLIDERS, seleneDefinition } from '../src/content/maps/selene';
import { firstSegmentHit } from '../src/gameplay/combat';
import { moveBody, supportHeight } from '../src/gameplay/spatial';
import { pointBlocked } from '../src/gameplay/navigation';
import { createRemoteNavigation } from '../src/gameplay/remote-weapons/navigation';
import { segmentCollider } from '../src/gameplay/collider-shape';

it('matches actual tower meshes at empty octagonal and chamfered corners', () => {
  const context = new Proxy({ createImageData: (w: number,h: number) => ({data:new Uint8ClampedArray(w*h*4)}),
    measureText: () => ({width:400}) }, {get:(target,key) => key in target ? target[key as keyof typeof target] : () => {}});
  vi.stubGlobal('document', { createElement: () => ({width:0,height:0,getContext:()=>context}) });
  const materials = createMaterials(), root = createArchitecture(materials);
  root.scale.setScalar(1/3); root.updateMatrixWorld(true);
  try {
    const failures: unknown[] = []; let octagons = 0, chamfers = 0;
    for (const b of generateBlocks(87).filter(b => b.style !== 1 && Math.abs(b.x)<360 && Math.abs(b.z)<360)) {
      const octagon = b.style === 2, w = octagon ? Math.max(b.width,b.depth) : b.width, d = octagon ? w : b.depth;
      const y = (octagon ? b.height*.5+4 : 4+b.height/(b.style === 3 ? 3 : 2)*.4)/3;
      const a = new Vector3((b.x+w*.25)/3,y,(b.z+d*.65)/3), end = new Vector3((b.x+w*.65)/3,y,(b.z+d*.25)/3);
      const visible = new Raycaster(a,end.clone().sub(a).normalize(),0,a.distanceTo(end)).intersectObject(root,true);
      if (visible.length) continue; // Surface trim is real geometry and may legitimately block this sample.
      if (octagon) octagons++; else chamfers++;
      if (firstSegmentHit(a,end,SELENE_COLLIDERS,[])) failures.push({ x:b.x,z:b.z,style:b.style });
      // The actual central solid remains bulletproof in both directions.
      const left = new Vector3((b.x-w)/3,y,b.z/3), right = new Vector3((b.x+w)/3,y,b.z/3);
      expect(firstSegmentHit(left,right,SELENE_COLLIDERS,[])?.type).toBe('wall');
      expect(firstSegmentHit(right,left,SELENE_COLLIDERS,[])?.type).toBe('wall');
    }
    expect(octagons).toBeGreaterThanOrEqual(27); expect(chamfers).toBeGreaterThan(0); expect(failures).toEqual([]);
  } finally { createMapDisposer(root,Object.values(materials))(); vi.unstubAllGlobals(); }
});

it.each([0, 2])('matches exact prism mesh intersections including roofs for tower style %s', style => {
  const wall = buildingColliders({x:27,z:-18,width:33,depth:24,height:60,style})[1];
  const geometry = style === 2 ? new CylinderGeometry(.5,.5,1,8) : chamferGeometry();
  const material = new MeshBasicMaterial({side:DoubleSide}), mesh = new Mesh(geometry,material);
  const center = new Vector3((wall.minX+wall.maxX)/2,((wall.minY??0)+wall.height)/2,(wall.minZ+wall.maxZ)/2);
  mesh.position.copy(center); mesh.scale.set(wall.maxX-wall.minX,wall.height-(wall.minY??0),wall.maxZ-wall.minZ); mesh.updateMatrixWorld(true);
  let seed = 123;
  const random = () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
  try {
    for(let sample=0;sample<300;sample++) {
      const a = new Vector3(random()-.5,random()-.5,random()-.5).normalize().multiplyScalar(50).add(center);
      const b = new Vector3((random()-.5)*30,(random()-.5)*50,(random()-.5)*30).add(center);
      const length = a.distanceTo(b), ray = new Raycaster(a,b.clone().sub(a).normalize(),0,length);
      const visible = ray.intersectObject(mesh)[0], collision = segmentCollider(a,b,wall);
      if (visible) { expect(collision).not.toBeNull(); expect(collision!*length).toBeCloseTo(visible.distance,4); }
      else expect(collision).toBeNull();
    }
    expect(segmentCollider(center,center,wall)).toBe(0);
    expect(segmentCollider(center,center.clone().add(new Vector3(0,50,0)),wall)).toBe(0);
  } finally { geometry.dispose(); material.dispose(); }
});

it('uses the same octagonal footprint for bullets, movement, support and remote weapons', () => {
  const b = {x:0,z:0,width:30,depth:30,height:60,style:2}, walls = [buildingColliders(b)[1]];
  const a = {x:2.5,y:10,z:6.5}, end = {x:6.5,y:10,z:2.5};
  expect(firstSegmentHit(a,end,walls,[])).toBeNull();
  expect(firstSegmentHit(end,a,walls,[])).toBeNull();
  const nav = createRemoteNavigation(walls,seleneDefinition.bounds);
  expect(nav.lineClear(a,end)).toBe(true);
  const result = nav.move(a,end,10,.1); expect(result.blocked).toBe(false); expect(result.position).toEqual(end);
  const p = {x:4.5,y:10,z:4.5};
  expect(pointBlocked(p,walls,.1)).toBe(false);
  expect(moveBody(p,{x:.1,y:0,z:0},.1,1,walls,seleneDefinition.bounds).position.x).toBeCloseTo(4.6);
  expect(supportHeight({...p,y:30},.1,walls)).toBe(0);
  expect(firstSegmentHit({x:0,y:10,z:-8},{x:0,y:10,z:8},walls,[])?.type).toBe('wall');
  expect(moveBody({x:0,y:10,z:-8},{x:0,y:0,z:16},.5,1,walls,seleneDefinition.bounds).position.z).toBeLessThan(-5);
});
