

import glob from "glob";
import { existsSync, readFileSync, writeFileSync } from 'fs';

import { ILEObject, Targets } from './targets';
import { MakeProject } from './builders/make';
import path from 'path';
import { BuildFiles, cliSettings, error, infoOut, renameFiles, replaceIncludes, warningOut } from './cli';
import { BobProject } from "./builders/bob";
import { ImpactMarkdown } from "./builders/imd";
import { allExtensions } from "./extensions";

const isCli = process.argv.length >= 2 && process.argv[1].endsWith(`so`);

if (isCli || process.env.VSCODE_INSPECTOR_OPTIONS) {
	cliSettings.cliMode = true;
	main();
}

async function main() {
	const parms = process.argv.slice(2);
	let cwd = process.cwd();
	let scanGlob = `**/*.{${allExtensions.join(`,`)},${allExtensions.map(e => e.toUpperCase()).join(`,`)}}`;

	let files: string[] = [];

	for (let i = 0; i < parms.length; i++) {
		switch (parms[i]) {
			case `-g`:
			case `--glob`:
				scanGlob = parms[i + 1];
				i++;
				break;

			case `-d`:
			case `--cwd`:
				cwd = parms[i + 1];
				i++;
				break;

			case `-i`:
			case `--init`:
				initProject(cwd);
				process.exit(0);

			case `-f`:
			case `--files`:
				cliSettings.fileList = true;
				break;

			case `-ar`:
				warningOut(`Auto rename enabled. No makefile will be generated.`)
				cliSettings.autoRename = true;
				break;

			case `-fi`:
				warningOut(`Include fix enabled enabled.`)
				cliSettings.fixIncludes = true;
				break;

			case `--verbose`:
				cliSettings.infoMessages = true;
				break;

			case `-bf`:
				cliSettings.buildFile = parms[i + 1] as BuildFiles;
				i++;
				break;

			case `-l`:
				cliSettings.lookupMode = true;
				cliSettings.lookupFiles = [];
				break;

			case `-h`:
			case `--help`:
				console.log(``);
				console.log(`\t-i`);
				console.log(`\t--init\t\tAdd default compile options to 'iproj.json' file`);
				console.log(`\t\t\tShould be used for project initialisation or to customize compile commands.`);
				console.log(`\t\t\tThis is specific to using '-bf' with the 'make' option.`);
				console.log(``);
				console.log(`\t-d <dir>`)
				console.log(`\t--cwd <dir>\tTo see the directory of where source code lives.`);
				console.log(`\t\t\tThe default is the current working directory.`);
				console.log(``);
				console.log(`\t-f <relativePath>`)
				console.log(`\t--files <relativePath>\tTo only index specific files.`);
				console.log(`\t\t\tThis option should be used to avoid re-indexing entire projects.`);
				console.log(``);
				console.log(`\t-l <obj>\tPrint an object and what depends on it.`);
				console.log(`\t\t\tExample: -l EMPS.FILE`);
				console.log(`\t\t\tExample: -l qddssrc/emps.dspf`);
				console.log(``);
				console.log(`\t-bf make|bob|imd|json\tCreate build files of a specific format`);
				console.log(`\t\t\tExample: -bf make`);
				console.log(``);
				console.log(`\t-ar\t\tRun the auto-rename process after scanning all code`);
				console.log(`\t\t\tEnsure it is run inside of source control.`);
				console.log(`\t\t\tRename program sources to have the '.pgm.' attribute in the name`);
				console.log(`\t\t\tRename RPGLE copybooks found (based on include statements) to be '.rpgleinc'`);
				console.log(``);
				console.log(`\t-fi\t\tFix includes for RPGLE sources`);
				console.log(`\t\t\tEnsure it is run inside of source control.`);
				console.log(`\t\t\tFixes all include/copy directives to use local source if available`);
				console.log(``);
				console.log(`\t--verbose\tPrint all the detail.`);
				console.log(``);
				process.exit(0);
				break;

			default:
				if (cliSettings.lookupMode) {
					cliSettings.lookupFiles.push(parms[i]);
				} else
					if (cliSettings.fileList) {
						files.push(path.join(cwd, parms[i]));

					} else {
						console.log(`Unknown parameter: ${parms[i]}`);
						process.exit(1);
					}
				break;
		}
	}

	const targets = new Targets(cwd);

	targets.setSuggestions({
		includes: cliSettings.fixIncludes,
		renames: cliSettings.autoRename
	});

	try {
		if (files.length === 0) {
			files = getFiles(cwd, scanGlob);
			infoOut(`Found ${files.length} file${files.length === 1 ? `` : `s`} with '${scanGlob}'.`);
		} else {
			infoOut(`Using ${files.length} file${files.length === 1 ? `` : `s`} provided by parameter.`);
		}
		infoOut(``);
	} catch (e) {
		error(e.message || e);
		process.exit(1);
	}

	for (const filePath of files) {
		const result = await targets.handlePath(filePath);
		if (!result) {
			error(`Report this issue to us with an example: github.com/halcyon-tech/vscode-rpgle/issues`);
		}
	}

	let exitEarly = false;

	if (cliSettings.autoRename) {
		renameFiles(targets.logger);
		exitEarly = true;
	}

	if (cliSettings.fixIncludes) {
		replaceIncludes(targets.logger);
		exitEarly = true;
	}

	if (exitEarly) {
		process.exit();
	}

	targets.resolveBinder();
	
	if (cliSettings.lookupMode && cliSettings.buildFile === `none`) {
		for (const value of cliSettings.lookupFiles) {
			listDeps(cwd, targets, value);
		}
	}


	switch (cliSettings.buildFile) {
		case `bob`:
			const bobProj = new BobProject(targets);
			const outFiles = bobProj.createRules();

			for (const filePath in outFiles) {
				writeFileSync(path.join(cwd, filePath), outFiles[filePath]);
			}

			break;
		case `make`:
			const makeProj = new MakeProject(cwd, targets);
			writeFileSync(path.join(cwd, `makefile`), makeProj.getMakefile().join(`\n`));
			break;
		case `imd`:
			const markdown = new ImpactMarkdown(cwd, targets, cliSettings.lookupFiles);
			writeFileSync(path.join(cwd, `impact.md`), markdown.getContent().join(`\n`));
			break;
		case `json`:
			const outJson = {
				targets: targets.getDeps(),
				resolved: targets.getResolvedObjects(),
				exports: targets.getExports()
			};

			writeFileSync(path.join(cwd, `sourceorbit.json`), JSON.stringify(outJson, null, 2));
			break;
	}
}

function getFiles(cwd: string, globPath: string): string[] {
	return glob.sync(globPath, {
		cwd,
		absolute: true,
		nocase: true,
	});
}

function initProject(cwd) {
	console.log(`Initialising in ${cwd}`);

	const iprojPath = path.join(cwd, `iproj.json`);

	let base = {};
	const iprojExists = existsSync(iprojPath);

	if (iprojExists) {
		try {
			console.log(`iproj.json already exists. Will append new properties.`);
			base = JSON.parse(readFileSync(iprojPath, { encoding: `utf-8` }));
		} catch (e) {
			error(`Failed to parse iproj.json. Aborting`);
			process.exit(1);
		}
	}

	base = {
		...base,
		...MakeProject.getDefaultSettings()
	};

	writeFileSync(iprojPath, JSON.stringify(base, null, 2));

	console.log(`Written to ${iprojPath}`);
}

/**
 * @param query Can be object (ABCD.PGM) or relative path
 */
function listDeps(cwd: string, targets: Targets, query: string) {
	const fullPath = path.join(cwd, query);

	let [name, type] = query.split(`.`);

	if (name) name = name.toUpperCase();
	if (type) type = type.toUpperCase();

	let theObject = targets.getResolvedObjects().find(o => o.name === name && o.type === type);

	if (!theObject) {
		theObject = targets.resolveObject(fullPath);
	}

	const allDeps = targets.getDeps();
	let currentTree: ILEObject[] = [];

	function lookupObject(ileObject: ILEObject) {
		console.log(`${''.padEnd(currentTree.length, `\t`)}${ileObject.name}.${ileObject.type} (${ileObject.relativePath || `no source`})`);

		currentTree.push(ileObject);

		for (const target of allDeps) {
			const containsLookup = target.deps.some(d => d.name === ileObject.name && d.type === ileObject.type);
			const circular = currentTree.some(d => d.name === target.name && d.type === target.type);

			if (containsLookup && !circular) {
				lookupObject(target);
			}
		}

		currentTree.pop();
	}

	lookupObject(theObject);
}

export { Targets } from './targets';
export { MakeProject } from './builders/make';
export { BobProject } from "./builders/bob";
export { allExtensions } from "./extensions";