        });
        if (result.error) {
          return this.tsParseTypeParameters(this.tsParseConstModifier);
        } else {
          return result.node;
        }
      }
      tsParseTypeArguments(inExpression = false) {
        const node = this.startNode();
        node.params = this.tsInType(
          () => (
            this.tsInNoContext(() => {
              this.expect(tt.relational);
              return this.tsParseDelimitedList(
                "TypeParametersOrArguments",
                this.tsParseType.bind(this)
              );
            })
          )
        );
        if (node.params.length === 0) {
          this.raise(this.start, TypeScriptError.EmptyTypeArguments);
        }
        if (inExpression && this.curContext() !== tsTokContexts.tc_oTag) {
          this.reScan_lt_gt();
        }
        if (!this.tsMatchRightRelational()) {
          this.unexpected();
        }
        this.exprAllowed = false;
        this.next();
        return this.finishNode(node, "TSTypeParameterInstantiation");
      }
      tsParseHeritageClause(token) {
        const originalStart = this.start;
        const delimitedList = this.tsParseDelimitedList("HeritageClauseElement", () => {
          const node = this.startNode();
          node.expression = this.tsParseEntityName();
          if (this.tsMatchLeftRelational()) {
            node.typeParameters = this.tsParseTypeArguments();
          }
          return this.finishNode(node, "TSExpressionWithTypeArguments");
        });
        if (!delimitedList.length) {
          this.raise(originalStart, TypeScriptError.EmptyHeritageClauseType({ token }));
        }
        return delimitedList;
      }
      tsParseTypeMemberSemicolon() {
        if (!this.eat(tt.comma) && !this.isLineTerminator()) {
          this.expect(tt.semi);
        }
      }
      tsTryParseAndCatch(f) {
        const result = this.tryParse(
          (abort) => (
            f() || abort()
          )
        );
        if (result.aborted || !result.node) return void 0;
        return result.node;
      }
      tsParseSignatureMember(kind, node) {
        this.tsFillSignature(tt.colon, node);
        this.tsParseTypeMemberSemicolon();
        return this.finishNode(node, kind);
      }
      tsParsePropertyOrMethodSignature(node, readonly) {
        if (this.eat(tt.question)) node.optional = true;
        const nodeAny = node;
        if (this.match(tt.parenL) || this.tsMatchLeftRelational()) {
          if (readonly) {
            this.raise(node.start, TypeScriptError.ReadonlyForMethodSignature);
          }
          const method = nodeAny;
          if (method.kind && this.tsMatchLeftRelational()) {
            this.raise(this.start, TypeScriptError.AccesorCannotHaveTypeParameters);
          }
          this.tsFillSignature(tt.colon, method);
          this.tsParseTypeMemberSemicolon();
          const paramsKey = "parameters";
          const returnTypeKey = "typeAnnotation";
          if (method.kind === "get") {
            if (method[paramsKey].length > 0) {
              this.raise(this.start, "A 'get' accesor must not have any formal parameters.");
              if (this.isThisParam(method[paramsKey][0])) {
                this.raise(this.start, TypeScriptError.AccesorCannotDeclareThisParameter);
              }
            }
          } else if (method.kind === "set") {
            if (method[paramsKey].length !== 1) {
              this.raise(this.start, "A 'get' accesor must not have any formal parameters.");
            } else {
              const firstParameter = method[paramsKey][0];
              if (this.isThisParam(firstParameter)) {
                this.raise(this.start, TypeScriptError.AccesorCannotDeclareThisParameter);
              }
              if (firstParameter.type === "Identifier" && firstParameter.optional) {
                this.raise(this.start, TypeScriptError.SetAccesorCannotHaveOptionalParameter);
              }
              if (firstParameter.type === "RestElement") {
                this.raise(this.start, TypeScriptError.SetAccesorCannotHaveRestParameter);
              }
            }
            if (method[returnTypeKey]) {
              this.raise(
                method[returnTypeKey].start,
                TypeScriptError.SetAccesorCannotHaveReturnType
              );
            }
          } else {
            method.kind = "method";
          }
          return this.finishNode(method, "TSMethodSignature");
        } else {
          const property = nodeAny;
          if (readonly) property.readonly = true;
          const type = this.tsTryParseTypeAnnotation();
          if (type) property.typeAnnotation = type;
          this.tsParseTypeMemberSemicolon();
          return this.finishNode(property, "TSPropertySignature");
        }
      }
      tsParseTypeMember() {
        const node = this.startNode();
        if (this.match(tt.parenL) || this.tsMatchLeftRelational()) {
          return this.tsParseSignatureMember("TSCallSignatureDeclaration", node);
        }
        if (this.match(tt._new)) {
          const id = this.startNode();
          this.next();
          if (this.match(tt.parenL) || this.tsMatchLeftRelational()) {
            return this.tsParseSignatureMember("TSConstructSignatureDeclaration", node);
          } else {
            node.key = this.createIdentifier(id, "new");
            return this.tsParsePropertyOrMethodSignature(node, false);
          }
        }
        this.tsParseModifiers({
          modified: node,
          allowedModifiers: ["readonly"],
          disallowedModifiers: [
            "declare",
            "abstract",
            "private",
            "protected",
            "public",
            "static",
            "override"
          ]
        });
        const idx = this.tsTryParseIndexSignature(node);
        if (idx) {
          return idx;
        }
        this.parsePropertyName(node);
        if (!node.computed && node.key.type === "Identifier" && (node.key.name === "get" || node.key.name === "set") && this.tsTokenCanFollowModifier()) {
          node.kind = node.key.name;
          this.parsePropertyName(node);
        }
        return this.tsParsePropertyOrMethodSignature(node, !!node.readonly);
      }
      tsParseList(kind, parseElement) {
        const result = [];
        while (!this.tsIsListTerminator(kind)) {
          result.push(parseElement());
        }
        return result;
      }
      tsParseObjectTypeMembers() {
        this.expect(tt.braceL);
        const members = this.tsParseList("TypeMembers", this.tsParseTypeMember.bind(this));
        this.expect(tt.braceR);
        return members;
      }
      tsParseInterfaceDeclaration(node, properties = {}) {
        if (this.hasFollowingLineBreak()) return null;
        this.expectContextual("interface");
        if (properties.declare) node.declare = true;
        if (tokenIsIdentifier(this.type)) {
          node.id = this.parseIdent();
          this.checkLValSimple(node.id, acornScope.BIND_TS_INTERFACE);
          const scope = this.currentScope();
          this.maybeExportDefined(scope, node.id.name);
        } else {
          node.id = null;
          this.raise(this.start, TypeScriptError.MissingInterfaceName);
        }
        node.typeParameters = this.tsTryParseTypeParameters(this.tsParseInOutModifiers.bind(this));
        if (this.eat(tt._extends)) {
          node.extends = this.tsParseHeritageClause("extends");
        }
        const body = this.startNode();
        body.body = this.tsParseInterfaceBody();
        node.body = this.finishNode(body, "TSInterfaceBody");
        return this.finishNode(node, "TSInterfaceDeclaration");
      }
      tsParseInterfaceBody() {
        this.expect(tt.braceL);
        const oldInType = this.inType;
        this.inType = true;
        let members = this.tsParseList("TypeMembers", this.tsParseTypeMember.bind(this));
        this.inType = oldInType;
        this.expect(tt.braceR);
        return members;
      }
      tsParseAbstractDeclaration(node) {
        if (this.match(tt._class)) {
          node.abstract = true;
          return this.parseClass(node, true);
        } else if (this.ts_isContextual(tokTypes.interface)) {
          if (!this.hasFollowingLineBreak()) {
            node.abstract = true;
            return this.tsParseInterfaceDeclaration(node);
          }
        } else {
          this.unexpected(node.start);
        }
      }
      tsIsDeclarationStart() {
        return tokenIsTSDeclarationStart(this.type);
      }
      tsParseExpressionStatement(node, expr) {
        switch (expr.name) {
          case "declare": {
            const declaration = this.tsTryParseDeclare(node);
            if (declaration) {
              declaration.declare = true;
              return declaration;
            }
            break;
          }
          case "global":
            if (this.match(tt.braceL)) {
              this.enterScope(TS_SCOPE_TS_MODULE);
              const mod = node;
              mod.global = true;
              mod.id = expr;
              mod.body = this.tsParseModuleBlock();
              super.exitScope();
              return this.finishNode(mod, "TSModuleDeclaration");
            }
            break;
          default:
            return this.tsParseDeclaration(
              node,
              expr.name,
              false
            );
        }
      }
      tsParseModuleReference() {
        return this.tsIsExternalModuleReference() ? this.tsParseExternalModuleReference() : this.tsParseEntityName(
          false
        );
      }
      tsIsExportDefaultSpecifier() {
        const { type } = this;
        const isAsync = this.isAsyncFunction();
        const isLet = this.isLet();
        if (tokenIsIdentifier(type)) {
          if (isAsync && !this.containsEsc || isLet) {
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
      tsInAmbientContext(cb) {
        const oldIsAmbientContext = this.isAmbientContext;
        this.isAmbientContext = true;
        try {
          return cb();
        } finally {
          this.isAmbientContext = oldIsAmbientContext;
        }
      }
      tsCheckLineTerminator(next) {
        if (next) {
          if (this.hasFollowingLineBreak()) return false;
          this.next();
          return true;
        }
        return !this.isLineTerminator();
      }
      tsParseModuleOrNamespaceDeclaration(node, nested = false) {
        node.id = this.parseIdent();
        if (!nested) {
          this.checkLValSimple(node.id, acornScope.BIND_TS_NAMESPACE);
        }
        if (this.eat(tt.dot)) {
          const inner = this.startNode();
          this.tsParseModuleOrNamespaceDeclaration(inner, true);
          node.body = inner;
        } else {
          this.enterScope(TS_SCOPE_TS_MODULE);
          node.body = this.tsParseModuleBlock();
          super.exitScope();
        }
        return this.finishNode(node, "TSModuleDeclaration");
      }
      checkLValSimple(expr, bindingType = acornScope.BIND_NONE, checkClashes) {
        while (expr.type === "TSNonNullExpression" || expr.type === "TSAsExpression" || expr.type === "TSSatisfiesExpression" || expr.type === "TSTypeAssertion") {
          expr = expr.expression;
        }
        return super.checkLValSimple(expr, bindingType, checkClashes);
      }
      isSimpleAssignTarget(expr) {
        while (expr.type === "TSNonNullExpression" || expr.type === "TSAsExpression" || expr.type === "TSSatisfiesExpression" || expr.type === "TSTypeAssertion") {
          expr = expr.expression;
        }
        return super.isSimpleAssignTarget(expr);
      }
      tsParseTypeAliasDeclaration(node) {
        node.id = this.parseIdent();
        this.checkLValSimple(node.id, acornScope.BIND_TS_TYPE);
        const scope = this.currentScope();
        this.maybeExportDefined(scope, node.id.name);
        node.typeAnnotation = this.tsInType(() => {
          node.typeParameters = this.tsTryParseTypeParameters(
            this.tsParseInOutModifiers.bind(this)
          );
          this.expect(tt.eq);
          if (this.ts_isContextual(tokTypes.interface) && this.lookahead().type !== tt.dot) {
            const node2 = this.startNode();
            this.next();
