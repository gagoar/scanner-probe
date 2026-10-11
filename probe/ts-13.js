        if (!node.optional) {
          if (this.value === "!" && this.eat(tt.prefix)) {
            node.definite = true;
          } else if (this.eat(tt.question)) {
            node.optional = true;
          }
        }
        const type = this.tsTryParseTypeAnnotation();
        if (type) node.typeAnnotation = type;
      }
      parseClassField(field) {
        const isPrivate = field.key.type === "PrivateIdentifier";
        if (isPrivate) {
          if (field.abstract) {
            this.raise(field.start, TypeScriptError.PrivateElementHasAbstract);
          }
          if (field.accessibility) {
            this.raise(
              field.start,
              TypeScriptError.PrivateElementHasAccessibility({
                modifier: field.accessibility
              })
            );
          }
          this.parseClassPropertyAnnotation(field);
        } else {
          this.parseClassPropertyAnnotation(field);
          if (this.isAmbientContext && !(field.readonly && !field.typeAnnotation) && this.match(tt.eq)) {
            this.raise(this.start, TypeScriptError.DeclareClassFieldHasInitializer);
          }
          if (field.abstract && this.match(tt.eq)) {
            const { key } = field;
            this.raise(
              this.start,
              TypeScriptError.AbstractPropertyHasInitializer({
                propertyName: key.type === "Identifier" && !field.computed ? key.name : "[" + this.input.slice(key.start, key.end) + "]"
              })
            );
          }
        }
        return super.parseClassField(field);
      }
      parseClassMethod(method, isGenerator, isAsync, allowsDirectSuper) {
        const isConstructor = method.kind === "constructor";
        const isPrivate = method.key.type === "PrivateIdentifier";
        const typeParameters = this.tsTryParseTypeParameters(this.tsParseConstModifier);
        if (isPrivate) {
          if (typeParameters) method.typeParameters = typeParameters;
          if (method.accessibility) {
            this.raise(
              method.start,
              TypeScriptError.PrivateMethodsHasAccessibility({
                modifier: method.accessibility
              })
            );
          }
        } else {
          if (typeParameters && isConstructor) {
            this.raise(typeParameters.start, TypeScriptError.ConstructorHasTypeParameters);
          }
        }
        const { declare = false, kind } = method;
        if (declare && (kind === "get" || kind === "set")) {
          this.raise(method.start, TypeScriptError.DeclareAccessor({ kind }));
        }
        if (typeParameters) method.typeParameters = typeParameters;
        const key = method.key;
        if (method.kind === "constructor") {
          if (isGenerator) this.raise(key.start, "Constructor can't be a generator");
          if (isAsync) this.raise(key.start, "Constructor can't be an async method");
        } else if (method.static && checkKeyName(method, "prototype")) {
          this.raise(key.start, "Classes may not have a static property named prototype");
        }
        const value = method.value = this.parseMethod(
          isGenerator,
          isAsync,
          allowsDirectSuper,
          true,
          method
        );
        if (method.kind === "get" && value["params"].length !== 0)
          this.raiseRecoverable(value.start, "getter should have no params");
        if (method.kind === "set" && value["params"].length !== 1)
          this.raiseRecoverable(value.start, "setter should have exactly one param");
        if (method.kind === "set" && value["params"][0].type === "RestElement")
          this.raiseRecoverable(value["params"][0].start, "Setter cannot use rest params");
        return this.finishNode(method, "MethodDefinition");
      }
      isClassMethod() {
        return this.match(tt.relational);
      }
      parseClassElement(constructorAllowsSuper) {
        if (this.eat(tt.semi)) return null;
        let node = this.startNode();
        let keyName = "";
        let isGenerator = false;
        let isAsync = false;
        let kind = "method";
        let isStatic = false;
        const modifiers = [
          "declare",
          "private",
          "public",
          "protected",
          "accessor",
          "override",
          "abstract",
          "readonly",
          "static"
        ];
        const modifierMap = this.tsParseModifiers({
          modified: node,
          allowedModifiers: modifiers,
          disallowedModifiers: ["in", "out"],
          stopOnStartOfClassStaticBlock: true,
          errorTemplate: TypeScriptError.InvalidModifierOnTypeParameterPositions
        });
        isStatic = Boolean(modifierMap.static);
        const callParseClassMemberWithIsStatic = () => {
          if (this.tsIsStartOfStaticBlocks()) {
            this.next();
            this.next();
            if (this.tsHasSomeModifiers(node, modifiers)) {
              this.raise(this.start, TypeScriptError.StaticBlockCannotHaveModifier);
            }
            if (this.ecmaVersion >= 13) {
              super.parseClassStaticBlock(node);
              return node;
            }
          } else {
            const idx = this.tsTryParseIndexSignature(node);
            if (idx) {
              if (node.abstract) {
                this.raise(node.start, TypeScriptError.IndexSignatureHasAbstract);
              }
              if (node.accessibility) {
                this.raise(
                  node.start,
                  TypeScriptError.IndexSignatureHasAccessibility({
                    modifier: node.accessibility
                  })
                );
              }
              if (node.declare) {
                this.raise(node.start, TypeScriptError.IndexSignatureHasDeclare);
              }
              if (node.override) {
                this.raise(node.start, TypeScriptError.IndexSignatureHasOverride);
              }
              return idx;
            }
            if (!this.inAbstractClass && node.abstract) {
              this.raise(node.start, TypeScriptError.NonAbstractClassHasAbstractMethod);
            }
            if (node.override) {
              if (!constructorAllowsSuper) {
                this.raise(node.start, TypeScriptError.OverrideNotInSubClass);
              }
            }
            node.static = isStatic;
            if (isStatic) {
              if (!(this.isClassElementNameStart() || this.type === tt.star)) {
                keyName = "static";
              }
            }
            if (!keyName && this.ecmaVersion >= 8 && this.eatContextual("async")) {
              if ((this.isClassElementNameStart() || this.type === tt.star) && !this.canInsertSemicolon()) {
                isAsync = true;
              } else {
                keyName = "async";
              }
            }
            if (!keyName && (this.ecmaVersion >= 9 || !isAsync) && this.eat(tt.star)) {
              isGenerator = true;
            }
            if (!keyName && !isAsync && !isGenerator) {
              const lastValue = this.value;
              if (this.eatContextual("get") || this.eatContextual("set")) {
                if (this.isClassElementNameStart()) {
                  kind = lastValue;
                } else {
                  keyName = lastValue;
                }
              }
            }
            if (keyName) {
              node.computed = false;
              node.key = this.startNodeAt(this.lastTokStart, this.lastTokStartLoc);
              node.key.name = keyName;
              this.finishNode(node.key, "Identifier");
            } else {
              this.parseClassElementName(node);
            }
            this.parsePostMemberNameModifiers(node);
            if (this.isClassMethod() || this.ecmaVersion < 13 || this.type === tt.parenL || kind !== "method" || isGenerator || isAsync) {
              const isConstructor = !node.static && checkKeyName(node, "constructor");
              const allowsDirectSuper = isConstructor && constructorAllowsSuper;
              if (isConstructor && kind !== "method")
                this.raise(node.key.start, "Constructor can't have an accessor modifier");
              node.kind = isConstructor ? "constructor" : kind;
              this.parseClassMethod(node, isGenerator, isAsync, allowsDirectSuper);
            } else {
              this.parseClassField(node);
            }
            return node;
          }
        };
        if (node.declare) {
          this.tsInAmbientContext(callParseClassMemberWithIsStatic);
        } else {
          callParseClassMemberWithIsStatic();
        }
        return node;
      }
      isClassElementNameStart() {
        if (this.tsIsIdentifier()) {
          return true;
        }
        return super.isClassElementNameStart();
      }
      parseClassSuper(node) {
        super.parseClassSuper(node);
        if (node.superClass && (this.tsMatchLeftRelational() || this.match(tt.bitShift))) {
          node.superTypeParameters = this.tsParseTypeArgumentsInExpression();
        }
        if (this.eatContextual("implements")) {
          node.implements = this.tsParseHeritageClause("implements");
        }
      }
      parseFunctionParams(node) {
        const typeParameters = this.tsTryParseTypeParameters(this.tsParseConstModifier);
        if (typeParameters) node.typeParameters = typeParameters;
        super.parseFunctionParams(node);
      }
      parseVarId(decl, kind) {
        super.parseVarId(decl, kind);
        if (decl.id.type === "Identifier" && !this.hasPrecedingLineBreak() && this.value === "!" && this.eat(tt.prefix)) {
          decl.definite = true;
        }
        const type = this.tsTryParseTypeAnnotation();
        if (type) {
          decl.id.typeAnnotation = type;
          this.resetEndLocation(decl.id);
        }
      }
      parseArrowExpression(node, params, isAsync, forInit) {
        if (this.match(tt.colon)) {
          node.returnType = this.tsParseTypeAnnotation();
        }
        let oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
        this.enterScope(functionFlags(isAsync, false) | acornScope.SCOPE_ARROW);
        this.initFunction(node);
        const oldMaybeInArrowParameters = this.maybeInArrowParameters;
        if (this.ecmaVersion >= 8) node.async = !!isAsync;
        this.yieldPos = 0;
        this.awaitPos = 0;
        this.awaitIdentPos = 0;
        this.maybeInArrowParameters = true;
        node.params = this.toAssignableList(params, true);
        this.maybeInArrowParameters = false;
        this.parseFunctionBody(node, true, false, forInit);
        this.yieldPos = oldYieldPos;
        this.awaitPos = oldAwaitPos;
        this.awaitIdentPos = oldAwaitIdentPos;
        this.maybeInArrowParameters = oldMaybeInArrowParameters;
        return this.finishNode(node, "ArrowFunctionExpression");
      }
      parseYield(forInit) {
        if (!this.yieldPos) this.yieldPos = this.start;
        const node = this.startNode();
        this.next();
        const startsTypeScriptExpression = this.tsMatchLeftRelational();
        const hasArgument = !this.match(tt.semi) && !this.canInsertSemicolon() && (this.match(tt.star) || this.type.startsExpr || startsTypeScriptExpression);
        if (!hasArgument) {
          node.delegate = false;
          node.argument = null;
          return this.finishNode(node, "YieldExpression");
        }
        node.delegate = this.eat(tt.star);
        node.argument = this.parseMaybeAssign(forInit);
        return this.finishNode(node, "YieldExpression");
      }
      parseMaybeAssignOrigin(forInit, refDestructuringErrors, afterLeftParse) {
        if (this.isContextual("yield")) {
          if (this.inGenerator) return this.parseYield(forInit);
          else this.exprAllowed = false;
        }
        let ownDestructuringErrors = false, oldParenAssign = -1, oldTrailingComma = -1, oldDoubleProto = -1;
        if (refDestructuringErrors) {
          oldParenAssign = refDestructuringErrors.parenthesizedAssign;
          oldTrailingComma = refDestructuringErrors.trailingComma;
          oldDoubleProto = refDestructuringErrors.doubleProto;
          refDestructuringErrors.parenthesizedAssign = refDestructuringErrors.trailingComma = -1;
        } else {
          refDestructuringErrors = new DestructuringErrors();
          ownDestructuringErrors = true;
        }
        let startPos = this.start, startLoc = this.startLoc;
        if (this.type === tt.parenL || tokenIsIdentifier(this.type)) {
          this.potentialArrowAt = this.start;
          this.potentialArrowInForAwait = forInit === "await";
        }
        let left = this.parseMaybeConditional(forInit, refDestructuringErrors);
        if (afterLeftParse) left = afterLeftParse.call(this, left, startPos, startLoc);
        if (this.type.isAssign) {
          let node = this.startNodeAt(startPos, startLoc);
          node.operator = this.value;
          if (this.type === tt.eq)
            left = this.toAssignable(left, true, refDestructuringErrors, true);
          if (!ownDestructuringErrors) {
            refDestructuringErrors.parenthesizedAssign = refDestructuringErrors.trailingComma = refDestructuringErrors.doubleProto = -1;
          }
          if (refDestructuringErrors.shorthandAssign >= left.start)
            refDestructuringErrors.shorthandAssign = -1;
          if (!this.maybeInArrowParameters) {
            if (this.type === tt.eq) this.checkLValPattern(left);
            else this.checkLValSimple(left);
          }
          node.left = left;
          this.next();
          node.right = this.parseMaybeAssign(forInit);
          if (oldDoubleProto > -1) refDestructuringErrors.doubleProto = oldDoubleProto;
          return this.finishNode(node, "AssignmentExpression");
        } else {
          if (ownDestructuringErrors) this.checkExpressionErrors(refDestructuringErrors, true);
        }
        if (oldParenAssign > -1) refDestructuringErrors.parenthesizedAssign = oldParenAssign;
        if (oldTrailingComma > -1) refDestructuringErrors.trailingComma = oldTrailingComma;
        return left;
      }
      parseMaybeAssign(forInit, refExpressionErrors, afterLeftParse) {
        let jsx;
        let typeCast;
        if (options?.jsx && (this.matchJsx("jsxTagStart") || this.tsMatchLeftRelational())) {
          jsx = this.tryParse(
            () => this.parseMaybeAssignOrigin(forInit, refExpressionErrors, afterLeftParse)
          );
          if (!jsx.error) return jsx.node;
          const context = this.context;
          const currentContext = context[context.length - 1];
          const lastCurrentContext = context[context.length - 2];
          if (currentContext === acornTypeScript.tokContexts.tc_oTag && lastCurrentContext === acornTypeScript.tokContexts.tc_expr) {
