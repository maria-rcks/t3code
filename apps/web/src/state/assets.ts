import {
  createAssetEnvironmentAtoms,
  createProjectFaviconUrlAtomFamily,
} from "@t3tools/client-runtime/state/assets";

import { connectionAtomRuntime } from "../connection/runtime";
import { projectFaviconCache } from "../assets/projectFaviconCache";
import { isElectron } from "../env";
import { appAtomRegistry } from "../rpc/atomRegistry";
import { primaryEnvironmentIdAtom } from "./primaryEnvironment";
import { environmentSession, readPreparedConnection } from "./session";

export const assetEnvironment = createAssetEnvironmentAtoms(connectionAtomRuntime, {
  localMediaEnvironment: () => {
    if (!isElectron) return null;
    const environmentId = appAtomRegistry.get(primaryEnvironmentIdAtom);
    if (environmentId === null) return null;
    const connection = readPreparedConnection(environmentId);
    return connection === null ? null : { environmentId, httpBaseUrl: connection.httpBaseUrl };
  },
});

export const projectFaviconUrlAtom = createProjectFaviconUrlAtomFamily({
  imageCache: projectFaviconCache,
  createUrl: assetEnvironment.createUrl,
  preparedConnection: environmentSession.preparedConnectionValueAtom,
});
