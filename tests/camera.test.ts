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
