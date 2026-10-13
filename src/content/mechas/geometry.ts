import {
  BufferGeometry, Color, CylinderGeometry, ExtrudeGeometry, Group, Matrix4,
  Mesh, MeshStandardMaterial, SphereGeometry, Shape, TorusGeometry, TubeGeometry,
  CatmullRomCurve3, Float32BufferAttribute, Vector3, type Object3D, type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type Vec3 = readonly [number, number, number];

/** Resources are shared by pieces within one rig, never invalidated by another rig. */
export class GeometryResources {
  private geometries = new Map<string, BufferGeometry>();
  private materials = new Map<string, MeshStandardMaterial>();
  private disposed = false;

  geometry(key: string, create: () => BufferGeometry): BufferGeometry {
    let geometry = this.geometries.get(key);
    if (!geometry) {
      geometry = create();
      this.geometries.set(key, geometry);
    }
    return geometry;
  }

  own(geometry: BufferGeometry): BufferGeometry {
    this.geometries.set(`merged-${this.geometries.size}`, geometry);
    return geometry;
  }

  material(color: number, emissive = 0, intensity = 0): MeshStandardMaterial {
    const key = `${color}/${emissive}/${intensity}`;
    let material = this.materials.get(key);
    if (!material) {
      material = new MeshStandardMaterial({
        color, roughness: emissive ? 0.34 : 0.62, metalness: 0.15,
        emissive: new Color(emissive), emissiveIntensity: intensity,
      });
      this.materials.set(key, material);
    }
    return material;
  }

  box(width: number, height: number, depth: number, radius = 0.06): BufferGeometry {
    const bevel = Math.min(radius, width / 4, height / 4, depth / 4);
    return this.geometry(`box/${width}/${height}/${depth}/${bevel}`, () => new RoundedBoxGeometry(width, height, depth, 2, bevel));
  }

  cylinder(top: number, bottom: number, height: number, sides = 12): BufferGeometry {
    return this.geometry(`cylinder/${top}/${bottom}/${height}/${sides}`, () => new CylinderGeometry(top, bottom, height, sides));
  }

  sphere(radius: number): BufferGeometry {
    return this.geometry(`sphere/${radius}`, () => new SphereGeometry(radius, 16, 12));
  }

  torus(radius: number, tube: number): BufferGeometry {
    return this.geometry(`torus/${radius}/${tube}`, () => new TorusGeometry(radius, tube, 6, 20));
  }

  plate(points: readonly (readonly [number, number])[], depth: number, bevel = 0.035): BufferGeometry {
    const key = `plate/${points.flat().join(',')}/${depth}/${bevel}`;
    return this.geometry(key, () => {
      const shape = new Shape();
      shape.moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
      shape.closePath();
      const geometry = new ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, steps: 1 });
      geometry.translate(0, 0, -depth / 2);
      return geometry;
    });
  }

  tube(points: Vec3[], radius: number): BufferGeometry {
    const key = `tube/${points.flat().join(',')}/${radius}`;
    return this.geometry(key, () => new TubeGeometry(new CatmullRomCurve3(points.map((point) => new Vector3(...point))), 16, radius, 6, false));
  }

  /** Eight-sided armor rings, from bottom to top: y, half width, half depth, z offset. */
  armor(rings: readonly (readonly [number, number, number, number])[], chamfer = 0.22): BufferGeometry {
    return this.geometry(`armor/${rings.flat().join(',')}/${chamfer}`, () => {
      const vertices: number[] = [];
      const contours = rings.map(([y, w, d, z]) => {
        const c = Math.min(w, d) * chamfer;
        return [[-w + c, y, z - d], [w - c, y, z - d], [w, y, z - d + c],
          [w, y, z + d - c], [w - c, y, z + d], [-w + c, y, z + d],
          [-w, y, z + d - c], [-w, y, z - d + c]];
      });
      const triangle = (a: number[], b: number[], c: number[]) => vertices.push(...a, ...b, ...c);
      for (let r = 0; r < contours.length - 1; r++) for (let i = 0; i < 8; i++) {
        const j = (i + 1) % 8, lower = contours[r], upper = contours[r + 1];
        triangle(lower[i], upper[i], lower[j]); triangle(lower[j], upper[i], upper[j]);
      }
      for (let i = 0; i < 8; i++) {
        const j = (i + 1) % 8, top = rings.length - 1;
        triangle([0, rings[0][0], rings[0][3]], contours[0][i], contours[0][j]);
        triangle([0, rings[top][0], rings[top][3]], contours[top][j], contours[top][i]);
      }
      const result = new BufferGeometry();
      result.setAttribute('position', new Float32BufferAttribute(vertices, 3));
      result.computeVertexNormals();
      return result;
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.geometries.clear();
    this.materials.clear();
  }
}

export function group(parent: Object3D, name: string, position: Vec3 = [0, 0, 0]): Group {
  const result = new Group();
  result.name = name;
  result.position.set(...position);
  parent.add(result);
  return result;
}

export function part(parent: Object3D, geometry: BufferGeometry, material: Material, position: Vec3 = [0, 0, 0], rotation: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]): Mesh {
  const result = new Mesh(geometry, material);
  result.position.set(...position);
  result.rotation.set(...rotation);
  result.scale.set(...scale);
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}

export function rod(parent: Object3D, resources: GeometryResources, from: Vec3, to: Vec3, radius: number, material: Material, tipRadius = radius): Mesh {
  const start = new Vector3(...from);
  const end = new Vector3(...to);
  const direction = end.clone().sub(start);
  const result = part(parent, resources.cylinder(tipRadius, radius, direction.length()), material);
  result.position.copy(start.add(end).multiplyScalar(0.5));
  result.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
  return result;
}

/** Couplings follow the same curve as the core, avoiding floating beads. */
export function powerPipe(parent: Object3D, resources: GeometryResources, points: Vec3[], radius: number, material: Material, core: Material, count = 12): void {
  part(parent, resources.tube(points, radius * 0.72), core);
  const curve = new CatmullRomCurve3(points.map(p => new Vector3(...p)));
  const length = curve.getLength();
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const band = part(parent, resources.cylinder(radius, radius, length / count * 0.78, 10), material);
    band.position.copy(curve.getPointAt(t));
    band.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), curve.getTangentAt(t).normalize());
  }
}

/** Merge decorative armor by material, retaining named articulated subgroups. */
export function mergeArmor(armor: Group, resources: GeometryResources): void {
  const byMaterial = new Map<Material, Mesh[]>();
  armor.children.forEach((child) => {
    if (child instanceof Mesh && !Array.isArray(child.material)) {
      const meshes = byMaterial.get(child.material) ?? [];
      meshes.push(child);
      byMaterial.set(child.material, meshes);
    }
  });
  byMaterial.forEach((meshes, material) => {
    if (meshes.length < 2) return;
    const pieces = meshes.map((mesh) => {
      mesh.updateMatrix();
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geometry.deleteAttribute('uv');
      return geometry.applyMatrix4(mesh.matrix as Matrix4);
    });
    const merged = mergeGeometries(pieces);
    pieces.forEach((geometry) => geometry.dispose());
    if (!merged) return;
    meshes.forEach((mesh) => armor.remove(mesh));
    part(armor, resources.own(merged), material);
  });
}
