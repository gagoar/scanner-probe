            if (scope.flags & varScopeFlags) break;
          }
        }
      }
      return super.declareName(name, bindingType, pos);
    }
    checkLocalExport(id) {
      this.parseEffects?.willSet(this.undefinedExports, id.name);
      return super.checkLocalExport(id);
    }
  };
}
var skipWhiteSpace = /(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g;
function assert(x) {
  if (!x) {
    throw new Error("Assert fail");
  }
}
function tsIsClassAccessor(modifier) {
  return modifier === "accessor";
}
function tsIsVarianceAnnotations(modifier) {
  return modifier === "in" || modifier === "out";
}
var FUNC_STATEMENT = 1;
var FUNC_HANGING_STATEMENT = 2;
var FUNC_NULLABLE_ID = 4;
var acornScope = {
  SCOPE_TOP: 1,
  SCOPE_FUNCTION: 2,
  SCOPE_ASYNC: 4,
  SCOPE_GENERATOR: 8,
  SCOPE_ARROW: 16,
  SCOPE_SIMPLE_CATCH: 32,
  SCOPE_SUPER: 64,
  SCOPE_DIRECT_SUPER: 128,
  SCOPE_CLASS_STATIC_BLOCK: 256,
  SCOPE_VAR: 256,
  BIND_NONE: 0,
  BIND_VAR: 1,
  BIND_LEXICAL: 2,
  BIND_FUNCTION: 3,
  BIND_SIMPLE_CATCH: 4,
  BIND_OUTSIDE: 5,
  BIND_TS_TYPE: 6,
  BIND_TS_INTERFACE: 7,
  BIND_TS_NAMESPACE: 8 | 1024,
  BIND_FLAGS_TS_EXPORT_ONLY: 1024,
  BIND_FLAGS_TS_IMPORT: 4096,
  BIND_FLAGS_TS_ENUM: 256,
  BIND_FLAGS_TS_CONST_ENUM: 512,
  BIND_TS_ENUM: 2 | 256,
  BIND_TS_CONST_ENUM: 2 | 256 | 512,
  BIND_FLAGS_CLASS: 128
};
function functionFlags(async, generator) {
  return acornScope.SCOPE_FUNCTION | (async ? acornScope.SCOPE_ASYNC : 0) | (generator ? acornScope.SCOPE_GENERATOR : 0);
}
function isPossiblyLiteralEnum(expression) {
  if (expression.type !== "MemberExpression") return false;
  const { computed, property } = expression;
  if (computed && (property.type !== "TemplateLiteral" || property.expressions.length > 0)) {
    return false;
  }
  return isUncomputedMemberExpressionChain(expression.object);
}
function isAmbientNumericUnaryExpression(expression) {
  return expression.type === "UnaryExpression" && (expression.operator === "-" || expression.operator === "+") && expression.argument.type === "Literal" && (typeof expression.argument.value === "number" || typeof expression.argument.value === "bigint");
}
function isUncomputedMemberExpressionChain(expression) {
  if (expression.type === "Identifier") return true;
  if (expression.type !== "MemberExpression") return false;
  if (expression.computed) return false;
  return isUncomputedMemberExpressionChain(expression.object);
}
function tsIsAccessModifier(modifier) {
  return modifier === "private" || modifier === "public" || modifier === "protected";
}
function tokenCanStartExpression(token) {
  return Boolean(token.startsExpr);
}
function nonNull(x) {
  if (x == null) {
    throw new Error(`Unexpected ${x} value.`);
  }
  return x;
}
function keywordTypeFromName(value) {
  switch (value) {
    case "any":
      return "TSAnyKeyword";
    case "boolean":
      return "TSBooleanKeyword";
    case "bigint":
      return "TSBigIntKeyword";
    case "never":
      return "TSNeverKeyword";
    case "number":
      return "TSNumberKeyword";
    case "object":
      return "TSObjectKeyword";
    case "string":
      return "TSStringKeyword";
    case "symbol":
      return "TSSymbolKeyword";
    case "undefined":
      return "TSUndefinedKeyword";
    case "unknown":
      return "TSUnknownKeyword";
    default:
      return void 0;
  }
}
function tsPlugin(options) {
  const { dts = false } = options || {};
  const disallowAmbiguousJSXLike = !!options?.jsx;
  return function(Parser) {
    const _acorn = Parser.acorn || acornNamespace;
    const acornTypeScript = generateAcornTypeScript(_acorn);
    const tt = _acorn.tokTypes;
    const keywordTypes = _acorn.keywordTypes;
    const isIdentifierStart = _acorn.isIdentifierStart;
    const lineBreak = _acorn.lineBreak;
    const isNewLine = _acorn.isNewLine;
    const tokContexts = _acorn.tokContexts;
    const isIdentifierChar = _acorn.isIdentifierChar;
    const {
      tokTypes,
      tokContexts: tsTokContexts,
      keywordsRegExp,
      tokenIsLiteralPropertyName,
      tokenIsTemplate,
      tokenIsTSDeclarationStart,
      tokenIsIdentifier,
      tokenIsKeywordOrIdentifier,
      tokenIsTSTypeOperator
    } = acornTypeScript;
    function nextLineBreak(code, from, end = code.length) {
      for (let i = from; i < end; i++) {
        let next = code.charCodeAt(i);
        if (isNewLine(next))
          return i < end - 1 && next === 13 && code.charCodeAt(i + 1) === 10 ? i + 2 : i + 1;
      }
      return -1;
    }
    Parser = generateParseDecorators(Parser, acornTypeScript, _acorn);
    if (options?.jsx) {
      Parser = generateJsxParser(
        _acorn,
        acornTypeScript,
        Parser,
        typeof options.jsx === "boolean" ? {} : options.jsx
      );
    }
    Parser = generateParseImportAssertions(Parser, acornTypeScript, _acorn);
    const EffectParser = adaptParser(Parser, {
      acornTokenTypes: tt,
      typeScriptTokenTypes: tokTypes,
      scope: acornScope
    });
    class TypeScriptParser extends EffectParser {
      constructor(options2, input, startPos) {
        super(options2, input, startPos);
        this.preValue = null;
        this.preToken = null;
        this.isLookahead = false;
        this.isAmbientContext = false;
        this.inAbstractClass = false;
        this.inType = false;
        this.inDisallowConditionalTypesContext = false;
        this.maybeInArrowParameters = false;
        this.shouldParseArrowReturnType = void 0;
        this.shouldParseAsyncArrowReturnType = void 0;
        this.decoratorStack = [[]];
        this.importsStack = [[]];
        this.importOrExportOuterKind = void 0;
        this.tsParseConstModifier = (node) => {
          this.tsParseModifiers({
            modified: node,
            allowedModifiers: ["const"],
            disallowedModifiers: ["in", "out"],
            errorTemplate: TypeScriptError.InvalidModifierOnTypeParameterPositions
          });
        };
        this.ecmaVersion = this.options.ecmaVersion;
      }
      static get acornTypeScript() {
        return acornTypeScript;
      }
      get acornTypeScript() {
        return acornTypeScript;
      }
      getTokenFromCodeInType(code) {
        if (code === 62) {
          return this.finishOp(tt.relational, 1);
        }
        if (code === 60) {
          return this.finishOp(tt.relational, 1);
        }
        return super.getTokenFromCode(code);
      }
      readToken(code) {
        if (!this.inType) {
          let context = this.curContext();
          if (context === tsTokContexts.tc_expr) return this.jsx_readToken();
          if (context === tsTokContexts.tc_oTag || context === tsTokContexts.tc_cTag) {
            if (isIdentifierStart(code)) return this.jsx_readWord();
            if (code == 62) {
              ++this.pos;
              return this.finishToken(tokTypes.jsxTagEnd);
            }
            if ((code === 34 || code === 39) && context == tsTokContexts.tc_oTag)
              return this.jsx_readString(code);
          }
          if (code === 60 && this.exprAllowed && this.input.charCodeAt(this.pos + 1) !== 33) {
            ++this.pos;
            if (options?.jsx) {
              return this.finishToken(tokTypes.jsxTagStart);
            } else {
              return this.finishToken(tt.relational, "<");
            }
          }
        }
        return super.readToken(code);
      }
      getTokenFromCode(code) {
        if (this.inType) {
          return this.getTokenFromCodeInType(code);
        }
        if (code === 64) {
          ++this.pos;
          return this.finishToken(tokTypes.at);
        }
        return super.getTokenFromCode(code);
      }
      isAbstractClass() {
        return this.ts_isContextual(tokTypes.abstract) && this.lookahead().type === tt._class;
      }
      isDeclareClass() {
        if (!this.ts_isContextual(tokTypes.declare)) return false;
        const afterDeclare = this.nextTokenStart();
        if (this.isUnparsedContextual(afterDeclare, "class")) return true;
        if (!this.isUnparsedContextual(afterDeclare, "abstract")) return false;
        const afterAbstract = this.nextTokenStartSince(afterDeclare + "abstract".length);
        return this.isUnparsedContextual(afterAbstract, "class");
      }
      finishNode(node, type) {
        if (node.type !== "" && node.end !== 0) {
          return node;
        }
        return super.finishNode(node, type);
      }
      tryParse(fn) {
        const abortSignal = {};
        const frame = this.beginParseEffectScope();
        let node;
        try {
          node = fn(() => {
            throw abortSignal;
          });
        } catch (error) {
          const aborted = error === abortSignal;
          if (!aborted && !(error instanceof SyntaxError)) {
            this.parseEffects.rollback(frame);
            throw error;
          }
          const failState = {
            events: this.parseEffects.rollbackWithEvents(frame),
            selected: false
          };
          return aborted ? { node: null, error: null, thrown: false, aborted: true, failState } : {
            node: null,
            error,
            thrown: true,
            aborted: false,
            failState
          };
        }
        this.parseEffects.commit(frame);
        return {
          node,
          error: null,
          thrown: false,
          aborted: false,
          failState: null
        };
      }
      setOptionalParametersError(refExpressionErrors, resultError) {
        refExpressionErrors.optionalParametersLoc = resultError?.loc ?? this.startLoc;
      }
      reScan_lt_gt() {
        if (this.type === tt.relational) {
          this.pos -= 1;
          this.readToken_lt_gt(this.fullCharCodeAtPos());
        }
      }
      reScan_lt() {
        const { type } = this;
        if (type === tt.bitShift) {
          this.pos -= 2;
          this.finishOp(tt.relational, 1);
          return tt.relational;
        }
        return type;
      }
      resetEndLocation(node, endPos = this.lastTokEnd, endLoc = this.lastTokEndLoc) {
        node.end = endPos;
        node.loc.end = endLoc;
        if (this.options.ranges) node.range[1] = endPos;
      }
      startNodeAtNode(type) {
        return super.startNodeAt(type.start, type.loc.start);
      }
      nextTokenStart() {
        return this.nextTokenStartSince(this.pos);
      }
      tsHasSomeModifiers(member, modifiers) {
        return modifiers.some((modifier) => {
          if (tsIsAccessModifier(modifier)) {
            return member.accessibility === modifier;
          }
          return !!member[modifier];
        });
      }
      tsIsStartOfStaticBlocks() {
        return this.isContextual("static") && this.lookaheadCharCode() === 123;
      }
      tsCheckForInvalidTypeCasts(items) {
        items.forEach((node) => {
          if (node?.type === "TSTypeCastExpression") {
            this.raise(node.typeAnnotation.start, TypeScriptError.UnexpectedTypeAnnotation);
          }
        });
      }
      atPossibleAsyncArrow(base) {
        return base.type === "Identifier" && base.name === "async" && this.lastTokEnd === base.end && !this.canInsertSemicolon() && base.end - base.start === 5 && base.start === this.potentialArrowAt;
      }
      tsIsIdentifier() {
        return tokenIsIdentifier(this.type);
      }
      tsTryParseTypeOrTypePredicateAnnotation() {
        return this.match(tt.colon) ? this.tsParseTypeOrTypePredicateAnnotation(tt.colon) : void 0;
