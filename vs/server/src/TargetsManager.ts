
import { Targets, allExtensions } from "@ibm/source-orbit";
import { ILEObject } from "@ibm/source-orbit/dist/src/targets";

import glob from "glob";
import { URI } from 'vscode-uri';

import path = require("path");

export const SupportedGlob = `**/*.{${allExtensions.join(`,`)}}`;

export class TargetsManager {
  private static projects: { [workspacePath: string]: Targets|undefined } = {};

  static isReady(workspaceUri: string) {
    return (this.getTargetsForWorkspaceUri(workspaceUri) !== undefined);
  }

  static getWorkspaceFolder(fsPath: string) {
    const workspaces = Object.keys(this.projects);
    return workspaces.find(w => fsPath.startsWith(w));
  }

  static getTargetsForWorkspacePath(fullPath: string) {
    return this.projects[fullPath];
  }

  static getTargetsForWorkspaceUri(uriString: string) {
    const uri = URI.parse(uriString);
    const url = uri.fsPath;
    return this.projects[url];
  }

  static getTargetsForFile(uriString: string) {
    const uri = URI.parse(uriString);
    const workspacePath = this.getWorkspaceFolder(uri.fsPath);
    if (workspacePath) {
      return this.projects[workspacePath];
    }
  }

  static async initialise(workspaceUri: string, overwrite = false) {
    const uri = URI.parse(workspaceUri);
    const url = uri.fsPath;

    if (!this.projects[url] || overwrite) {
      const files = getFiles(url, SupportedGlob);

      const targets = new Targets(url);

      await Promise.allSettled(files.map(f => targets.handlePath(f)));

      targets.resolveBinder();

      this.projects[url] = targets;
    }
  }

  static destory(workspaceUri: string) {
    const uri = URI.parse(workspaceUri);
    const url = uri.fsPath;

    if (this.projects[url]) {
      this.projects[url] = undefined;
    }
  }

  static refreshSingle(uriString: string) {
    const uri = URI.parse(uriString);

    const pathDetail = path.parse(uri.fsPath);

    if (pathDetail.ext.length > 1) {
      const ext = pathDetail.ext.substring(1).toLowerCase();

      if (allExtensions.includes(ext)) {
        const targets = this.getTargetsForFile(uriString);

        if (targets) {
          return targets.handlePath(uri.fsPath);

          // TODO: think about re-resolving later if changing a module?
        }
      }
    }
  }

  static removeSingle(uriString: string) {
    const uri = URI.parse(uriString);

    const pathDetail = path.parse(uri.fsPath);

    if (pathDetail.ext.length > 1) {
      const ext = pathDetail.ext.substring(1);

      if (allExtensions.includes(ext)) {
        const targets = this.getTargetsForFile(uriString);

        if (targets) {
          const impacted = targets.removeObjectByPath(uri.fsPath);

          if (impacted.length > 0) {
            const cwd = this.getWorkspaceFolder(uri.fsPath);

            if (cwd) {
              const impactedSources = impacted
                .filter(obj => obj.relativePath)
                .map(obj => path.join(cwd, obj.relativePath!));

              console.log(`Impacted sources:  ${impactedSources.join(`, `)}`);

              return Promise.allSettled(impactedSources.map(sourcePath => targets.handlePath(sourcePath)));
            }
          }
        }
      }
    }
  }

  static getDepsFor(workspaceUri: string, ileObject: ILEObject) {
    const targets = this.getTargetsForWorkspaceUri(workspaceUri);

    if (targets) {
      const target = targets.getDep(ileObject);
      if (target) {
        return target.deps;
      }
    }

    return [];
  }

  static getResolvedObjects(workspaceUri: string) {
    const targets = this.getTargetsForWorkspaceUri(workspaceUri);

    if (targets) {
      return targets.getResolvedObjects();
    }

    return [];
  }

  static getLogs(workspaceUri: string, ileObject: ILEObject) {
    const targets = this.getTargetsForWorkspaceUri(workspaceUri);

    if (targets && ileObject.relativePath) {
      const logs = targets.logger.getLogsFor(ileObject.relativePath);
      return logs;
    }

    return [];
  }
}

export function getFiles(cwd: string, globPath: string): string[] {
	return glob.sync(globPath, {
		cwd,
		absolute: true,
		nocase: true,
	});
}