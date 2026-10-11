            this.importOrExportOuterKind = "type";
            this.next();
          } else {
            node.importKind = "value";
            this.importOrExportOuterKind = "value";
          }
          const exportEqualsNode = this.tsParseImportEqualsDeclaration(
            node,
            true
          );
          this.importOrExportOuterKind = void 0;
          return exportEqualsNode;
        } else if (this.ts_eatWithState(tt.eq, 2, enterHead)) {
          const assign = node;
          assign.expression = this.parseExpression();
          this.semicolon();
          this.importOrExportOuterKind = void 0;
          return this.finishNode(assign, "TSExportAssignment");
        } else if (this.ts_eatContextualWithState("as", 2, enterHead)) {
          const decl = node;
          this.expectContextual("namespace");
          decl.id = this.parseIdent();
          this.semicolon();
          this.importOrExportOuterKind = void 0;
          return this.finishNode(decl, "TSNamespaceExportDeclaration");
        } else {
          const lookahead2 = this.lookahead(2).type;
          if (this.ts_isContextualWithState(enterHead, tokTypes.type) && (lookahead2 === tt.braceL ||
          lookahead2 === tt.star)) {
            this.next();
            this.importOrExportOuterKind = "type";
            node.exportKind = "type";
          } else {
            this.importOrExportOuterKind = "value";
            node.exportKind = "value";
          }
          this.next();
          if (this.eat(tt.star)) {
            return this.parseExportAllDeclaration(node, exports2);
          }
          if (this.eat(tt._default)) {
            this.checkExport(exports2, "default", this.lastTokStart);
            node.declaration = this.parseExportDefaultDeclaration();
            return this.finishNode(node, "ExportDefaultDeclaration");
          }
          if (this.shouldParseExportStatement()) {
            node.declaration = this.parseExportDeclaration(node);
            if (node.declaration.type === "VariableDeclaration")
              this.checkVariableExport(exports2, node.declaration.declarations);
            else this.checkExport(exports2, node.declaration.id, node.declaration.id.start);
            node.specifiers = [];
            node.source = null;
          } else {
            node.declaration = null;
            node.specifiers = this.parseExportSpecifiers(exports2);
            if (this.eatContextual("from")) {
              if (this.type !== tt.string) this.unexpected();
              node.source = this.parseExprAtom();
              this.parseMaybeImportAttributes(node);
            } else {
              for (let spec of node.specifiers) {
                this.checkUnreserved(spec.local);
                this.checkLocalExport(spec.local);
                if (spec.local.type === "Literal") {
                  this.raise(
                    spec.local.start,
                    "A string literal cannot be used as an exported binding without `from`."
                  );
                }
              }
              node.source = null;
            }
            this.semicolon();
          }
          return this.finishNode(node, "ExportNamedDeclaration");
        }
      }
      checkExport(exports2, name, _) {
        if (!exports2) {
          return;
        }
        if (typeof name !== "string") {
          name = name.type === "Identifier" ? name.name : name.value;
        }
        exports2[name] = true;
      }
      parseMaybeDefault(startPos, startLoc, left) {
        const node = super.parseMaybeDefault(startPos, startLoc, left);
        if (node.type === "AssignmentPattern" && node.typeAnnotation && node.right.start < node.typeAnnotation.start) {
          this.raise(node.typeAnnotation.start, TypeScriptError.TypeAnnotationAfterAssign);
        }
        return node;
      }
      typeCastToParameter(node) {
        node.expression.typeAnnotation = node.typeAnnotation;
        this.resetEndLocation(
          node.expression,
          node.typeAnnotation.end,
          node.typeAnnotation.loc?.end
        );
        return node.expression;
      }
      toAssignableList(exprList, isBinding) {
        if (!exprList) exprList = [];
        for (let i = 0; i < exprList.length; i++) {
          const expr = exprList[i];
          if (expr?.type === "TSTypeCastExpression") {
            exprList[i] = this.typeCastToParameter(expr);
          }
        }
        return super.toAssignableList(exprList, isBinding);
      }
      reportReservedArrowTypeParam(node) {
        if (node.params.length === 1 && !node.extra?.trailingComma && disallowAmbiguousJSXLike) {
          this.raise(node.start, TypeScriptError.ReservedArrowTypeParam);
        }
      }
      parseExprAtom(refDestructuringErrors, forInit, forNew) {
        if (this.type === tokTypes.jsxText) {
          return this.jsx_parseText();
        } else if (this.type === tokTypes.jsxTagStart) {
          return this.jsx_parseElement();
        } else if (this.type === tokTypes.at) {
          this.parseDecorators();
          return this.parseExprAtom();
        } else if (tokenIsIdentifier(this.type)) {
          let canBeArrow = this.potentialArrowAt === this.start;
          let startPos = this.start, startLoc = this.startLoc, containsEsc = this.containsEsc;
          let id = this.parseIdent(false);
          if (this.ecmaVersion >= 8 && !containsEsc && id.name === "async" && !this.canInsertSemicolon() && this.eat(tt._function)) {
            this.overrideContext(tokContexts.f_expr);
            return this.parseFunction(
              this.startNodeAt(startPos, startLoc),
              0,
              false,
              true,
              forInit
            );
          }
          if (canBeArrow && !this.canInsertSemicolon()) {
            if (this.eat(tt.arrow))
              return this.parseArrowExpression(
                this.startNodeAt(startPos, startLoc),
                [id],
                false,
                forInit
              );
            if (this.ecmaVersion >= 8 && id.name === "async" && this.type === tt.name && !containsEsc && (!this.potentialArrowInForAwait || this.value !== "of" || this.containsEsc)) {
              id = this.parseIdent(false);
              if (this.canInsertSemicolon() || !this.eat(tt.arrow)) this.unexpected();
              return this.parseArrowExpression(
                this.startNodeAt(startPos, startLoc),
                [id],
                true,
                forInit
              );
            }
          }
          return id;
        } else {
          return super.parseExprAtom(refDestructuringErrors, forInit, forNew);
        }
      }
      parseExprAtomDefault() {
        if (tokenIsIdentifier(this.type)) {
          const canBeArrow = this["potentialArrowAt"] === this.start;
          const containsEsc = this.containsEsc;
          const id = this.parseIdent();
          if (!containsEsc && id.name === "async" && !this.canInsertSemicolon()) {
            const { type } = this;
            if (type === tt._function) {
              this.next();
              return this.parseFunction(this.startNodeAtNode(id), void 0, true, true);
            } else if (tokenIsIdentifier(type)) {
              if (this.lookaheadCharCode() === 61) {
                const paramId = this.parseIdent(false);
                if (this.canInsertSemicolon() || !this.eat(tt.arrow)) this.unexpected();
                return this.parseArrowExpression(this.startNodeAtNode(id), [paramId], true);
              } else {
                return id;
              }
            }
          }
          if (canBeArrow && this.match(tt.arrow) && !this.canInsertSemicolon()) {
            this.next();
            return this.parseArrowExpression(this.startNodeAtNode(id), [id], false);
          }
          return id;
        } else {
          this.unexpected();
        }
      }
      parseIdentNode() {
        let node = this.startNode();
        if (tokenIsKeywordOrIdentifier(this.type) &&
        !((this.type.keyword === "class" || this.type.keyword === "function") && (this.lastTokEnd !== this.lastTokStart + 1 || this.input.charCodeAt(this.lastTokStart) !== 46))) {
          node.name = this.value;
        } else {
          return super.parseIdentNode();
        }
        return node;
      }
      parseVarStatement(node, kind, allowMissingInitializer = false) {
        const { isAmbientContext } = this;
        this.next();
        super.parseVar(node, false, kind, allowMissingInitializer || isAmbientContext);
        this.semicolon();
        const declaration = this.finishNode(node, "VariableDeclaration");
        if (!isAmbientContext) return declaration;
        for (const { id, init } of declaration.declarations) {
          if (!init) continue;
          if (kind !== "const" || !!id.typeAnnotation) {
            this.raise(init.start, TypeScriptError.InitializerNotAllowedInAmbientContext);
          } else if (init.type !== "Literal" && (init.type !== "TemplateLiteral" || init.expressions.length > 0) && !isAmbientNumericUnaryExpression(init) && !isPossiblyLiteralEnum(init)) {
            this.raise(
              init.start,
              TypeScriptError.ConstInitiailizerMustBeStringOrNumericLiteralOrLiteralEnumReference
            );
          }
        }
        return declaration;
      }
      parseStatement(context, topLevel, exports2) {
        if (this.match(tokTypes.at)) {
          this.parseDecorators(true);
        }
        if (this.match(tt._const) && this.isLookaheadContextual("enum")) {
          const node = this.startNode();
          this.expect(tt._const);
          return this.tsParseEnumDeclaration(node, { const: true });
        }
        if (this.ts_isContextual(tokTypes.enum)) {
          return this.tsParseEnumDeclaration(this.startNode());
        }
        if (this.ts_isContextual(tokTypes.interface)) {
          const result = this.tsParseInterfaceDeclaration(this.startNode());
          if (result) return result;
        }
        return super.parseStatement(context, topLevel, exports2);
      }
      parseAccessModifier() {
        return this.tsParseModifier(["public", "protected", "private"]);
      }
      parsePostMemberNameModifiers(methodOrProp) {
        const optional = this.eat(tt.question);
        if (optional) methodOrProp.optional = true;
        if (methodOrProp.readonly && this.match(tt.parenL)) {
          this.raise(methodOrProp.start, TypeScriptError.ClassMethodHasReadonly);
        }
        if (methodOrProp.declare && this.match(tt.parenL)) {
          this.raise(methodOrProp.start, TypeScriptError.ClassMethodHasDeclare);
        }
      }
      parseExpressionStatement(node, expr) {
        const decl = expr.type === "Identifier" ? this.tsParseExpressionStatement(node, expr) : void 0;
        return decl || super.parseExpressionStatement(node, expr);
      }
      shouldParseExportStatement() {
        if (this.tsIsDeclarationStart()) return true;
        if (this.match(tokTypes.at)) {
          return true;
        }
        return super.shouldParseExportStatement();
      }
      parseConditional(expr, startPos, startLoc, forInit, refDestructuringErrors) {
        if (this.eat(tt.question)) {
          let node = this.startNodeAt(startPos, startLoc);
          node.test = expr;
          node.consequent = this.parseMaybeAssign();
          this.expect(tt.colon);
          node.alternate = this.parseMaybeAssign(forInit);
          return this.finishNode(node, "ConditionalExpression");
        }
        return expr;
      }
      parseMaybeConditional(forInit, refDestructuringErrors) {
        let startPos = this.start, startLoc = this.startLoc;
        let expr = this.parseExprOps(forInit, refDestructuringErrors);
        if (this.checkExpressionErrors(refDestructuringErrors)) return expr;
        if (!this.maybeInArrowParameters || !this.match(tt.question)) {
          return this.parseConditional(expr, startPos, startLoc, forInit, refDestructuringErrors);
        }
        const result = this.tryParse(
          () => this.parseConditional(expr, startPos, startLoc, forInit, refDestructuringErrors)
        );
        if (!result.node) {
          if (result.error) {
            this.setOptionalParametersError(refDestructuringErrors, result.error);
          }
          return expr;
        }
        return result.node;
      }
      parseParenItem(node) {
        const startPos = this.start;
        const startLoc = this.startLoc;
        node = super.parseParenItem(node);
        if (this.eat(tt.question)) {
          node.optional = true;
          this.resetEndLocation(node);
        }
        if (this.match(tt.colon)) {
          const typeCastNode = this.startNodeAt(startPos, startLoc);
          typeCastNode.expression = node;
          typeCastNode.typeAnnotation = this.tsParseTypeAnnotation();
          return this.finishNode(typeCastNode, "TSTypeCastExpression");
        }
        return node;
      }
      parseExportDeclaration(node) {
        if (!this.isAmbientContext && this.ts_isContextual(tokTypes.declare)) {
          return this.tsInAmbientContext(() => this.parseExportDeclaration(node));
        }
        const startPos = this.start;
        const startLoc = this.startLoc;
        const isDeclare = this.eatContextual("declare");
        if (isDeclare && (this.ts_isContextual(tokTypes.declare) || !this.shouldParseExportStatement())) {
          this.raise(this.start, TypeScriptError.ExpectedAmbientAfterExportDeclare);
        }
        const isIdentifier = tokenIsIdentifier(this.type);
        const declaration = isIdentifier && this.tsTryParseExportDeclaration() || this.parseStatement(null);
        if (!declaration) return null;
        if (declaration.type === "TSInterfaceDeclaration" || declaration.type === "TSTypeAliasDeclaration" || isDeclare) {
          node.exportKind = "type";
        }
        if (isDeclare) {
          this.resetStartLocation(declaration, startPos, startLoc);
          declaration.declare = true;
        }
        return declaration;
      }
      parseClassId(node, isStatement) {
        if (!isStatement && this.isContextual("implements")) {
          return;
        }
        super.parseClassId(node, isStatement);
        const typeParameters = this.tsTryParseTypeParameters(
          this.tsParseClassTypeParameterModifiers.bind(this)
        );
        if (typeParameters) node.typeParameters = typeParameters;
      }
      parseClassPropertyAnnotation(node) {
