// ts-patterns engine: @sveltejs/acorn-typescript, the TypeScript plugin for acorn (MIT).
// Generated from this repository's sources by its build; CI rebuilds it and fails if this file
// differs. Readable on purpose, not minified. The licenses are in the notices file at the repository root.
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

var index_exports = {};
__export(index_exports, {
  tsPlugin: () => tsPlugin
});
module.exports = __toCommonJS(index_exports);
var acornNamespace = __toESM(require("./acorn.js"), 1);
var startsExpr = true;
var acornTypeScriptMap = new WeakMap();
function generateAcornTypeScript(_acorn) {
  const acorn = _acorn.Parser.acorn || _acorn;
  let acornTypeScript = acornTypeScriptMap.get(acorn);
  if (!acornTypeScript) {
    let tokenIsLiteralPropertyName = function(token) {
      return token === tokTypes.name || token === tokTypes.string || token === tokTypes.num || keywordTypeValues.includes(token) || tsKwTokenTypeValues.includes(token);
    }, tokenIsKeywordOrIdentifier = function(token) {
      return token === tokTypes.name || keywordTypeValues.includes(token) || tsKwTokenTypeValues.includes(token);
    }, tokenIsIdentifier = function(token) {
      return token === tokTypes.name || tsKwTokenTypeValues.includes(token);
    }, tokenIsTSDeclarationStart = function(token) {
      return token === tsKwTokenType.abstract || token === tsKwTokenType.declare || token === tsKwTokenType.enum || token === tsKwTokenType.module || token === tsKwTokenType.namespace || token === tsKwTokenType.interface || token === tsKwTokenType.type;
    }, tokenIsTSTypeOperator = function(token) {
      return token === tsKwTokenType.keyof || token === tsKwTokenType.readonly || token === tsKwTokenType.unique;
    }, tokenIsTemplate = function(token) {
      return token === tokTypes.invalidTemplate;
    };
    const { tokTypes, keywordTypes } = acorn;
    const keywordTypeValues = Object.values(keywordTypes);
    const tsKwTokenType = generateTsKwTokenType();
    const tsKwTokenTypeValues = Object.values(tsKwTokenType);
    const tsTokenType = generateTsTokenType();
    const tsTokenContext = generateTsTokenContext();
    const tsKeywordsRegExp = new RegExp("^(?:" + Object.keys(tsKwTokenType).join("|") + ")$");
    tsTokenType.jsxTagStart.updateContext = function() {
      this.context.push(tsTokenContext.tc_expr);
      this.context.push(tsTokenContext.tc_oTag);
      this.exprAllowed = false;
    };
    tsTokenType.jsxTagEnd.updateContext = function(prevType) {
      let out = this.context.pop();
      if (out === tsTokenContext.tc_oTag && prevType === tokTypes.slash || out === tsTokenContext.tc_cTag) {
        this.context.pop();
        this.exprAllowed = this.curContext() === tsTokenContext.tc_expr;
      } else {
        this.exprAllowed = true;
      }
    };
    acornTypeScript = {
      tokTypes: {
        ...tsKwTokenType,
        ...tsTokenType
      },
      tokContexts: {
        ...tsTokenContext
      },
      keywordsRegExp: tsKeywordsRegExp,
      tokenIsLiteralPropertyName,
      tokenIsKeywordOrIdentifier,
      tokenIsIdentifier,
      tokenIsTSDeclarationStart,
      tokenIsTSTypeOperator,
      tokenIsTemplate
    };
  }
  return acornTypeScript;
  function kwLike(_name, options = {}) {
    return new acorn.TokenType("name", options);
  }
  function generateTsTokenContext() {
    return {
      tc_oTag: new acorn.TokContext("<tag", false, false),
      tc_cTag: new acorn.TokContext("</tag", false, false),
      tc_expr: new acorn.TokContext("<tag>...</tag>", true, true)
    };
  }
  function generateTsTokenType() {
    return {
      at: new acorn.TokenType("@"),
      jsxName: new acorn.TokenType("jsxName"),
      jsxText: new acorn.TokenType("jsxText", { beforeExpr: true }),
      jsxTagStart: new acorn.TokenType("jsxTagStart", { startsExpr: true }),
      jsxTagEnd: new acorn.TokenType("jsxTagEnd")
    };
  }
  function generateTsKwTokenType() {
    return {
      assert: kwLike("assert", { startsExpr }),
      asserts: kwLike("asserts", { startsExpr }),
      global: kwLike("global", { startsExpr }),
      keyof: kwLike("keyof", { startsExpr }),
      readonly: kwLike("readonly", { startsExpr }),
      unique: kwLike("unique", { startsExpr }),
      abstract: kwLike("abstract", { startsExpr }),
      declare: kwLike("declare", { startsExpr }),
      enum: kwLike("enum", { startsExpr }),
      module: kwLike("module", { startsExpr }),
      namespace: kwLike("namespace", { startsExpr }),
      interface: kwLike("interface", { startsExpr }),
      type: kwLike("type", { startsExpr })
    };
  }
}
var TS_SCOPE_OTHER = 1 << 20;
var TS_SCOPE_TS_MODULE = 1 << 21;
var BIND_KIND_VALUE = 1;
var BIND_KIND_TYPE = 2;
var BIND_SCOPE_VAR = 4;
var BIND_SCOPE_LEXICAL = 8;
var BIND_SCOPE_FUNCTION = 16;
var BIND_FLAGS_NONE = 64;
var BIND_FLAGS_CLASS = 128;
var BIND_FLAGS_TS_ENUM = 256;
var BIND_FLAGS_TS_CONST_ENUM = 512;
var BIND_FLAGS_TS_EXPORT_ONLY = 1024;
var BIND_CLASS = BIND_KIND_VALUE | BIND_KIND_TYPE | BIND_SCOPE_LEXICAL | BIND_FLAGS_CLASS;
var BIND_LEXICAL = BIND_KIND_VALUE | 0 | BIND_SCOPE_LEXICAL | 0;
var BIND_VAR = BIND_KIND_VALUE | 0 | BIND_SCOPE_VAR | 0;
var BIND_FUNCTION = BIND_KIND_VALUE | 0 | BIND_SCOPE_FUNCTION | 0;
var BIND_TS_INTERFACE = 0 | BIND_KIND_TYPE | 0 | BIND_FLAGS_CLASS;
var BIND_TS_TYPE = 0 | BIND_KIND_TYPE | 0 | 0;
var BIND_TS_ENUM = BIND_KIND_VALUE | BIND_KIND_TYPE | BIND_SCOPE_LEXICAL | BIND_FLAGS_TS_ENUM;
var BIND_TS_AMBIENT = 0 | 0 | 0 | BIND_FLAGS_TS_EXPORT_ONLY;
var BIND_NONE = 0 | 0 | 0 | BIND_FLAGS_NONE;
var BIND_OUTSIDE = BIND_KIND_VALUE | 0 | 0 | BIND_FLAGS_NONE;
var BIND_TS_CONST_ENUM = BIND_TS_ENUM | BIND_FLAGS_TS_CONST_ENUM;
var BIND_TS_NAMESPACE = 0 | 0 | 0 | BIND_FLAGS_TS_EXPORT_ONLY;
var CLASS_ELEMENT_FLAG_STATIC = 4;
var CLASS_ELEMENT_KIND_GETTER = 2;
var CLASS_ELEMENT_KIND_SETTER = 1;
var CLASS_ELEMENT_KIND_ACCESSOR = CLASS_ELEMENT_KIND_GETTER | CLASS_ELEMENT_KIND_SETTER;
var CLASS_ELEMENT_STATIC_GETTER = CLASS_ELEMENT_KIND_GETTER | CLASS_ELEMENT_FLAG_STATIC;
var CLASS_ELEMENT_STATIC_SETTER = CLASS_ELEMENT_KIND_SETTER | CLASS_ELEMENT_FLAG_STATIC;
var skipWhiteSpaceInLine = /(?:[^\S\n\r\u2028\u2029]|\/\/.*|\/\*.*?\*\/)*/y;
var skipWhiteSpaceToLineBreak = new RegExp(
  "(?=(" +
  skipWhiteSpaceInLine.source + "))\\1" +
  /(?=[\n\r\u2028\u2029]|\/\*(?!.*?\*\/)|$)/.source,
  "y"
);
var DestructuringErrors = class {
  constructor() {
    this.shorthandAssign = this.trailingComma = this.parenthesizedAssign = this.parenthesizedBind = this.doubleProto = -1;
  }
};
function resolvePrivateNameConflict(current, element) {
  let next = "true";
  if (element.type === "MethodDefinition" && (element.kind === "get" || element.kind === "set")) {
    next = (element.static ? "s" : "i") + element.kind;
  }
  if (current === "iget" && next === "iset" || current === "iset" && next === "iget" || current === "sget" && next === "sset" || current === "sset" && next === "sget") {
    return [false, "true"];
  }
  if (!current) return [false, next];
  return [true, current];
}
function checkKeyName(node, name) {
  const { computed, key } = node;
  return !computed && (key.type === "Identifier" && key.name === name || key.type === "Literal" && key.value === name);
}
var TypeScriptError = {
  AbstractMethodHasImplementation: ({ methodName }) => `Method '${methodName}' cannot have an implementation because it is marked abstract.`,
  AbstractPropertyHasInitializer: ({ propertyName }) => `Property '${propertyName}' cannot have an initializer because it is marked abstract.`,
  AccesorCannotDeclareThisParameter: "AccesorCannotDeclareThisParameter",
  AccesorCannotHaveTypeParameters: "AccesorCannotHaveTypeParameters",
  CannotFindName: ({ name }) => `Cannot find name '${name}'.`,
  ClassMethodHasDeclare: "ClassMethodHasDeclare",
  ClassMethodHasReadonly: "ClassMethodHasReadonly",
  ConstInitiailizerMustBeStringOrNumericLiteralOrLiteralEnumReference: "ConstInitiailizerMustBeStringOrNumericLiteralOrLiteralEnumReference",
  ConstructorHasTypeParameters: "ConstructorHasTypeParameters",
  DeclareAccessor: ({ kind }) => `'declare' is not allowed in ${kind}ters.`,
  DeclareClassFieldHasInitializer: "DeclareClassFieldHasInitializer",
  DeclareFunctionHasImplementation: "DeclareFunctionHasImplementation",
  DuplicateAccessibilityModifier: (
    (() => `Accessibility modifier already seen.`)
  ),
  DuplicateModifier: ({ modifier }) => `Duplicate modifier: '${modifier}'.`,
  EmptyHeritageClauseType: ({ token: listKind }) => `'${listKind}' list cannot be empty.`,
  EmptyTypeArguments: "EmptyTypeArguments",
  EmptyTypeParameters: "EmptyTypeParameters",
  ExpectedAmbientAfterExportDeclare: "ExpectedAmbientAfterExportDeclare",
  ImportAliasHasImportType: "ImportAliasHasImportType",
  IncompatibleModifiers: ({ modifiers }) => `'${modifiers[0]}' modifier cannot be used with '${modifiers[1]}' modifier.`,
  IndexSignatureHasAbstract: "IndexSignatureHasAbstract",
  IndexSignatureHasAccessibility: ({ modifier }) => `Index signatures cannot have an accessibility modifier ('${modifier}').`,
  IndexSignatureHasDeclare: "IndexSignatureHasDeclare",
  IndexSignatureHasOverride: "IndexSignatureHasOverride",
  IndexSignatureHasStatic: "IndexSignatureHasStatic",
  InitializerNotAllowedInAmbientContext: "InitializerNotAllowedInAmbientContext",
  InvalidModifierOnTypeMember: ({ modifier }) => `'${modifier}' modifier cannot appear on a type member.`,
  InvalidModifierOnTypeParameter: ({ modifier }) => `'${modifier}' modifier cannot appear on a type parameter.`,
  InvalidModifierOnTypeParameterPositions: ({ modifier }) => `'${modifier}' modifier can only appear on a type parameter of a class, interface or type alias.`,
  InvalidModifiersOrder: ({ orderedModifiers }) => `'${orderedModifiers[0]}' modifier must precede '${orderedModifiers[1]}' modifier.`,
  InvalidPropertyAccessAfterInstantiationExpression: "InvalidPropertyAccessAfterInstantiationExpression",
  InvalidTupleMemberLabel: "InvalidTupleMemberLabel",
  MissingInterfaceName: "MissingInterfaceName",
  NonAbstractClassHasAbstractMethod: "NonAbstractClassHasAbstractMethod",
  NonClassMethodPropertyHasAbstractModifer: "NonClassMethodPropertyHasAbstractModifer",
  OptionalTypeBeforeRequired: "OptionalTypeBeforeRequired",
  OverrideNotInSubClass: "OverrideNotInSubClass",
  PatternIsOptional: "PatternIsOptional",
  PrivateElementHasAbstract: "PrivateElementHasAbstract",
  PrivateElementHasAccessibility: ({ modifier }) => `Private elements cannot have an accessibility modifier ('${modifier}').`,
  PrivateMethodsHasAccessibility: ({ modifier }) => `Private methods cannot have an accessibility modifier ('${modifier}').`,
  ReadonlyForMethodSignature: "ReadonlyForMethodSignature",
  ReservedArrowTypeParam: "ReservedArrowTypeParam",
  ReservedTypeAssertion: "ReservedTypeAssertion",
  SetAccesorCannotHaveOptionalParameter: "SetAccesorCannotHaveOptionalParameter",
  SetAccesorCannotHaveRestParameter: "SetAccesorCannotHaveRestParameter",
  SetAccesorCannotHaveReturnType: "SetAccesorCannotHaveReturnType",
  SingleTypeParameterWithoutTrailingComma: ({ typeParameterName }) => `Single type parameter ${typeParameterName} should have a trailing comma. Example usage: <${typeParameterName},>.`,
  StaticBlockCannotHaveModifier: "StaticBlockCannotHaveModifier",
  TypeAnnotationAfterAssign: "TypeAnnotationAfterAssign",
  TypeImportCannotSpecifyDefaultAndNamed: "TypeImportCannotSpecifyDefaultAndNamed",
  TypeModifierIsUsedInTypeExports: "TypeModifierIsUsedInTypeExports",
  TypeModifierIsUsedInTypeImports: "TypeModifierIsUsedInTypeImports",
  UnexpectedParameterModifier: "UnexpectedParameterModifier",
  UnexpectedReadonly: "UnexpectedReadonly",
  GenericsEndWithComma: `Trailing comma is not allowed at the end of generics.`,
  UnexpectedTypeAnnotation: "UnexpectedTypeAnnotation",
  UnexpectedTypeCastInParameter: "UnexpectedTypeCastInParameter",
  UnsupportedImportTypeArgument: "UnsupportedImportTypeArgument",
  UnsupportedParameterPropertyKind: "UnsupportedParameterPropertyKind",
  UnsupportedSignatureParameterKind: ({ type }) => `Name in a signature must be an Identifier, ObjectPattern or ArrayPattern, instead got ${type}.`,
  LetInLexicalBinding: "LetInLexicalBinding"
};
var DecoratorsError = {
  UnexpectedLeadingDecorator: "Leading decorators must be attached to a class declaration.",
  DecoratorConstructor: "Decorators can't be used with a constructor. Did you mean '@dec class { ... }'?",
  TrailingDecorator: "Decorators must be attached to a class element.",
  SpreadElementDecorator: `Decorators can't be used with SpreadElement`
};
function generateParseDecorators(Parse, acornTypeScript, acorn) {
  const { tokTypes: tt } = acorn;
  const { tokTypes } = acornTypeScript;
  return class ParseDecorators extends Parse {
    takeDecorators(node) {
      const decorators = this.decoratorStack[this.decoratorStack.length - 1];
      if (decorators.length) {
        node.decorators = decorators;
        this.resetStartLocationFromNode(node, decorators[0]);
        this.decoratorStack[this.decoratorStack.length - 1] = [];
      }
    }
    parseDecorators(allowExport) {
      const currentContextDecorators = this.decoratorStack[this.decoratorStack.length - 1];
      while (this.match(tokTypes.at)) {
        const decorator = this.parseDecorator();
        currentContextDecorators.push(decorator);
      }
      if (this.match(tt._export)) {
        if (!allowExport) {
          this.unexpected();
        }
      } else if (!this.canHaveLeadingDecorator()) {
        this.raise(this.start, DecoratorsError.UnexpectedLeadingDecorator);
      }
    }
    parseDecorator() {
      const node = this.startNode();
      this.next();
      this.decoratorStack.push([]);
      const startPos = this.start;
      const startLoc = this.startLoc;
      let expr;
      if (this.match(tt.parenL)) {
        const startPos2 = this.start;
        const startLoc2 = this.startLoc;
        this.next();
        expr = this.parseExpression();
        this.expect(tt.parenR);
        if (this.options.preserveParens) {
          let par = this.startNodeAt(startPos2, startLoc2);
          par.expression = expr;
          expr = this.finishNode(par, "ParenthesizedExpression");
        }
      } else {
        expr = this.parseIdent(false);
        while (this.eat(tt.dot)) {
          const node2 = this.startNodeAt(startPos, startLoc);
          node2.object = expr;
          node2.property = this.parseIdent(true);
          node2.computed = false;
          expr = this.finishNode(node2, "MemberExpression");
        }
      }
      node.expression = this.parseMaybeDecoratorArguments(expr);
      this.decoratorStack.pop();
      return this.finishNode(node, "Decorator");
    }
    parseMaybeDecoratorArguments(expr) {
      if (this.eat(tt.parenL)) {
        const node = this.startNodeAtNode(expr);
        node.callee = expr;
        node.arguments = this.parseExprList(tt.parenR, false);
        return this.finishNode(node, "CallExpression");
      }
      return expr;
    }
  };
}
var xhtml_default = {
  quot: '"',
  amp: "&",
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: "\xA0",
  iexcl: "\xA1",
  cent: "\xA2",
  pound: "\xA3",
  curren: "\xA4",
  yen: "\xA5",
  brvbar: "\xA6",
  sect: "\xA7",
  uml: "\xA8",
  copy: "\xA9",
