            return this.finishNode(node2, "TSIntrinsicKeyword");
          }
          return this.tsParseType();
        });
        this.semicolon();
        return this.finishNode(node, "TSTypeAliasDeclaration");
      }
      tsParseDeclaration(node, value, next) {
        switch (value) {
          case "abstract":
            if (this.tsCheckLineTerminator(next) && (this.match(tt._class) || tokenIsIdentifier(this.type))) {
              return this.tsParseAbstractDeclaration(node);
            }
            break;
          case "module":
            if (this.tsCheckLineTerminator(next)) {
              if (this.match(tt.string)) {
                return this.tsParseAmbientExternalModuleDeclaration(node);
              } else if (tokenIsIdentifier(this.type)) {
                return this.tsParseModuleOrNamespaceDeclaration(node);
              }
            }
            break;
          case "namespace":
            if (this.tsCheckLineTerminator(next) && tokenIsIdentifier(this.type)) {
              return this.tsParseModuleOrNamespaceDeclaration(node);
            }
            break;
          case "type":
            if (this.tsCheckLineTerminator(next) && tokenIsIdentifier(this.type)) {
              return this.tsParseTypeAliasDeclaration(node);
            }
            break;
        }
      }
      tsTryParseExportDeclaration() {
        return this.tsParseDeclaration(
          this.startNode(),
          this.value,
          true
        );
      }
      tsParseImportEqualsDeclaration(node, isExport) {
        node.isExport = isExport || false;
        node.id = this.parseIdent();
        this.checkLValSimple(node.id, acornScope.BIND_LEXICAL);
        super.expect(tt.eq);
        const moduleReference = this.tsParseModuleReference();
        if (node.importKind === "type" && moduleReference.type !== "TSExternalModuleReference") {
          this.raise(moduleReference.start, TypeScriptError.ImportAliasHasImportType);
        }
        node.moduleReference = moduleReference;
        super.semicolon();
        return this.finishNode(node, "TSImportEqualsDeclaration");
      }
      isExportDefaultSpecifier() {
        if (this.tsIsDeclarationStart()) return false;
        const { type } = this;
        if (tokenIsIdentifier(type)) {
          if (this.isContextual("async") || this.isContextual("let")) {
            return false;
          }
          if ((type === tokTypes.type || type === tokTypes.interface) && !this.containsEsc) {
            const ahead = this.lookahead();
            if (tokenIsIdentifier(ahead.type) && !this.isContextualWithState("from", ahead) || ahead.type === tt.braceL) {
              return false;
            }
          }
        } else if (!this.match(tt._default)) {
          return false;
        }
        const next = this.nextTokenStart();
        const hasFrom = this.isUnparsedContextual(next, "from");
        if (this.input.charCodeAt(next) === 44 || tokenIsIdentifier(this.type) && hasFrom) {
          return true;
        }
        if (this.match(tt._default) && hasFrom) {
          const nextAfterFrom = this.input.charCodeAt(this.nextTokenStartSince(next + 4));
          return nextAfterFrom === 34 || nextAfterFrom === 39;
        }
        return false;
      }
      parseTemplate({ isTagged = false } = {}) {
        let node = this.startNode();
        this.next();
        node.expressions = [];
        let curElt = this.parseTemplateElement({ isTagged });
        node.quasis = [curElt];
        while (!curElt.tail) {
          if (this.type === tt.eof) this.raise(this.pos, "Unterminated template literal");
          this.expect(tt.dollarBraceL);
          node.expressions.push(this.inType ? this.tsParseType() : this.parseExpression());
          this.expect(tt.braceR);
          node.quasis.push(curElt = this.parseTemplateElement({ isTagged }));
        }
        this.next();
        return this.finishNode(node, "TemplateLiteral");
      }
      parseFunction(node, statement, allowExpressionBody, isAsync, forInit) {
        this.initFunction(node);
        if (this.ecmaVersion >= 9 || this.ecmaVersion >= 6 && !isAsync) {
          if (this.type === tt.star && statement & FUNC_HANGING_STATEMENT) {
            this.unexpected();
          }
          node.generator = this.eat(tt.star);
        }
        if (this.ecmaVersion >= 8) {
          node.async = !!isAsync;
        }
        if (statement & FUNC_STATEMENT) {
          node.id = statement & FUNC_NULLABLE_ID && this.type !== tt.name ? null : this.parseIdent();
        }
        let oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
        const oldMaybeInArrowParameters = this.maybeInArrowParameters;
        this.maybeInArrowParameters = false;
        this.yieldPos = 0;
        this.awaitPos = 0;
        this.awaitIdentPos = 0;
        this.enterScope(functionFlags(node.async, node.generator));
        if (!(statement & FUNC_STATEMENT)) {
          node.id = this.type === tt.name ? this.parseIdent() : null;
        }
        this.parseFunctionParams(node);
        const isDeclaration = statement & FUNC_STATEMENT;
        this.parseFunctionBody(node, allowExpressionBody, false, forInit, {
          isFunctionDeclaration: isDeclaration
        });
        if (isDeclaration && this.isAmbientContext && node.id) {
          const scope = this.currentScope();
          if (scope.flags & acornScope.SCOPE_TOP) {
            this.declareName(node.id.name, acornScope.BIND_FLAGS_TS_EXPORT_ONLY, node.id.start);
          }
        }
        this.yieldPos = oldYieldPos;
        this.awaitPos = oldAwaitPos;
        this.awaitIdentPos = oldAwaitIdentPos;
        if (statement & FUNC_STATEMENT && node.id && !(statement & FUNC_HANGING_STATEMENT)) {
          if (node.body) {
            this.checkLValSimple(
              node.id,
              this.strict || node.generator || node.async ? this.treatFunctionsAsVar ? acornScope.BIND_VAR : acornScope.BIND_LEXICAL : acornScope.BIND_FUNCTION
            );
          } else {
            this.checkLValSimple(node.id, acornScope.BIND_NONE);
          }
        }
        this.maybeInArrowParameters = oldMaybeInArrowParameters;
        return this.finishNode(node, isDeclaration ? "FunctionDeclaration" : "FunctionExpression");
      }
      parseFunctionBody(node, isArrowFunction = false, isMethod = false, forInit = false, tsConfig) {
        if (this.match(tt.colon)) {
          node.returnType = this.tsParseTypeOrTypePredicateAnnotation(tt.colon);
        }
        const bodilessType = tsConfig?.isFunctionDeclaration ? "TSDeclareFunction" : tsConfig?.isClassMethod ? "TSDeclareMethod" : void 0;
        if (bodilessType && !this.match(tt.braceL) && this.isLineTerminator()) {
          this.exitScope();
          return this.finishNode(node, bodilessType);
        }
        if (bodilessType === "TSDeclareFunction" && this.isAmbientContext) {
          this.raise(node.start, TypeScriptError.DeclareFunctionHasImplementation);
          if (node.declare) {
            super.parseFunctionBody(node, isArrowFunction, isMethod, false);
            return this.finishNode(node, bodilessType);
          }
        }
        super.parseFunctionBody(node, isArrowFunction, isMethod, forInit);
        return node;
      }
      parseNew() {
        if (this.containsEsc) this.raiseRecoverable(this.start, "Escape sequence in keyword new");
        let node = this.startNode();
        let meta = this.parseIdent(true);
        if (this.ecmaVersion >= 6 && this.eat(tt.dot)) {
          node.meta = meta;
          let containsEsc = this.containsEsc;
          node.property = this.parseIdent(true);
          if (node.property.name !== "target")
            this.raiseRecoverable(
              node.property.start,
              "The only valid meta property for new is 'new.target'"
            );
          if (containsEsc)
            this.raiseRecoverable(node.start, "'new.target' must not contain escaped characters");
          if (!this["allowNewDotTarget"])
            this.raiseRecoverable(
              node.start,
              "'new.target' can only be used in functions and class static block"
            );
          return this.finishNode(node, "MetaProperty");
        }
        let startPos = this.start, startLoc = this.startLoc, isImport = this.type === tt._import;
        node.callee = this.parseSubscripts(this.parseExprAtom(), startPos, startLoc, true, false);
        if (isImport && node.callee.type === "ImportExpression") {
          this.raise(startPos, "Cannot use new with import()");
        }
        const { callee } = node;
        if (callee.type === "TSInstantiationExpression" && !callee.extra?.parenthesized) {
          node.typeArguments = callee.typeArguments;
          node.callee = callee.expression;
        }
        if (this.eat(tt.parenL))
          node.arguments = this.parseExprList(tt.parenR, this.ecmaVersion >= 8, false);
        else node.arguments = [];
        return this.finishNode(node, "NewExpression");
      }
      parseExprOp(left, leftStartPos, leftStartLoc, minPrec, forInit) {
        if (tt._in.binop > minPrec && !this.hasPrecedingLineBreak()) {
          let nodeType;
          if (this.isContextual("as")) {
            nodeType = "TSAsExpression";
          }
          if (this.isContextual("satisfies")) {
            nodeType = "TSSatisfiesExpression";
          }
          if (nodeType) {
            const node = this.startNodeAt(leftStartPos, leftStartLoc);
            node.expression = left;
            const _const = this.tsTryNextParseConstantContext();
            if (_const) {
              node.typeAnnotation = _const;
            } else {
              node.typeAnnotation = this.tsNextThenParseType();
            }
            this.finishNode(node, nodeType);
            this.reScan_lt_gt();
            return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec, forInit);
          }
        }
        return super.parseExprOp(left, leftStartPos, leftStartLoc, minPrec, forInit);
      }
      parseImportSpecifiers() {
        let nodes = [], first = true;
        if (acornTypeScript.tokenIsIdentifier(this.type)) {
          nodes.push(this.parseImportDefaultSpecifier());
          if (!this.eat(tt.comma)) return nodes;
        }
        if (this.type === tt.star) {
          nodes.push(this.parseImportNamespaceSpecifier());
          return nodes;
        }
        this.expect(tt.braceL);
        while (!this.eat(tt.braceR)) {
          if (!first) {
            this.expect(tt.comma);
            if (this.afterTrailingComma(tt.braceR)) break;
          } else first = false;
          nodes.push(this.parseImportSpecifier());
        }
        return nodes;
      }
      parseImport(node) {
        let enterHead = this.lookahead();
        node.importKind = "value";
        this.importOrExportOuterKind = "value";
        if (tokenIsIdentifier(enterHead.type) || this.match(tt.star) || this.match(tt.braceL)) {
          let ahead = this.lookahead(2);
          if (
            ahead.type !== tt.comma &&
            !this.isContextualWithState("from", ahead) &&
            ahead.type !== tt.eq && this.ts_eatContextualWithState("type", 1, enterHead)
          ) {
            this.importOrExportOuterKind = "type";
            node.importKind = "type";
            enterHead = this.lookahead();
            ahead = this.lookahead(2);
          }
          if (tokenIsIdentifier(enterHead.type) && ahead.type === tt.eq) {
            this.next();
            const importNode = this.tsParseImportEqualsDeclaration(node);
            this.importOrExportOuterKind = "value";
            return importNode;
          }
        }
        this.next();
        if (this.type === tt.string) {
          node.specifiers = [];
          node.source = this.parseExprAtom();
        } else {
          node.specifiers = this.parseImportSpecifiers();
          this.expectContextual("from");
          node.source = this.type === tt.string ? this.parseExprAtom() : this.unexpected();
        }
        this.parseMaybeImportAttributes(node);
        this.semicolon();
        this.finishNode(node, "ImportDeclaration");
        this.importOrExportOuterKind = "value";
        if (node.importKind === "type" && node.specifiers.length > 1 && node.specifiers[0].type === "ImportDefaultSpecifier") {
          this.raise(node.start, TypeScriptError.TypeImportCannotSpecifyDefaultAndNamed);
        }
        return node;
      }
      parseExportDefaultDeclaration() {
        if (this.isAbstractClass()) {
          const cls = this.startNode();
          this.next();
          cls.abstract = true;
          return this.parseClass(cls, true);
        }
        if (this.match(tokTypes.interface)) {
          const result = this.tsParseInterfaceDeclaration(this.startNode());
          if (result) return result;
        }
        return super.parseExportDefaultDeclaration();
      }
      parseExportAllDeclaration(node, exports2) {
        if (this.ecmaVersion >= 11) {
          if (this.eatContextual("as")) {
            node.exported = this.parseModuleExportName();
            this.checkExport(exports2, node.exported, this.lastTokStart);
          } else {
            node.exported = null;
          }
        }
        this.expectContextual("from");
        if (this.type !== tt.string) this.unexpected();
        node.source = this.parseExprAtom();
        this.parseMaybeImportAttributes(node);
        this.semicolon();
        return this.finishNode(node, "ExportAllDeclaration");
      }
      parseDynamicImport(node) {
        this.next();
        node.source = this.parseMaybeAssign();
        if (this.eat(tt.comma)) {
          const expr = this.parseExpression();
          node.arguments = [expr];
        }
        if (!this.eat(tt.parenR)) {
          const errorPos = this.start;
          if (this.eat(tt.comma) && this.eat(tt.parenR)) {
            this.raiseRecoverable(errorPos, "Trailing comma is not allowed in import()");
          } else {
            this.unexpected(errorPos);
          }
        }
        return this.finishNode(node, "ImportExpression");
      }
      parseExport(node, exports2) {
        let enterHead = this.lookahead();
        if (this.ts_eatWithState(tt._import, 2, enterHead)) {
          if (this.ts_isContextual(tokTypes.type) && this.lookaheadCharCode() !== 61) {
            node.importKind = "type";
