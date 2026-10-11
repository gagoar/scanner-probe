          });
          if (result.aborted) {
            this.shouldParseAsyncArrowReturnType = void 0;
            return false;
          }
          if (!result.thrown) {
            this.shouldParseAsyncArrowReturnType = result.node;
            return !this.canInsertSemicolon() && this.eat(tt.arrow);
          }
        } else {
          return !this.canInsertSemicolon() && this.eat(tt.arrow);
        }
      }
      parseSubscriptAsyncArrow(startPos, startLoc, exprList, forInit) {
        const arrN = this.startNodeAt(startPos, startLoc);
        arrN.returnType = this.shouldParseAsyncArrowReturnType;
        this.shouldParseAsyncArrowReturnType = void 0;
        return this.parseArrowExpression(arrN, exprList, true, forInit);
      }
      parseExprList(close, allowTrailingComma, allowEmpty, refDestructuringErrors) {
        let elts = [], first = true;
        while (!this.eat(close)) {
          if (!first) {
            this.expect(tt.comma);
            if (allowTrailingComma && this.afterTrailingComma(close)) break;
          } else first = false;
          let elt;
          if (allowEmpty && this.type === tt.comma) elt = null;
          else if (this.type === tt.ellipsis) {
            elt = this.parseSpread(refDestructuringErrors);
            if (this.maybeInArrowParameters && this.match(tt.colon)) {
              elt.typeAnnotation = this.tsParseTypeAnnotation();
            }
            if (refDestructuringErrors && this.type === tt.comma && refDestructuringErrors.trailingComma < 0)
              refDestructuringErrors.trailingComma = this.start;
          } else {
            elt = this.parseMaybeAssign(false, refDestructuringErrors, this.parseParenItem);
          }
          elts.push(elt);
        }
        return elts;
      }
      parseMaybeDecoratorArguments(expr) {
        const typeArguments = this.tsMatchLeftRelational() || this.match(tt.bitShift) ? this.tsParseTypeArgumentsInExpression() : void 0;
        if (this.eat(tt.parenL)) {
          const node = this.startNodeAtNode(expr);
          node.callee = expr;
          node.arguments = this.parseExprList(tt.parenR, false);
          if (typeArguments) node.typeArguments = typeArguments;
          return this.finishNode(node, "CallExpression");
        }
        if (typeArguments) {
          const node = this.startNodeAtNode(expr);
          node.expression = expr;
          node.typeArguments = typeArguments;
          return this.finishNode(node, "TSInstantiationExpression");
        }
        return expr;
      }
      parseSubscript(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained, forInit) {
        let _optionalChained = optionalChained;
        if (!this.hasPrecedingLineBreak() &&
        this.value === "!" && this.match(tt.prefix)) {
          this.exprAllowed = false;
          this.next();
          const nonNullExpression = this.startNodeAt(startPos, startLoc);
          nonNullExpression.expression = base;
          base = this.finishNode(nonNullExpression, "TSNonNullExpression");
          return base;
        }
        let isOptionalCall = false;
        if (this.match(tt.questionDot) && this.lookaheadCharCode() === 60) {
          if (noCalls) {
            return base;
          }
          base.optional = true;
          _optionalChained = isOptionalCall = true;
          this.next();
        }
        if (this.tsMatchLeftRelational() || this.match(tt.bitShift)) {
          let missingParenErrorLoc;
          const result = this.tsTryParseAndCatch(() => {
            if (!noCalls && this.atPossibleAsyncArrow(base)) {
              const asyncArrowFn = this.tsTryParseGenericAsyncArrowFunction(
                startPos,
                startLoc,
                forInit
              );
              if (asyncArrowFn) {
                base = asyncArrowFn;
                return base;
              }
            }
            const typeArguments = this.tsParseTypeArgumentsInExpression();
            if (!typeArguments) return base;
            if (isOptionalCall && !this.match(tt.parenL)) {
              missingParenErrorLoc = this.curPosition();
              return base;
            }
            if (tokenIsTemplate(this.type) || this.type === tt.backQuote) {
              const result2 = this.parseTaggedTemplateExpression(
                base,
                startPos,
                startLoc,
                _optionalChained
              );
              result2.typeArguments = typeArguments;
              return result2;
            }
            if (!noCalls && this.eat(tt.parenL)) {
              let refDestructuringErrors = new DestructuringErrors();
              const node2 = this.startNodeAt(startPos, startLoc);
              node2.callee = base;
              node2.arguments = this.parseExprList(
                tt.parenR,
                this.ecmaVersion >= 8,
                false,
                refDestructuringErrors
              );
              this.tsCheckForInvalidTypeCasts(node2.arguments);
              node2.typeArguments = typeArguments;
              if (_optionalChained) {
                node2.optional = isOptionalCall;
              }
              this.checkExpressionErrors(refDestructuringErrors, true);
              base = this.finishNode(node2, "CallExpression");
              return base;
            }
            const tokenType = this.type;
            if (
              this.tsMatchRightRelational() ||
              tokenType === tt.bitShift ||
              tokenType !== tt.parenL && tokenCanStartExpression(tokenType) && !this.hasPrecedingLineBreak()
            ) {
              return;
            }
            const node = this.startNodeAt(startPos, startLoc);
            node.expression = base;
            node.typeArguments = typeArguments;
            return this.finishNode(node, "TSInstantiationExpression");
          });
          if (missingParenErrorLoc) {
            this.unexpected(missingParenErrorLoc);
          }
          if (result) {
            if (result.type === "TSInstantiationExpression" && (this.match(tt.dot) || this.match(tt.questionDot) && this.lookaheadCharCode() !== 40)) {
              this.raise(
                this.start,
                TypeScriptError.InvalidPropertyAccessAfterInstantiationExpression
              );
            }
            base = result;
            return base;
          }
        }
        let optionalSupported = this.ecmaVersion >= 11;
        let optional = optionalSupported && this.eat(tt.questionDot);
        if (noCalls && optional)
          this.raise(
            this.lastTokStart,
            "Optional chaining cannot appear in the callee of new expressions"
          );
        let computed = this.eat(tt.bracketL);
        if (computed || optional && this.type !== tt.parenL && this.type !== tt.backQuote || this.eat(tt.dot)) {
          let node = this.startNodeAt(startPos, startLoc);
          node.object = base;
          if (computed) {
            node.property = this.parseExpression();
            this.expect(tt.bracketR);
          } else if (this.type === tt.privateId && base.type !== "Super") {
            node.property = this.parsePrivateIdent();
          } else {
            node.property = this.parseIdent(this.options.allowReserved !== "never");
          }
          node.computed = !!computed;
          if (optionalSupported) {
            node.optional = optional;
          }
          base = this.finishNode(node, "MemberExpression");
        } else if (!noCalls && this.eat(tt.parenL)) {
          const oldMaybeInArrowParameters = this.maybeInArrowParameters;
          this.maybeInArrowParameters = true;
          let refDestructuringErrors = new DestructuringErrors(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
          this.yieldPos = 0;
          this.awaitPos = 0;
          this.awaitIdentPos = 0;
          let exprList = this.parseExprList(
            tt.parenR,
            this.ecmaVersion >= 8,
            false,
            refDestructuringErrors
          );
          if (maybeAsyncArrow && !optional && this.shouldParseAsyncArrow()) {
            this.checkPatternErrors(refDestructuringErrors, false);
            this.checkYieldAwaitInDefaultParams();
            if (this.awaitIdentPos > 0)
              this.raise(
                this.awaitIdentPos,
                "Cannot use 'await' as identifier inside an async function"
              );
            this.yieldPos = oldYieldPos;
            this.awaitPos = oldAwaitPos;
            this.awaitIdentPos = oldAwaitIdentPos;
            base = this.parseSubscriptAsyncArrow(startPos, startLoc, exprList, forInit);
          } else {
            this.checkExpressionErrors(refDestructuringErrors, true);
            this.yieldPos = oldYieldPos || this.yieldPos;
            this.awaitPos = oldAwaitPos || this.awaitPos;
            this.awaitIdentPos = oldAwaitIdentPos || this.awaitIdentPos;
            let node = this.startNodeAt(startPos, startLoc);
            node.callee = base;
            node.arguments = exprList;
            if (optionalSupported) {
              node.optional = optional;
            }
            base = this.finishNode(node, "CallExpression");
          }
          this.maybeInArrowParameters = oldMaybeInArrowParameters;
        } else if (this.type === tt.backQuote) {
          if (optional || _optionalChained) {
            this.raise(
              this.start,
              "Optional chaining cannot appear in the tag of tagged template expressions"
            );
          }
          let node = this.startNodeAt(startPos, startLoc);
          node.tag = base;
          node.quasi = this.parseTemplate({ isTagged: true });
          base = this.finishNode(node, "TaggedTemplateExpression");
        }
        return base;
      }
      parseGetterSetter(prop) {
        prop.kind = prop.key.name;
        this.parsePropertyName(prop);
        const typeParameters = this.tsTryParseTypeParameters(this.tsParseConstModifier);
        prop.value = this.parseMethod(false);
        if (typeParameters) prop.value.typeParameters = typeParameters;
        let paramCount = prop.kind === "get" ? 0 : 1;
        const firstParam = prop.value.params[0];
        const hasContextParam = firstParam && this.isThisParam(firstParam);
        paramCount = hasContextParam ? paramCount + 1 : paramCount;
        if (prop.value.params.length !== paramCount) {
          let start = prop.value.start;
          if (prop.kind === "get") this.raiseRecoverable(start, "getter should have no params");
          else this.raiseRecoverable(start, "setter should have exactly one param");
        } else {
          if (prop.kind === "set" && prop.value.params[0].type === "RestElement")
            this.raiseRecoverable(prop.value.params[0].start, "Setter cannot use rest params");
        }
      }
      parsePropertyValue(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc) {
        if (this.tsMatchLeftRelational()) {
          if (isPattern) this.unexpected();
          prop.kind = "init";
          prop.method = true;
          const typeParameters = this.tsTryParseTypeParameters(this.tsParseConstModifier);
          prop.value = this.parseMethod(isGenerator, isAsync);
          if (typeParameters) prop.value.typeParameters = typeParameters;
          return;
        }
        return super.parsePropertyValue(
          prop,
          isPattern,
          isGenerator,
          isAsync,
          startPos,
          startLoc,
          refDestructuringErrors,
          containsEsc
        );
      }
      parseProperty(isPattern, refDestructuringErrors) {
        if (!isPattern) {
          let decorators = [];
          if (this.match(tokTypes.at)) {
            while (this.match(tokTypes.at)) {
              decorators.push(this.parseDecorator());
            }
          }
          const property = super.parseProperty(isPattern, refDestructuringErrors);
          if (property.type === "SpreadElement") {
            if (decorators.length)
              this.raise(property.start, DecoratorsError.SpreadElementDecorator);
          }
          if (decorators.length) {
            property.decorators = decorators;
            decorators = [];
          }
          return property;
        }
        return super.parseProperty(isPattern, refDestructuringErrors);
      }
      parseCatchClauseParam() {
        const param = this.parseBindingAtom();
        let simple = param.type === "Identifier";
        this.enterScope(simple ? acornScope.SCOPE_SIMPLE_CATCH : 0);
        this.checkLValPattern(
          param,
          simple ? acornScope.BIND_SIMPLE_CATCH : acornScope.BIND_LEXICAL
        );
        const type = this.tsTryParseTypeAnnotation();
        if (type) {
          param.typeAnnotation = type;
          this.resetEndLocation(param);
        }
        this.expect(tt.parenR);
        return param;
      }
      parseClass(node, isStatement) {
        const oldInAbstractClass = this.inAbstractClass;
        this.inAbstractClass = !!node.abstract;
        try {
          this.next();
          this.takeDecorators(node);
          const oldStrict = this.strict;
          this.strict = true;
          this.parseClassId(node, isStatement);
          this.parseClassSuper(node);
          const privateNameMap = this.enterClassBody();
          const classBody = this.startNode();
          let hadConstructor = false;
          classBody.body = [];
          let decorators = [];
          this.expect(tt.braceL);
          while (this.type !== tt.braceR) {
            if (this.match(tokTypes.at)) {
              decorators.push(this.parseDecorator());
              continue;
            }
            const element = this.parseClassElement(node.superClass !== null);
            if (decorators.length) {
              element.decorators = decorators;
              this.resetStartLocationFromNode(element, decorators[0]);
              decorators = [];
            }
            if (element) {
              classBody.body.push(element);
              if (element.type === "MethodDefinition" && element.kind === "constructor" && element.value.type === "FunctionExpression") {
                if (hadConstructor) {
                  this.raiseRecoverable(element.start, "Duplicate constructor in the same class");
                }
