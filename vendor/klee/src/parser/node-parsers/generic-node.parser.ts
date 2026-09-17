import { CustomPropertyParser } from "../custom-property.parser";
import { NodeParser } from "../node.parser";
import { Node } from "../../data/nodes/node";
import { ParsingNodeData } from "../parsing-node-data";
import { PinPropertyParser } from "../pin-property.parser";
import { CustomProperty } from "../../data/custom-property";
import { NodeControl } from "../../controls/nodes/node.control";
import { HeadedNodeControl } from "../../controls/nodes/headed-node-control";
import { Vector2 } from "../../math/vector2";
import { PinProperty } from "../../data/pin/pin-property";
import { PinDirection } from "../../data/pin/pin-direction";
import { PinCategory } from "../../data/pin/pin-category";
import { StructClass } from "../../controls/utils/color-utils";
import { NodeParserRegistry } from "../node-parser-registry";


export class GenericNodeParser extends NodeParser {

    private readonly _OBJECT_STARTING_TAG = "Begin Object";
    private readonly _customPropertyParsers: {
        [key: string]: () => CustomPropertyParser
    } = {
        "Pin": () => new PinPropertyParser(),
        "UserDefinedPin": () => new PinPropertyParser(),
    }

    private readonly _parserRegistry: NodeParserRegistry;

    constructor(nodeParserRegistry: NodeParserRegistry) {
        super({
            "NodeGuid": (node: Node, v: string) => { node.guid = v; },
            "NodePosX": (node: Node, v: string) => { node.pos.x = Number.parseInt(v); },
            "NodePosY": (node: Node, v: string) => { node.pos.y = Number.parseInt(v); },
            "AdvancedPinDisplay": (node: Node, v: string) => {
                node.advancedPinDisplay = v === "Shown" ? true : false;
            },
            "EnabledState": (node: Node, v: string) => { node.enabledState = v; },
            "ErrorType": (node: Node, v: string) => { node.errorType = Number.parseInt(v); },
            "ErrorMsg": (node: Node, v: string) => { node.errorMsg = v.replace(/["]/g, '').replace(/\\\'/g, '\''); }
        });
        this._parserRegistry = nodeParserRegistry;
    }

    public parse(data: ParsingNodeData): NodeControl {

        const headerLine = data.lines[0];
        const header = this.parseHeader(headerLine);

        data.node = {
            class: header.class,
            name: header.name,
            title: header.name,
            subTitles: [],
            guid: undefined,
            pos: new Vector2(0, 0),
            sourceText: data.lines.join('\n'),
            customProperties: [],
            latent: false,
        }

        this.parseProperties(data);
        this.parseCustomProperties(data);

        const particularImplementation = this._parserRegistry.getParser(data.node.class);
        if(!particularImplementation) {
            console.info(`There is no particular implementation for class ${data.node.class}. Falling back to the generic node class.`);
            return new HeadedNodeControl(data.node);
        }

        const parser: NodeParser = particularImplementation();
        return parser.parse(data);
    }

    private parseHeader(headerLine: string) {

        let options: any = {};

        const parseArgument = (argumentTerm: string) => {
            const keyValuePair = argumentTerm.split("=");
            options[keyValuePair[0]] = keyValuePair[1].replace(/"/g, '');
        }

        const prefixLength = this._OBJECT_STARTING_TAG.length;
        const headerWithoutStartingTag = headerLine.substr(prefixLength, headerLine.length - prefixLength - 1);
        const headerArguments = headerWithoutStartingTag.trim().split(' ') || [];

        headerArguments.forEach(a => parseArgument(a));

        return {
            class: options.Class,
            name: options.Name
        }
    }

    private parseCustomProperties(data: ParsingNodeData): void {
        for (const line of data.unparsedLines) {
            if (line.startsWith('CustomProperties')) {
                const property = this.parseCustomProperty(line, data.node.name);
                if (!property) { continue; }

                data.node.customProperties.push(property);

                if (property instanceof PinProperty) {
                    const pinProp = property as PinProperty;
                    if (pinProp.subCategoryObject && pinProp.subCategoryObject.class === StructClass.LatentActionInfo) {
                        data.node.latent = true;
                    }
                }
            }
        }

        this.hideExecPins(data.node);
    }

    private parseCustomProperty(propertyLine: string, nodeName: string): CustomProperty {

        // Removes "CustomProperties" from property line
        propertyLine = propertyLine.substr("CustomProperties".length).trim();

        let dataset = propertyLine.split(' ');
        let type = dataset.shift();
        let data = dataset.join(' ');

        data = data.trim();
        data = data.substr(1, data.length - 2);

        const propertyParser = this._customPropertyParsers[type];
        if(!propertyParser) {
            console.info(`There is no implementation for custom property type '${type}'. Skip this property`);
            return;
        }

        const customProperty = propertyParser().parse(data, nodeName);

        return customProperty;
    }

    private hideExecPins(node: Node): void {
        let execPinsByDirection: {
            [key in PinDirection]: Array<PinProperty>
        } = {
            [PinDirection.EGPD_Input]: new Array<PinProperty>(),
            [PinDirection.EGPD_Output]: new Array<PinProperty>(),
        }

        // Groups exec pins according to their direction
        for (const property of node.customProperties) {
            if(!(property instanceof PinProperty)) { continue; }
            if(property.direction == undefined || property.category !== PinCategory.exec) { continue; }
            execPinsByDirection[property.direction].push(property);
        }

        // By default, the pin name is displayed...
        // Hides name of the exec pin if it is the only one of its type (pin direction).
        for (const pinDirection in execPinsByDirection) {
            if (Object.prototype.hasOwnProperty.call(execPinsByDirection, pinDirection)) {
                const counter = execPinsByDirection[pinDirection] as Array<PinProperty>;
                if(counter.length == 1) {
                    counter[0].hideName = true;
                }
            }
        }
    }
}
