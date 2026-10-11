                hadConstructor = true;
                if (element.decorators && element.decorators.length > 0) {
                  this.raise(element.start, DecoratorsError.DecoratorConstructor);
                }
              } else if (element.key && element.key.type === "PrivateIdentifier" && element.value?.type !== "TSDeclareMethod") {
                const privateName = element.key.name;
                const conflicted = this.parseEffects.modify(
                  privateNameMap,
                  privateName,
                  (current) => resolvePrivateNameConflict(current, element)
                );
                if (conflicted) {
                  this.raiseRecoverable(
                    element.key.start,
                    `Identifier '#${privateName}' has already been declared`
                  );
                }
              }
            }
          }
          this.strict = oldStrict;
          this.next();
          if (decorators.length) {
            this.raise(this.start, DecoratorsError.TrailingDecorator);
          }
          node.body = this.finishNode(classBody, "ClassBody");
          this.exitClassBody();
          return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression");
        } finally {
          this.inAbstractClass = oldInAbstractClass;
        }
      }
      parseClassFunctionParams() {
        const typeParameters = this.tsTryParseTypeParameters();
        let params = this.parseBindingList(tt.parenR, false, this.ecmaVersion >= 8, true);
        if (typeParameters) params.typeParameters = typeParameters;
        return params;
      }
      parseMethod(isGenerator, isAsync, allowDirectSuper, inClassScope, method) {
        let node = this.startNode(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
        this.initFunction(node);
        if (this.ecmaVersion >= 6) node.generator = isGenerator;
        if (this.ecmaVersion >= 8) node.async = !!isAsync;
        this.yieldPos = 0;
        this.awaitPos = 0;
        this.awaitIdentPos = 0;
        this.enterScope(
          functionFlags(isAsync, node.generator) | acornScope.SCOPE_SUPER | (allowDirectSuper ? acornScope.SCOPE_DIRECT_SUPER : 0)
        );
        this.expect(tt.parenL);
        node.params = this.parseClassFunctionParams();
        this.checkYieldAwaitInDefaultParams();
        this.parseFunctionBody(node, false, true, false, {
          isClassMethod: inClassScope
        });
        this.yieldPos = oldYieldPos;
        this.awaitPos = oldAwaitPos;
        this.awaitIdentPos = oldAwaitIdentPos;
        if (method && method.abstract) {
          const hasBody = !!node.body;
          if (hasBody) {
            const { key } = method;
            this.raise(
              method.start,
              TypeScriptError.AbstractMethodHasImplementation({
                methodName: key.type === "Identifier" && !method.computed ? key.name : "[" + this.input.slice(key.start, key.end) + "]"
              })
            );
          }
        }
        return this.finishNode(node, "FunctionExpression");
      }
      static parse(input, options2) {
        if (options2.locations === false) {
          throw new Error(`You have to enable options.locations while using acorn-typescript`);
        } else {
          options2.locations = true;
        }
        const parser = new this(options2, input);
        if (dts) {
          parser.isAmbientContext = true;
        }
        return parser.parse();
      }
      static parseExpressionAt(input, pos, options2) {
        if (options2.locations === false) {
          throw new Error(`You have to enable options.locations while using acorn-typescript`);
        } else {
          options2.locations = true;
        }
        const parser = new this(options2, input, pos);
        if (dts) {
          parser.isAmbientContext = true;
        }
        parser.nextToken();
        return parser.parseExpression();
      }
      parseImportSpecifier() {
        const isMaybeTypeOnly = this.ts_isContextual(tokTypes.type);
        if (isMaybeTypeOnly) {
          let node = this.startNode();
          node.imported = this.parseModuleExportName();
          this.parseTypeOnlyImportExportSpecifier(
            node,
            true,
            this.importOrExportOuterKind === "type"
          );
          return this.finishNode(node, "ImportSpecifier");
        } else {
          const node = super.parseImportSpecifier();
          node.importKind = "value";
          return node;
        }
      }
      parseExportSpecifier(exports2) {
        const isMaybeTypeOnly = this.ts_isContextual(tokTypes.type);
        const isString = this.match(tt.string);
        if (!isString && isMaybeTypeOnly) {
          let node = this.startNode();
          node.local = this.parseModuleExportName();
          this.parseTypeOnlyImportExportSpecifier(
            node,
            false,
            this.importOrExportOuterKind === "type"
          );
          this.finishNode(node, "ExportSpecifier");
          this.checkExport(exports2, node.exported, node.exported.start);
          return node;
        } else {
          const node = super.parseExportSpecifier(exports2);
          node.exportKind = "value";
          return node;
        }
      }
      parseTypeOnlyImportExportSpecifier(node, isImport, isInTypeOnlyImportExport) {
        const leftOfAsKey = isImport ? "imported" : "local";
        const rightOfAsKey = isImport ? "local" : "exported";
        let leftOfAs = node[leftOfAsKey];
        let rightOfAs;
        let hasTypeSpecifier = false;
        let canParseAsKeyword = true;
        const loc = leftOfAs.start;
        if (this.isContextual("as")) {
          const firstAs = this.parseIdent();
          if (this.isContextual("as")) {
            const secondAs = this.parseIdent();
            if (tokenIsKeywordOrIdentifier(this.type)) {
              hasTypeSpecifier = true;
              leftOfAs = firstAs;
              rightOfAs = isImport ? this.parseIdent() : this.parseModuleExportName();
              canParseAsKeyword = false;
            } else {
              rightOfAs = secondAs;
              canParseAsKeyword = false;
            }
          } else if (tokenIsKeywordOrIdentifier(this.type)) {
            canParseAsKeyword = false;
            rightOfAs = isImport ? this.parseIdent() : this.parseModuleExportName();
          } else {
            hasTypeSpecifier = true;
            leftOfAs = firstAs;
          }
        } else if (tokenIsKeywordOrIdentifier(this.type)) {
          hasTypeSpecifier = true;
          if (isImport) {
            leftOfAs = super.parseIdent(true);
            if (!this.isContextual("as")) {
              this.checkUnreserved(leftOfAs);
            }
          } else {
            leftOfAs = this.parseModuleExportName();
          }
        }
        if (hasTypeSpecifier && isInTypeOnlyImportExport) {
          this.raise(
            loc,
            isImport ? TypeScriptError.TypeModifierIsUsedInTypeImports : TypeScriptError.TypeModifierIsUsedInTypeExports
          );
        }
        node[leftOfAsKey] = leftOfAs;
        node[rightOfAsKey] = rightOfAs;
        const kindKey = isImport ? "importKind" : "exportKind";
        node[kindKey] = hasTypeSpecifier ? "type" : "value";
        if (canParseAsKeyword && this.eatContextual("as")) {
          node[rightOfAsKey] = isImport ? this.parseIdent() : this.parseModuleExportName();
        }
        if (!node[rightOfAsKey]) {
          node[rightOfAsKey] = this.copyNode(node[leftOfAsKey]);
        }
        if (isImport) {
          this.checkLValSimple(node[rightOfAsKey], acornScope.BIND_LEXICAL);
        }
      }
      raiseCommonCheck(pos, message, recoverable) {
        switch (message) {
          case "Comma is not permitted after the rest element": {
            if (this.isAmbientContext && this.match(tt.comma) && this.lookaheadCharCode() === 41) {
              this.next();
              return;
            } else {
              return super.raise(pos, message);
            }
          }
        }
        return recoverable ? super.raiseRecoverable(pos, message) : super.raise(pos, message);
      }
      raiseRecoverable(pos, message) {
        return this.raiseCommonCheck(pos, message, true);
      }
      raise(pos, message) {
        return this.raiseCommonCheck(pos, message, true);
      }
      updateContext(prevType) {
        const { type } = this;
        if (type == tt.braceL) {
          var curContext = this.curContext();
          if (curContext == tsTokContexts.tc_oTag) {
            this.parseEffects.append(this.context, tokContexts.b_expr);
          } else if (curContext == tsTokContexts.tc_expr) {
            this.parseEffects.append(this.context, tokContexts.b_tmpl);
          } else {
            super.updateContext(prevType);
          }
          this.exprAllowed = true;
        } else if (type === tt.slash && prevType === tokTypes.jsxTagStart) {
          this.parseEffects.truncate(this.context, this.context.length - 2);
          this.parseEffects.append(this.context, tsTokContexts.tc_cTag);
          this.exprAllowed = false;
        } else {
          return super.updateContext(prevType);
        }
      }
      jsx_parseOpeningElementAt(startPos, startLoc) {
        let node = this.startNodeAt(startPos, startLoc);
        let nodeName = this.jsx_parseElementName();
        if (nodeName) node.name = nodeName;
        if (this.match(tt.relational) || this.match(tt.bitShift)) {
          const typeArguments = this.tsTryParseAndCatch(
            () => this.tsParseTypeArgumentsInExpression()
          );
          if (typeArguments) node.typeArguments = typeArguments;
        }
        node.attributes = [];
        while (this.type !== tt.slash && this.type !== tokTypes.jsxTagEnd)
          node.attributes.push(this.jsx_parseAttribute());
        node.selfClosing = this.eat(tt.slash);
        this.expect(tokTypes.jsxTagEnd);
        return this.finishNode(node, nodeName ? "JSXOpeningElement" : "JSXOpeningFragment");
      }
      enterScope(flags) {
        const isTypeScriptModule = flags === TS_SCOPE_TS_MODULE;
        if (isTypeScriptModule) {
          this.parseEffects.append(this.importsStack, []);
        }
        const acornFlags = isTypeScriptModule ? flags | acornScope.SCOPE_CLASS_STATIC_BLOCK : flags;
        super.enterScope(acornFlags);
        const scope = super.currentScope();
        scope.types = [];
        scope.enums = [];
        scope.constEnums = [];
        scope.classes = [];
        scope.exportOnlyBindings = [];
      }
      exitScope() {
        const scope = super.currentScope();
        if (scope.flags & TS_SCOPE_TS_MODULE) {
          this.parseEffects.pop(this.importsStack);
        }
        super.exitScope();
      }
      hasImport(name, allowShadow) {
        const len = this.importsStack.length;
        if (this.importsStack[len - 1].indexOf(name) > -1) {
          return true;
        }
        if (!allowShadow && len > 1) {
          for (let i = 0; i < len - 1; i++) {
            if (this.importsStack[i].indexOf(name) > -1) return true;
          }
        }
        return false;
      }
      maybeExportDefined(scope, name) {
        if (this.inModule && scope.flags & acornScope.SCOPE_TOP) {
          this.parseEffects.remove(this.undefinedExports, name);
        }
      }
      declareName(name, bindingType, pos) {
        if (bindingType & acornScope.BIND_FLAGS_TS_IMPORT) {
          if (this.hasImport(name, true)) {
            this.raise(pos, `Identifier '${name}' has already been declared.`);
          }
          this.parseEffects.append(this.importsStack[this.importsStack.length - 1], name);
          return;
        }
        const scope = this.currentScope();
        if (bindingType & acornScope.BIND_FLAGS_TS_EXPORT_ONLY) {
          this.maybeExportDefined(scope, name);
          this.parseEffects.append(scope.exportOnlyBindings, name);
          return;
        }
        if (bindingType === acornScope.BIND_TS_TYPE || bindingType === acornScope.BIND_TS_INTERFACE) {
          if (bindingType === acornScope.BIND_TS_TYPE && scope.types.includes(name)) {
            this.raise(pos, `type '${name}' has already been declared.`);
          }
          this.parseEffects.append(scope.types, name);
        } else if (bindingType & acornScope.BIND_FLAGS_TS_ENUM) {
          if (scope.enums.includes(name)) return;
          super.declareName(name, acornScope.BIND_LEXICAL, pos);
        } else {
          super.declareName(name, bindingType, pos);
        }
        if (bindingType & acornScope.BIND_FLAGS_TS_ENUM) {
          this.parseEffects.append(scope.enums, name);
        }
        if (bindingType & acornScope.BIND_FLAGS_TS_CONST_ENUM) {
          this.parseEffects.append(scope.constEnums, name);
        }
        if (bindingType & acornScope.BIND_FLAGS_CLASS) {
          this.parseEffects.append(scope.classes, name);
        }
      }
      checkLocalExport(id) {
        const { name } = id;
        if (this.hasImport(name)) return;
        const len = this.scopeStack.length;
        for (let i = len - 1; i >= 0; i--) {
          const scope = this.scopeStack[i];
          if (scope.types.indexOf(name) > -1 || scope.exportOnlyBindings.indexOf(name) > -1) return;
        }
        super.checkLocalExport(id);
      }
    }
    return TypeScriptParser;
  };
}
0 && (module.exports = {
  tsPlugin
});

