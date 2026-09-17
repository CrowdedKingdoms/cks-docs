import { HeadedNodeControl } from "../src/controls/nodes/headed-node-control";
import { NodeControl } from "../src/controls/nodes/node.control";
import { IconLibrary } from "../src/controls/utils/icon-library";
import { Constants } from "../src/constants";
import { NodeParserPlugin } from "../src/parser/node-parser-plugin";
import { NodeParser } from "../src/parser/node.parser";
import { ParsingNodeData } from "../src/parser/parsing-node-data";
import { CallFunctionNodeParser } from "../src/parser/node-parsers/call-function-node.parser";
import { CustomEventNodeParser } from "../src/parser/node-parsers/custom-event-node.parser";
import { CallFunctionNode } from "../src/data/nodes/call-function.node";
import { insertSpacesBetweenCapitalizedWords } from "../src/utils/text-utils";
import { CrowdyFunctionNames, CrowdyFunctionNamesByClass } from "./crowdy-names.generated";

// What the Unreal editor shows that the clipboard text does not carry. The text names a function by
// its C++ member name, so a DisplayName meta (GetFloat is "Get Model Attribute (Float)") is only
// known through the generated table; the Crowdy replication subtitle under a custom event is drawn
// by the SDK's node widget from the node's MetaDataMap; an Apply Crowdy Effect node appends its
// effect's name; a latent action node is titled after its factory function. The check in
// scripts/blueprint-component.spec.ts compares every rendered title with the editor's own.

// Engine functions the snippets use whose editor title is a DisplayName, not the member name.
const ENGINE_FUNCTION_NAMES: { [memberName: string]: string } = {
    "Conv_DoubleToString": "To String (Float)",
    "Conv_FloatToString": "To String (Float)",
    "Conv_IntToString": "To String (Integer)",
    "Conv_Int64ToString": "To String (Integer64)",
    "Conv_BoolToString": "To String (Boolean)",
    "Conv_NameToString": "To String (Name)",
    "Conv_GuidToString": "To String (Guid)",
    "Conv_VectorToString": "To String (Vector)",
    "Conv_StringToText": "To Text (String)",
};

const CROWDY_NODE_TITLES: { [classPath: string]: string } = {
    "/Script/CrowdyNodes.CrowdyK2Node_ApplyEffect": "Apply Crowdy Effect",
    "/Script/CrowdyNodes.CrowdyK2Node_ApplyEffectToContainer": "Apply Crowdy Effect to Model (by Id)",
    "/Script/CrowdyNodes.CrowdyK2Node_ApplyEffectFireAndForget": "Apply Crowdy Effect (Fire and Forget)",
};

const ASYNC_NODE_CLASSES = [
    "/Script/BlueprintGraph.K2Node_AsyncAction",
    "/Script/BlueprintGraph.K2Node_BaseAsyncTask",
];

// The two lines the editor draws under a custom event marked Crowdy Replicates, by recipient.
function crowdySubtitle(recipient: string): string[] {
    switch (recipient) {
        case "OwningClient": return ["Crowdy Owning Client", "Executes Locally Only"];
        case "Host": return ["Crowdy Host", "Executes on Host"];
        case "Multicast": return ["Crowdy Multicast", "Everyone on the Channel"];
        default: return ["Crowdy Spatial Multicast", "Everyone In Range"];
    }
}

function displayName(className: string | undefined, memberName: string): string {
    const qualified = className ? CrowdyFunctionNamesByClass[`${className}::${memberName}`] : undefined;
    const known = qualified || CrowdyFunctionNames[memberName] || ENGINE_FUNCTION_NAMES[memberName];
    return known || insertSpacesBetweenCapitalizedWords(memberName);
}

// The asset name inside a pin's DefaultObject, e.g. FX_Heal out of "/Game/Effects/FX_Heal.FX_Heal".
function pinDefaultObjectName(lines: string[], pinName: string): string | undefined {
    const line = lines.find(l => l.includes(`PinName="${pinName}"`) && l.includes("DefaultObject="));
    const match = line && /DefaultObject="[^"]*?\.([A-Za-z0-9_]+)'?"/.exec(line);
    return match ? match[1] : undefined;
}

// A call node titled by its display name; the conversion nodes keep their full title rather than the
// compact form the string-library parser draws. The title is set inside the FunctionReference property
// handler, because the header label is built from node.title as soon as the properties are parsed;
// a title set after parse() changes the data but not the drawing.
class CrowdyCallFunctionParser extends CallFunctionNodeParser {
    constructor() {
        super();
        const base = this._propertyParsers["FunctionReference"];
        this._propertyParsers["FunctionReference"] = (node: CallFunctionNode, value: string) => {
            base(node, value);
            if (node.functionReference?.memberName) {
                node.title = displayName(node.functionReference.memberParent?.className, node.functionReference.memberName);
            }
        };
    }

    public parse(data: ParsingNodeData): NodeControl {
        const ref = data.lines.find(l => l.trim().startsWith("FunctionReference="));
        const member = ref && /MemberName="([^"]+)"/.exec(ref);
        if (member && ENGINE_FUNCTION_NAMES[member[1]]) {
            const at = data.unparsedLines.findIndex(l => l.trim().startsWith("FunctionReference="));
            if (at >= 0) {
                data.unparsedLines[at] = data.unparsedLines[at].replace("KismetStringLibrary", "KismetStringLibraryNamed");
            }
        }
        return super.parse(data);
    }
}

class CrowdyCustomEventParser extends CustomEventNodeParser {
    public parse(data: ParsingNodeData): NodeControl {
        const meta = data.lines.find(l => l.trim().startsWith("MetaData="));
        const keys: { [key: string]: string } = {};
        for (const m of (meta || "").matchAll(/\("([^"]+)",\s*"([^"]*)"\)/g)) {
            keys[m[1]] = m[2];
        }
        if ("CrowdyReplicates" in keys || "CrowdyReplicate" in keys) {
            for (const text of crowdySubtitle(keys["CrowdyRecipient"] || "")) {
                data.node.subTitles.push({ text });
            }
        }
        return super.parse(data);
    }
}

class CrowdyAsyncActionParser extends NodeParser {
    constructor() {
        super({});
    }

    public parse(data: ParsingNodeData): NodeControl {
        const factory = data.lines.find(l => l.trim().startsWith("ProxyFactoryFunctionName="));
        const name = factory && /="([^"]+)"/.exec(factory);
        const owner = data.lines.find(l => l.trim().startsWith("ProxyFactoryClass="));
        const ownerClass = owner && /\.([A-Za-z0-9_]+)'"?$/.exec(owner.trim());
        data.node.title = name ? displayName(ownerClass ? ownerClass[1] : undefined, name[1]) : data.node.title;
        data.node.backgroundColor = Constants.DEFAULT_FUNC_BACKGROUND_COLOR;
        return new HeadedNodeControl(data.node, IconLibrary.FUNCTION);
    }
}

class CrowdyEffectNodeParser extends NodeParser {
    constructor() {
        super({});
    }

    public parse(data: ParsingNodeData): NodeControl {
        const base = CROWDY_NODE_TITLES[data.node.class] || data.node.title;
        const effect = pinDefaultObjectName(data.lines, "Effect");
        data.node.title = effect ? `${base}: ${effect}` : base;
        data.node.backgroundColor = Constants.DEFAULT_FUNC_BACKGROUND_COLOR;
        return new HeadedNodeControl(data.node, IconLibrary.FUNCTION);
    }
}

export const CrowdyPlugin: NodeParserPlugin = {
    getNodeParsers() {
        const parsers: { [classPath: string]: () => NodeParser } = {
            "/Script/BlueprintGraph.K2Node_CallFunction": () => new CrowdyCallFunctionParser(),
            "/Script/BlueprintGraph.K2Node_CustomEvent": () => new CrowdyCustomEventParser(),
        };
        for (const classPath of ASYNC_NODE_CLASSES) {
            parsers[classPath] = () => new CrowdyAsyncActionParser();
        }
        for (const classPath of Object.keys(CROWDY_NODE_TITLES)) {
            parsers[classPath] = () => new CrowdyEffectNodeParser();
        }
        return parsers;
    },
};
