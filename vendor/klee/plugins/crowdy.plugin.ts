import { FoldableHeadedNodeControl } from "../src/controls/nodes/foldable-headed-node.control";
import { HeadedNodeControl } from "../src/controls/nodes/headed-node-control";
import { HeadlessNodeControl } from "../src/controls/nodes/headless-node-control";
import { NodeControl } from "../src/controls/nodes/node.control";
import { IconLibrary } from "../src/controls/utils/icon-library";
import { Constants } from "../src/constants";
import { NodeParserPlugin } from "../src/parser/node-parser-plugin";
import { Node } from "../src/data/nodes/node";
import { NodeParser } from "../src/parser/node.parser";
import { ParsingNodeData } from "../src/parser/parsing-node-data";
import { CallFunctionNodeParser } from "../src/parser/node-parsers/call-function-node.parser";
import { CustomEventNodeParser } from "../src/parser/node-parsers/custom-event-node.parser";
import { StructNodeParser } from "../src/parser/node-parsers/struct-node.parser";
import { SwitchEnumNodeParser } from "../src/parser/node-parsers/switch-enum-node.parser";
import { SwitchEnumNode } from "../src/data/nodes/switch-enum.node";
import { CallFunctionNode } from "../src/data/nodes/call-function.node";
import { StructNode } from "../src/data/nodes/struct.node";
import { PinProperty } from "../src/data/pin/pin-property";
import { PinCategory } from "../src/data/pin/pin-category";
import { BlueprintParserUtils } from "../src/parser/blueprint-parser-utils";
import { insertSpacesBetweenCapitalizedWords } from "../src/utils/text-utils";
import { CrowdyFunctionNames, CrowdyFunctionNamesByClass } from "./crowdy-names.generated";

// What the Unreal editor shows that the clipboard text does not carry. The text names a function by
// its C++ member name, so a DisplayName meta (GetFloat is "Get Model Attribute (Float)") is only
// known through the generated table; the Crowdy replication subtitle under a custom event is drawn
// by the SDK's node widget from the node's MetaDataMap; a latent action node is titled after its
// factory function; a Server Object node is titled from its variable or function and its definition asset. The check in
// scripts/blueprint-component.spec.ts compares every rendered title with the editor's own.

// Engine functions the snippets use whose editor title is a DisplayName, not the member name.
const ENGINE_FUNCTION_NAMES: { [memberName: string]: string } = {
    "Conv_StringToText": "To Text (String)",
    "Conv_IntToText": "To Text (Integer)",
    "BuildString_Int": "Build String (Integer)",
    "GetTransform": "Get Actor Transform",
    "RemoveFromParent": "Remove from Parent",
    "EqualEqual_StrStr": "===",
};

// Engine functions whose display name differs by owning class, keyed "Class::Member" as the text names them.
const ENGINE_FUNCTION_NAMES_BY_CLASS: { [classAndMember: string]: string } = {
    "TextBlock::SetText": "SetText (Text)",
};

// Classes the editor names by a DisplayName in a "Target is" subtitle, not by their C++ name.
const CLASS_DISPLAY_NAMES: { [className: string]: string } = {
    "TextBlock": "Text",
    "CrowdyServerObjectComponent": "Crowdy Server Object",
};

// The string and math conversions the editor draws as a compact node titled with a bullet; the text-library ones
// (To Text (Integer)) keep a full header.
const COMPACT_CONVERSION = /MemberParent="[^"]*Kismet(String|Math)Library'",MemberName="Conv_/;

// Server Object nodes are titled from the definition asset and the member they name, both properties in the text.
const SERVER_OBJECT_NODES: { [classPath: string]: { title: (member: string, asset: string) => string; pure: boolean } } = {
    "/Script/CrowdyExecNodes.CrowdyK2Node_GetServerVariable": { title: (m, a) => `Get ${m} (${a})`, pure: true },
    "/Script/CrowdyExecNodes.CrowdyK2Node_ServerVariableChanged": { title: (m, a) => `On ${m} Changed (${a})`, pure: false },
    "/Script/CrowdyExecNodes.CrowdyK2Node_CallServerFunction": { title: (m, a) => `Call ${m} (${a})`, pure: false },
    "/Script/CrowdyExecNodes.CrowdyK2Node_GetServerState": { title: (_m, a) => `Get Server State (${a})`, pure: true },
    "/Script/CrowdyExecNodes.CrowdyK2Node_ServerMessageReceived": { title: (m, a) => `On ${m} Received (${a})`, pure: false },
};

// Delegates whose editor name is a DisplayName rather than the property name, keyed "Class::Member" as the text names them.
const DELEGATE_DISPLAY_NAMES: { [classAndMember: string]: string } = {
    "CrowdyServerObject::RecordsUpdated": "On Records Updated",
};
const CALL_SERVER_FUNCTION_NODE = "/Script/CrowdyExecNodes.CrowdyK2Node_CallServerFunction";

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
    const qualified = className
        ? CrowdyFunctionNamesByClass[`${className}::${memberName}`] || ENGINE_FUNCTION_NAMES_BY_CLASS[`${className}::${memberName}`]
        : undefined;
    const known = qualified || CrowdyFunctionNames[memberName] || ENGINE_FUNCTION_NAMES[memberName];
    return known || insertSpacesBetweenCapitalizedWords(memberName);
}

// A call node titled by its display name; the conversion nodes keep their full title rather than the
// compact form the string-library parser draws. The title is set inside the FunctionReference property
// handler, because the header label is built from node.title as soon as the properties are parsed;
// a title set after parse() changes the data but not the drawing.
class CrowdyCallFunctionParser extends CallFunctionNodeParser {
    constructor() {
        super();
        const base = this._propertyParsers.get("FunctionReference");
        this._propertyParsers.set("FunctionReference", (node: CallFunctionNode, value: string) => {
            base(node, value);
            if (node.functionReference?.memberName) {
                node.title = displayName(node.functionReference.memberParent?.className, node.functionReference.memberName);
            }
            // A call on the Blueprint's own class carries no MemberParent; the editor still names the class in the
            // subtitle, and the self pin's type is where the text carries it.
            if (node.functionReference?.selfContext) {
                const selfPin = node.customProperties.find(p => (p as PinProperty)?.name?.toLowerCase() === "self") as PinProperty | undefined;
                const className = referencedClassName(selfPin?.subCategoryObject?.class);
                const subtitle = node.subTitles.find(s => s.text === "Target is self context");
                if (className && subtitle) {
                    subtitle.text = `Target is ${classDisplayName(className)}`;
                }
                return;
            }
            // Upstream splits the target class with a lower-to-upper rule only, so an acronym run stays glued to
            // the word after it ("Crowdy SDKSubsystem"); the editor breaks the run before its last capital.
            const parentName = node.functionReference?.memberParent?.className;
            const targetSubtitle = parentName && node.subTitles.find(s => s.text.startsWith("Target is "));
            if (parentName && targetSubtitle) {
                targetSubtitle.text = `Target is ${classDisplayName(parentName)}`;
            }
        });
    }

    public parse(data: ParsingNodeData): NodeControl {
        const ref = data.lines.find(l => l.trim().startsWith("FunctionReference="));
        if (ref && COMPACT_CONVERSION.test(ref)) {
            this.parseProperties(data);
            data.node.title = "•";
            data.node.subTitles = [];
            BlueprintParserUtils.hidePinNames(data.node.customProperties);
            return new HeadlessNodeControl(data.node);
        }
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

// The editor's display form of an identifier: a space before each capital that follows a lower-case letter or a
// digit, and one between an acronym and the word after it (CrowdySDKSubsystem -> Crowdy SDK Subsystem).
function identifierDisplayName(name: string): string {
    return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

function classDisplayName(name: string): string {
    return CLASS_DISPLAY_NAMES[name] || identifierDisplayName(name);
}

// The last path segment of a class reference such as "/Script/CoreUObject.Class'/Script/CrowdyServices.CrowdyChannels'".
function referencedClassName(line: string | undefined): string | undefined {
    const match = line && /\.([A-Za-z0-9_]+)'"?\s*$/.exec(line.trim());
    return match ? match[1] : undefined;
}

class CrowdyCustomEventParser extends CustomEventNodeParser {
    public parse(data: ParsingNodeData): NodeControl {
        // The export carries each parameter twice: as the drawn "Pin" and as the "UserDefinedPin" declaration
        // behind it. The generic pass turns both into pins; the declaration has no PinId, so it is dropped here.
        data.node.customProperties = data.node.customProperties.filter(
            p => !(p instanceof PinProperty) || (p as PinProperty).id !== undefined);
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

// Get <World/Game Instance> Subsystem: a pure getter the editor titles with the subsystem class's display name.
class CrowdyGetSubsystemParser extends NodeParser {
    constructor() {
        super({});
    }

    public parse(data: ParsingNodeData): NodeControl {
        const className = referencedClassName(data.lines.find(l => l.trim().startsWith("CustomClass=")));
        data.node.title = className ? identifierDisplayName(className) : data.node.title;
        data.node.backgroundColor = Constants.DEFAULT_FUNC_PURE_BACKGROUND_COLOR;
        return new HeadedNodeControl(data.node, IconLibrary.FUNCTION);
    }
}

// Bind Event to <Delegate>: an Add Delegate node named after the delegate property it binds.
class CrowdyAddDelegateParser extends NodeParser {
    constructor() {
        super({});
    }

    public parse(data: ParsingNodeData): NodeControl {
        const ref = data.lines.find(l => l.trim().startsWith("DelegateReference="));
        const member = ref && /MemberName="([^"]+)"/.exec(ref);
        const owner = classShortName(ref ? /MemberParent="([^"]*)"/.exec(ref)?.[1] : undefined);
        const named = member && owner ? DELEGATE_DISPLAY_NAMES[`${owner}::${member[1]}`] : undefined;
        data.node.title = member ? `Bind Event to ${named || identifierDisplayName(member[1])}` : data.node.title;
        data.node.backgroundColor = Constants.DEFAULT_FUNC_BACKGROUND_COLOR;
        return new HeadedNodeControl(data.node, IconLibrary.FUNCTION);
    }
}

// Make Map: upstream Klee knows Make Array but not its map sibling; the editor titles it "Make Map".
class CrowdyMakeMapParser extends NodeParser {
    constructor() {
        super({});
    }

    public parse(data: ParsingNodeData): NodeControl {
        data.node.title = "Make Map";
        data.node.backgroundColor = Constants.DEFAULT_FUNC_PURE_BACKGROUND_COLOR;
        return new HeadedNodeControl(data.node, IconLibrary.MAKE_ARRAY);
    }
}

// Break <Struct>: upstream titles the node with the struct's C++ name ("Break CrowdyTeam"); the editor draws the
// struct's display name ("Break Crowdy Team").
class CrowdyBreakStructParser extends StructNodeParser {
    public parse(data: ParsingNodeData): NodeControl {
        this.parseProperties(data);
        const structType = (data.node as StructNode).structType;
        data.node.backgroundColor = Constants.DARK_BLUE;
        data.node.title = `Break ${identifierDisplayName(structType?.className || "")}`.trim();
        return new HeadedNodeControl(data.node, IconLibrary.BREAK_STRUCT);
    }
}

// Switch on <Enum>: the text gives the enum as /Script/CoreUObject.Enum'/Script/Module.EName', from which upstream reads
// the class ("Switch on Enum"); the editor draws the enum's own name ("Switch on ECrowdyKitDirectorEventType").
class CrowdySwitchEnumParser extends SwitchEnumNodeParser {
    public parse(data: ParsingNodeData): NodeControl {
        this.parseProperties(data);
        const path = (data.node as SwitchEnumNode).enum || "";
        data.node.title = `Switch on ${path.replace(/'$/, "").split(/[.']/).pop() || ""}`.trim();
        data.node.backgroundColor = Constants.LIGHT_GREEN;
        return new FoldableHeadedNodeControl(data.node, IconLibrary.SWITCH);
    }
}

// Enum to String: a pure node with a full header (its sibling Enum to Name is the compact one).
class CrowdyEnumToStringParser extends NodeParser {
    constructor() {
        super({});
    }

    public parse(data: ParsingNodeData): NodeControl {
        data.node.title = "Enum to String";
        data.node.backgroundColor = Constants.DEFAULT_FUNC_PURE_BACKGROUND_COLOR;
        return new HeadedNodeControl(data.node, IconLibrary.FUNCTION);
    }
}

// Equal (Enum): the editor draws it as a compact node titled "==".
class CrowdyEnumEqualityParser extends NodeParser {
    constructor() {
        super({});
    }

    public parse(data: ParsingNodeData): NodeControl {
        this.parseProperties(data);
        data.node.title = "==";
        data.node.subTitles = [];
        BlueprintParserUtils.hidePinNames(data.node.customProperties);
        return new HeadlessNodeControl(data.node);
    }
}

// Get <Variable>, On <Variable> Changed, Call <Function> and Get Server State: the title names the variable or function
// and the definition asset. An exec pin shows its name unless it is the plain execute or then, as the editor does,
// so Bind, Changed, On Success and On Failed are labelled.
class CrowdyServerObjectNodeParser extends NodeParser {
    constructor() {
        super({});
    }

    public parse(data: ParsingNodeData): NodeControl {
        const spec = SERVER_OBJECT_NODES[data.node.class];
        const asset = referencedClassName(data.lines.find(l => l.trim().startsWith("Definition=")));
        const memberLine = data.lines.find(l => l.trim().startsWith("Member="));
        const member = memberLine ? memberLine.trim().replace(/^Member=/, "").replace(/"/g, "") : "";
        const generic = data.node.class === CALL_SERVER_FUNCTION_NODE && (!asset || !member);
        data.node.title = generic ? "Call Server Function" : spec.title(member, asset || "None");
        data.node.subTitles = [];
        data.node.backgroundColor = spec.pure ? Constants.DEFAULT_FUNC_PURE_BACKGROUND_COLOR : Constants.DEFAULT_FUNC_BACKGROUND_COLOR;
        data.node.latent = data.node.class === CALL_SERVER_FUNCTION_NODE;
        hidePlainExecNames(data.node);
        return data.node.advancedPinDisplay !== undefined ? new FoldableHeadedNodeControl(data.node) : new HeadedNodeControl(data.node);
    }
}

function hidePlainExecNames(node: Node): void {
    for (const property of node.customProperties) {
        const pin = property as PinProperty;
        if (!(property instanceof PinProperty) || pin.category !== PinCategory.exec) {
            continue;
        }
        const name = (pin.name || "").toLowerCase();
        pin.hideName = !pin.friendlyName && (name === "execute" || name === "then");
    }
}

// The upstream pass hides an exec name when it is the only one of its direction; these nodes name every exec pin.
function showExecNames(node: Node): void {
    for (const property of node.customProperties) {
        if (property instanceof PinProperty && property.category === PinCategory.exec) {
            property.hideName = false;
        }
    }
}

// The short name of a class reference ("/Script/CoreUObject.Class'/Script/Mod.Type'", "/Game/Dir/BP_Thing.BP_Thing_C").
function classShortName(reference: string | undefined): string | undefined {
    const quoted = reference && /'([^']*)'/.exec(reference);
    const path = quoted ? quoted[1] : reference;
    const name = path && path.slice(Math.max(path.lastIndexOf("."), path.lastIndexOf("/")) + 1).replace(/_C$/, "");
    return name && name !== "None" ? name : undefined;
}

// EventReference carries the event's function name and its owner class; either can be absent.
function readEventReference(lines: string[]): { event?: string; className?: string } {
    const line = lines.find(l => l.trim().startsWith("EventReference="));
    const member = line && /MemberName="([^"]+)"/.exec(line);
    const parent = line && /MemberParent="([^"]*)"/.exec(line);
    const event = member ? member[1].replace(/_Implementation$/, "") : undefined;
    return { event: event && event !== "None" ? event : undefined, className: classShortName(parent ? parent[1] : undefined) };
}

// The class an entity node targets, from the DefaultObject of its "Crowdy Mass Entity Class" pin.
function readEntityClassPin(lines: string[]): string | undefined {
    for (const line of lines) {
        const pinName = line.trim().startsWith("CustomProperties Pin") && /PinName="([^"]*)"/.exec(line);
        if (!pinName || pinName[1].replace(/\s/g, "") !== "CrowdyMassEntityClass") {
            continue;
        }
        const object = /DefaultObject="([^"]*)"/.exec(line);
        return classShortName(object ? object[1] : undefined);
    }
    return undefined;
}

// Call/Receive <Event> on Entity: titled from the event name in EventReference, the owner class in the subtitle.
// Receive draws its Bind, Unbind, Then and On Event labels; Call keeps the plain execute and then unlabelled.
class CrowdyEntityEventNodeParser extends NodeParser {
    private readonly _verb: string;
    private readonly _labelledExec: boolean;

    constructor(verb: string, labelledExec: boolean) {
        super({});
        this._verb = verb;
        this._labelledExec = labelledExec;
    }

    public parse(data: ParsingNodeData): NodeControl {
        const reference = readEventReference(data.lines);
        data.node.title = `${this._verb} ${reference.event || "Crowdy Event"} on Entity`;
        data.node.subTitles = reference.className ? [{ text: reference.className }] : [];
        data.node.backgroundColor = Constants.DEFAULT_FUNC_BACKGROUND_COLOR;
        if (this._labelledExec) {
            showExecNames(data.node);
        } else {
            hidePlainExecNames(data.node);
        }
        return data.node.advancedPinDisplay !== undefined ? new FoldableHeadedNodeControl(data.node) : new HeadedNodeControl(data.node);
    }
}

class CrowdyReceiveServerValuesChangedParser extends NodeParser {
    constructor() {
        super({});
    }

    public parse(data: ParsingNodeData): NodeControl {
        const className = readEntityClassPin(data.lines);
        data.node.title = "Receive Server Values Changed on Entity";
        data.node.subTitles = className ? [{ text: className }] : [];
        data.node.backgroundColor = Constants.DEFAULT_FUNC_BACKGROUND_COLOR;
        showExecNames(data.node);
        return data.node.advancedPinDisplay !== undefined ? new FoldableHeadedNodeControl(data.node) : new HeadedNodeControl(data.node);
    }
}

export const CrowdyPlugin: NodeParserPlugin = {
    getNodeParsers() {
        const parsers: { [classPath: string]: () => NodeParser } = {
            "/Script/BlueprintGraph.K2Node_CallFunction": () => new CrowdyCallFunctionParser(),
            "/Script/BlueprintGraph.K2Node_CustomEvent": () => new CrowdyCustomEventParser(),
            "/Script/BlueprintGraph.K2Node_GetSubsystem": () => new CrowdyGetSubsystemParser(),
            "/Script/BlueprintGraph.K2Node_AddDelegate": () => new CrowdyAddDelegateParser(),
            "/Script/BlueprintGraph.K2Node_MakeMap": () => new CrowdyMakeMapParser(),
            "/Script/BlueprintGraph.K2Node_BreakStruct": () => new CrowdyBreakStructParser(),
            "/Script/BlueprintGraph.K2Node_GetEnumeratorNameAsString": () => new CrowdyEnumToStringParser(),
            "/Script/BlueprintGraph.K2Node_EnumEquality": () => new CrowdyEnumEqualityParser(),
            "/Script/BlueprintGraph.K2Node_SwitchEnum": () => new CrowdySwitchEnumParser(),
            "/Script/CrowdyMassNodes.CrowdyK2Node_CallCrowdyEventOnEntity": () => new CrowdyEntityEventNodeParser("Call", false),
            "/Script/CrowdyMassNodes.CrowdyK2Node_ReceiveCrowdyEventOnEntity": () => new CrowdyEntityEventNodeParser("Receive", true),
            "/Script/CrowdyMassNodes.CrowdyK2Node_ReceiveServerValuesChangedOnEntity": () => new CrowdyReceiveServerValuesChangedParser(),
        };
        for (const classPath of Object.keys(SERVER_OBJECT_NODES)) {
            parsers[classPath] = () => new CrowdyServerObjectNodeParser();
        }
        for (const classPath of ASYNC_NODE_CLASSES) {
            parsers[classPath] = () => new CrowdyAsyncActionParser();
        }
        return parsers;
    },
};
