import { NodeParserMap } from "./node-parser-map";

/**
 * Plugin interface for extending Klee with custom node parsers.
 *
 * To create a plugin create a new folder in the plugins directory and add a plugin 
 * entry point. The entry point calss file needs to end with .plugin.ts
 * ```typescript
 *
 * import { YourParser, YourSecondParser } from "./your-parsers";
 * import { YourThirdParser } from "./your-third-parser";
 *
 * export const MyPlugin: NodeParserPlugin = {
 *     getNodeParsers() {
 *         return {
 *             ["/Script/CustomClass.MyCustomNode"]: () => new YourParser(),
 *             ["/Script/CustomClass.MyCustomSecondNode"]: () => new YourSecondParser(),
 *             ["/Script/CustomClass.MyCustomThirdNode"]: () => new YourThirdParser(),
 *         }
 *     },
 *     getFriendlyNodeNames() {
 *         return {
 *             'K2_SetTimerDelegate': 'Set Timer by Event',
 *             'K2_SetTimer': 'Set Timer by Function Name',
 *         };
 *     }
 * };
 * ```
 */
export interface NodeParserPlugin {
    getNodeParsers?: () => NodeParserMap;
    getFriendlyNodeNames?: () => { [name: string]: string };
}