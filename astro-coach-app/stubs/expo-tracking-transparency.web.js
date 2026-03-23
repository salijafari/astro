/**
 * Web stub: the real package imports a native module at load time, which fails on web.
 * Metro resolves `expo-tracking-transparency` to this file when platform === "web".
 */
import { PermissionStatus, createPermissionHook } from "expo-modules-core";

const grantedResponse = {
  granted: true,
  expires: "never",
  canAskAgain: true,
  status: PermissionStatus.GRANTED,
};

export function getAdvertisingId() {
  return null;
}

export async function requestTrackingPermissionsAsync() {
  return grantedResponse;
}

export async function getTrackingPermissionsAsync() {
  return grantedResponse;
}

export const useTrackingPermissions = createPermissionHook({
  getMethod: getTrackingPermissionsAsync,
  requestMethod: requestTrackingPermissionsAsync,
});

export function isAvailable() {
  return false;
}

export { PermissionStatus };
