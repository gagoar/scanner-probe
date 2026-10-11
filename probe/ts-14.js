            this.parseEffects.pop(context);
            this.parseEffects.pop(context);
          } else if (currentContext === acornTypeScript.tokContexts.tc_oTag || currentContext === acornTypeScript.tokContexts.tc_expr) {
            this.parseEffects.pop(context);
          }
        }
        if (!jsx?.error && !this.tsMatchLeftRelational()) {
          return this.parseMaybeAssignOrigin(forInit, refExpressionErrors, afterLeftParse);
        }
        let typeParameters;
        const arrow = this.tryParse((abort) => {
          typeParameters = this.tsParseTypeParameters(this.tsParseConstModifier);
          const expr = this.parseMaybeAssignOrigin(forInit, refExpressionErrors, afterLeftParse);
          if (expr.type !== "ArrowFunctionExpression" || expr.extra?.parenthesized) {
            abort();
          }
          if (typeParameters?.params.length !== 0) {
            this.resetStartLocationFromNode(expr, typeParameters);
          }
          expr.typeParameters = typeParameters;
          return expr;
        });
        if (!arrow.error && !arrow.aborted) {
          if (typeParameters) this.reportReservedArrowTypeParam(typeParameters);
          return arrow.node;
        }
        if (!jsx) {
          assert(true);
          typeCast = this.tryParse(
            () => this.parseMaybeAssignOrigin(forInit, refExpressionErrors, afterLeftParse)
          );
          if (!typeCast.error) return typeCast.node;
        }
        if (jsx?.thrown) {
          this.selectTryParseResult(jsx);
          throw jsx.error;
        }
        if (arrow.thrown) {
          this.selectTryParseResult(arrow);
          throw arrow.error;
        }
        if (typeCast?.thrown) {
          this.selectTryParseResult(typeCast);
          throw typeCast.error;
        }
        throw jsx?.error || arrow.error || typeCast?.error;
      }
      parseAssignableListItem(allowModifiers) {
        const decorators = [];
        while (this.match(tokTypes.at)) {
          decorators.push(this.parseDecorator());
        }
        const startPos = this.start;
        const startLoc = this.startLoc;
        let accessibility;
        let readonly = false;
        let override = false;
        if (allowModifiers !== void 0) {
          const modified = {};
          this.tsParseModifiers({
            modified,
            allowedModifiers: ["public", "private", "protected", "override", "readonly"]
          });
          accessibility = modified.accessibility;
          override = modified.override;
          readonly = modified.readonly;
          if (allowModifiers === false && (accessibility || readonly || override)) {
            this.raise(startLoc.column, TypeScriptError.UnexpectedParameterModifier);
          }
        }
        const left = this.parseMaybeDefault(startPos, startLoc);
        this.parseBindingListItem(left);
        const elt = this.parseMaybeDefault(left["start"], left["loc"].start, left);
        if (decorators.length) {
          elt.decorators = decorators;
        }
        if (accessibility || readonly || override) {
          const pp = this.startNodeAt(startPos, startLoc);
          if (accessibility) pp.accessibility = accessibility;
          if (readonly) pp.readonly = readonly;
          if (override) pp.override = override;
          if (elt.type !== "Identifier" && elt.type !== "AssignmentPattern") {
            this.raise(pp.start, TypeScriptError.UnsupportedParameterPropertyKind);
          }
          pp.parameter = elt;
          return this.finishNode(pp, "TSParameterProperty");
        }
        return elt;
      }
      checkLValInnerPattern(expr, bindingType = acornScope.BIND_NONE, checkClashes) {
        switch (expr.type) {
          case "TSParameterProperty":
            this.checkLValInnerPattern(expr.parameter, bindingType, checkClashes);
            break;
          default: {
            super.checkLValInnerPattern(expr, bindingType, checkClashes);
            break;
          }
        }
      }
      parseBindingListItem(param) {
        if (this.eat(tt.question)) {
          if (param.type !== "Identifier" && !this.isAmbientContext && !this.inType) {
            this.raise(param.start, TypeScriptError.PatternIsOptional);
          }
          param.optional = true;
        }
        const type = this.tsTryParseTypeAnnotation();
        if (type) param.typeAnnotation = type;
        this.resetEndLocation(param);
        return param;
      }
      isAssignable(node, isBinding) {
        switch (node.type) {
          case "TSTypeCastExpression":
            return this.isAssignable(node.expression, isBinding);
          case "TSParameterProperty":
            return true;
          case "Identifier":
          case "ObjectPattern":
          case "ArrayPattern":
          case "AssignmentPattern":
          case "RestElement":
            return true;
          case "ObjectExpression": {
            const last = node.properties.length - 1;
            return node.properties.every((prop, i) => {
              return prop.type !== "ObjectMethod" && (i === last || prop.type !== "SpreadElement") && this.isAssignable(prop);
            });
          }
          case "Property":
          case "ObjectProperty":
            return this.isAssignable(node.value);
          case "SpreadElement":
            return this.isAssignable(node.argument);
          case "ArrayExpression":
            return node.elements.every(
              (element) => element === null || this.isAssignable(element)
            );
          case "AssignmentExpression":
            return node.operator === "=";
          case "ParenthesizedExpression":
            return this.isAssignable(node.expression);
          case "MemberExpression":
          case "OptionalMemberExpression":
            return !isBinding;
          default:
            return false;
        }
      }
      toAssignable(node, isBinding = false, refDestructuringErrors = new DestructuringErrors(), preserveTypeScriptWrapper = false) {
        switch (node.type) {
          case "ParenthesizedExpression":
            return this.toAssignableParenthesizedExpression(
              node,
              isBinding,
              refDestructuringErrors,
              preserveTypeScriptWrapper
            );
          case "TSAsExpression":
          case "TSSatisfiesExpression":
          case "TSNonNullExpression":
          case "TSTypeAssertion":
            if (isBinding) {
            } else {
              this.raise(node.start, TypeScriptError.UnexpectedTypeCastInParameter);
            }
            const expression = this.toAssignable(
              node.expression,
              isBinding,
              refDestructuringErrors,
              preserveTypeScriptWrapper
            );
            if (preserveTypeScriptWrapper) {
              node.expression = expression;
              return node;
            }
            return expression;
          case "MemberExpression":
            break;
          case "AssignmentExpression":
            if (!isBinding && node.left.type === "TSTypeCastExpression") {
              node.left = this.typeCastToParameter(node.left);
            }
            return super.toAssignable(node, isBinding, refDestructuringErrors);
          case "TSTypeCastExpression": {
            return this.typeCastToParameter(node);
          }
          default:
            return super.toAssignable(node, isBinding, refDestructuringErrors);
        }
        return node;
      }
      toAssignableParenthesizedExpression(node, isBinding, refDestructuringErrors, preserveTypeScriptWrapper = false) {
        switch (node.expression.type) {
          case "TSAsExpression":
          case "TSSatisfiesExpression":
          case "TSNonNullExpression":
          case "TSTypeAssertion":
          case "ParenthesizedExpression":
            const expression = this.toAssignable(
              node.expression,
              isBinding,
              refDestructuringErrors,
              preserveTypeScriptWrapper
            );
            if (preserveTypeScriptWrapper) {
              node.expression = expression;
              return node;
            }
            return expression;
          default:
            return super.toAssignable(node, isBinding, refDestructuringErrors);
        }
      }
      parseBindingAtom() {
        switch (this.type) {
          case tt._this:
            return this.parseIdent(
              true
            );
          default:
            return super.parseBindingAtom();
        }
      }
      shouldParseArrow(exprList) {
        let shouldParseArrowRes;
        if (this.match(tt.colon)) {
          shouldParseArrowRes = exprList.every((expr) => this.isAssignable(expr, true));
        } else {
          shouldParseArrowRes = !this.canInsertSemicolon();
        }
        if (shouldParseArrowRes) {
          if (this.match(tt.colon)) {
            const result = this.tryParse((abort) => {
              const returnType = this.tsParseTypeOrTypePredicateAnnotation(tt.colon);
              if (this.canInsertSemicolon() || !this.match(tt.arrow)) abort();
              return returnType;
            });
            if (result.aborted) {
              this.shouldParseArrowReturnType = void 0;
              return false;
            }
            if (!result.thrown) {
              this.shouldParseArrowReturnType = result.node;
            }
          }
          if (!this.match(tt.arrow)) {
            this.shouldParseArrowReturnType = void 0;
            return false;
          }
          return true;
        }
        this.shouldParseArrowReturnType = void 0;
        return shouldParseArrowRes;
      }
      parseParenArrowList(startPos, startLoc, exprList, forInit) {
        const node = this.startNodeAt(startPos, startLoc);
        node.returnType = this.shouldParseArrowReturnType;
        this.shouldParseArrowReturnType = void 0;
        return this.parseArrowExpression(node, exprList, false, forInit);
      }
      parseParenAndDistinguishExpression(canBeArrow, forInit) {
        let startPos = this.start, startLoc = this.startLoc, val, allowTrailingComma = this.ecmaVersion >= 8;
        if (this.ecmaVersion >= 6) {
          const oldMaybeInArrowParameters = this.maybeInArrowParameters;
          this.maybeInArrowParameters = true;
          this.next();
          let innerStartPos = this.start, innerStartLoc = this.startLoc;
          let exprList = [], first = true, lastIsComma = false;
          let refDestructuringErrors = new DestructuringErrors(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, spreadStart;
          this.yieldPos = 0;
          this.awaitPos = 0;
          while (this.type !== tt.parenR) {
            first ? first = false : this.expect(tt.comma);
            if (allowTrailingComma && this.afterTrailingComma(tt.parenR, true)) {
              lastIsComma = true;
              break;
            } else if (this.type === tt.ellipsis) {
              spreadStart = this.start;
              exprList.push(this.parseParenItem(this.parseRestBinding()));
              if (this.type === tt.comma) {
                this.raise(this.start, "Comma is not permitted after the rest element");
              }
              break;
            } else {
              exprList.push(
                this.parseMaybeAssign(false, refDestructuringErrors, this.parseParenItem)
              );
            }
          }
          let innerEndPos = this.lastTokEnd, innerEndLoc = this.lastTokEndLoc;
          this.expect(tt.parenR);
          this.maybeInArrowParameters = oldMaybeInArrowParameters;
          if (canBeArrow && this.shouldParseArrow(exprList) && this.eat(tt.arrow)) {
            this.checkPatternErrors(refDestructuringErrors, false);
            this.checkYieldAwaitInDefaultParams();
            this.yieldPos = oldYieldPos;
            this.awaitPos = oldAwaitPos;
            return this.parseParenArrowList(startPos, startLoc, exprList, forInit);
          }
          if (!exprList.length || lastIsComma) this.unexpected(this.lastTokStart);
          if (spreadStart) this.unexpected(spreadStart);
          this.checkExpressionErrors(refDestructuringErrors, true);
          this.yieldPos = oldYieldPos || this.yieldPos;
          this.awaitPos = oldAwaitPos || this.awaitPos;
          if (exprList.length > 1) {
            val = this.startNodeAt(innerStartPos, innerStartLoc);
            val.expressions = exprList;
            this.finishNodeAt(val, "SequenceExpression", innerEndPos, innerEndLoc);
          } else {
            val = exprList[0];
          }
        } else {
          val = this.parseParenExpression();
        }
        if (this.options.preserveParens) {
          let par = this.startNodeAt(startPos, startLoc);
          par.expression = val;
          return this.finishNode(par, "ParenthesizedExpression");
        } else {
          return val;
        }
      }
      parseTaggedTemplateExpression(base, startPos, startLoc, optionalChainMember) {
        const node = this.startNodeAt(startPos, startLoc);
        node.tag = base;
        node.quasi = this.parseTemplate({ isTagged: true });
        if (optionalChainMember) {
          this.raise(
            startPos,
            "Tagged Template Literals are not allowed in optionalChain."
          );
        }
        return this.finishNode(node, "TaggedTemplateExpression");
      }
      shouldParseAsyncArrow() {
        if (this.match(tt.colon)) {
          const result = this.tryParse((abort) => {
            const returnType = this.tsParseTypeOrTypePredicateAnnotation(tt.colon);
            if (this.canInsertSemicolon() || !this.match(tt.arrow)) abort();
            return returnType;
