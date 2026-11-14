import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { ThirdPersonCamera } from '../src/gameplay/camera';
import { CITY_COLLIDERS } from '../src/content/maps/city';
import { pointBlocked } from '../src/gameplay/navigation';

it('keeps aiming aligned with mouse direction while the follow position catches up', () => {
  const camera = new PerspectiveCamera(), follower = new ThirdPersonCamera(camera);
  const position = new Vector3(0, 20, 0);
  follower.update(position, false, [], 1 / 60, true);
  follower.yaw = 1.5; follower.pitch = -0.7;
  follower.update(position, false, [], 1 / 60);
  const expected = new Vector3(-Math.sin(1.5) * Math.cos(-0.7), -Math.sin(-0.7), -Math.cos(1.5) * Math.cos(-0.7));
  expect(camera.getWorldDirection(new Vector3()).dot(expected)).toBeCloseTo(1, 6);
});

it('keeps the shoulder camera outside buildings when the player hugs a wall', () => {
  const camera = new PerspectiveCamera(); const follower = new ThirdPersonCamera(camera);
  follower.yaw = 0; follower.pitch = 0.1;
  follower.update(new Vector3(26, 0, -43), true, CITY_COLLIDERS, 1 / 60, true);
  expect(pointBlocked(camera.position, CITY_COLLIDERS, 0.35)).toBe(false);
});
it('keeps the camera above ground while looking upward', () => {
  const camera = new PerspectiveCamera(); const follower = new ThirdPersonCamera(camera);
  follower.pitch = -0.5;
  follower.update(new Vector3(0, 0, 55), false, CITY_COLLIDERS, 1 / 60, true);
  expect(camera.position.y).toBeGreaterThanOrEqual(0.6);
});

it('snaps between views without changing aim and follows the first-person eye without lag', () => {
  const camera = new PerspectiveCamera(), follower = new ThirdPersonCamera(camera);
  const position = new Vector3(10, 20, 30);
  follower.yaw = 1.1; follower.pitch = -0.6;
  follower.update(position, false, [], 1 / 60, true);
  const direction = camera.getWorldDirection(new Vector3());
  follower.viewMode = 'first-person';
  follower.update(position, false, [], 1 / 60, false, false, 6.2);
  expect(camera.position.toArray()).toEqual([10, 20 + 6.2 * 0.82, 30]);
  expect(camera.fov).toBe(72);
  expect(camera.getWorldDirection(new Vector3()).dot(direction)).toBeCloseTo(1, 6);
  position.y += 5;
  follower.update(position, false, [], 1 / 60, false, false, 6.2);
  expect(camera.position.y).toBe(position.y + 6.2 * 0.82);
  follower.viewMode = 'third-person';
  follower.update(position, false, [], 1 / 60);
  expect(camera.position.distanceTo(position)).toBeGreaterThan(10);
  expect(camera.fov).toBe(58);
  expect(camera.getWorldDirection(new Vector3()).dot(direction)).toBeCloseTo(1, 6);
});

it('uses first-person aim and boost fields of view', () => {
  const camera = new PerspectiveCamera(), follower = new ThirdPersonCamera(camera);
  follower.viewMode = 'first-person';
  follower.update(new Vector3(), true, [], 1 / 60, true, true);
  expect(camera.fov).toBe(50);
  follower.update(new Vector3(), false, [], 1 / 60, true, true);
  expect(camera.fov).toBe(78);
});
