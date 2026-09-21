import { UnrealNodeClass } from "../data/classes/unreal-node-class";
import { NodeParser } from "./node.parser";

export type NodeParserMap = { [key in UnrealNodeClass | string]: () => NodeParser }