import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { ThirdPersonCamera } from '../src/gameplay/camera';
import { CITY_COLLIDERS } from '../src/content/maps/city';
import { pointBlocked } from '../src/gameplay/navigation';

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
